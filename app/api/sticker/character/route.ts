import { NextRequest, NextResponse } from "next/server";
import { generateImage, editImage } from "@/app/lib/image/image_client";
import { gasPost, withBp, BpError, assertStorableUrl } from "@/app/lib/sticker/gas";
import {
  buildMasterPrompt,
  buildMasterFromImagePrompt,
  buildVariantPrompt,
  VARIANT_POSES,
} from "@/app/lib/sticker/character_prompt";
import { normalizeProfile } from "@/app/lib/sticker/manifest";
import { STICKER_BP } from "@/app/lib/sticker/cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// キャラクター基準画像を作る。
// master は high（全スタンプの参照元になるため妥協しない）、
// 確認用のバリエーション2枚は medium。
export async function POST(req: NextRequest) {
  try {
    const { id, code, sourcePrompt, sourceImageUrl, profile } =
      (await req.json()) as {
        id?: string;
        code?: string;
        sourcePrompt?: string;
        sourceImageUrl?: string;
        profile?: unknown;
      };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const src = (sourcePrompt ?? "").trim();
    const srcImage = (sourceImageUrl ?? "").trim();
    if (!src && !srcImage) {
      return NextResponse.json(
        { ok: false, error: "source_required" },
        { status: 400 }
      );
    }

    const safeProfile = normalizeProfile(profile);

    const result = await withBp(
      { id, amount: STICKER_BP.character, reason: "sticker_character" },
      async () => {
        // master を先に作る。ここが落ちたら BP は withBp が返金する。
        // アップロード画像があれば、それを元に描き起こす。
        const masterUrl = srcImage
          ? await editImage({
              imageUrl: srcImage,
              instruction: buildMasterFromImagePrompt(safeProfile, src),
              size: "1024x1024",
              quality: "high",
              background: "transparent",
              keyPrefix: "stickers/character",
            })
          : await generateImage(buildMasterPrompt(safeProfile, src), {
              size: "1024x1024",
              quality: "high",
              background: "transparent",
              keyPrefix: "stickers/character",
            });
        assertStorableUrl(masterUrl);

        // バリエーションは確認用。master を参照させることで見た目を揃える。
        // 失敗しても master があれば先へ進めるので握りつぶす。
        const variants = await Promise.allSettled(
          VARIANT_POSES.map((pose) =>
            editImage({
              imageUrl: masterUrl,
              instruction: buildVariantPrompt(safeProfile, src, pose),
              size: "1024x1024",
              quality: "medium",
              background: "transparent",
              keyPrefix: "stickers/character",
            })
          )
        );

        const variantUrls = variants
          .filter(
            (v): v is PromiseFulfilledResult<string> => v.status === "fulfilled"
          )
          .map((v) => v.value)
          .filter((u) => !u.startsWith("data:"));

        return { masterUrl, variantUrls };
      }
    );

    gasPost("image_log", {
      id,
      prompt: srcImage
        ? buildMasterFromImagePrompt(safeProfile, src)
        : buildMasterPrompt(safeProfile, src),
      image_url: result.masterUrl,
      bp_used: STICKER_BP.character,
      type: "sticker_character",
      meta_json: JSON.stringify({ profile: safeProfile }),
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      masterUrl: result.masterUrl,
      variantUrls: result.variantUrls,
      bpUsed: STICKER_BP.character,
    });
  } catch (e) {
    if (e instanceof BpError) {
      return NextResponse.json(
        { ok: false, error: e.message, required: e.required },
        { status: e.status }
      );
    }
    console.error("[sticker/character] failed:", e);
    return NextResponse.json(
      { ok: false, error: "generation_failed" },
      { status: 500 }
    );
  }
}
