import { NextRequest, NextResponse } from "next/server";
import { editImage } from "@/app/lib/image/image_client";
import { withBp, BpError, assertStorableUrl } from "@/app/lib/sticker/gas";
import { buildStickerPrompt } from "@/app/lib/sticker/character_prompt";
import { normalizeProfile } from "@/app/lib/sticker/manifest";
import { STICKER_BP } from "@/app/lib/sticker/cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 気に入らなかった1枚だけを作り直す。
// パックのクレジットではなく都度 15BP を消費する（乱発の抑止）。
export async function POST(req: NextRequest) {
  try {
    const { id, code, masterUrl, profile, item } = (await req.json()) as {
      id?: string;
      code?: string;
      masterUrl?: string;
      profile?: unknown;
      item?: { emotion?: string; pose?: string; expression?: string };
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!masterUrl || !item) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }

    const prompt = buildStickerPrompt(normalizeProfile(profile), {
      emotion: item.emotion ?? "",
      pose: item.pose ?? "",
      expression: item.expression ?? "",
    });

    const imageUrl = await withBp(
      { id, amount: STICKER_BP.regenerate, reason: "sticker_regenerate" },
      async () => {
        const url = await editImage({
          imageUrl: masterUrl,
          instruction: prompt,
          size: "1024x1024",
          quality: "medium",
          background: "transparent",
          keyPrefix: "stickers/items",
        });
        assertStorableUrl(url);
        return url;
      }
    );

    return NextResponse.json({
      ok: true,
      imageUrl,
      bpUsed: STICKER_BP.regenerate,
    });
  } catch (e) {
    if (e instanceof BpError) {
      return NextResponse.json(
        { ok: false, error: e.message, required: e.required },
        { status: e.status }
      );
    }
    console.error("[sticker/regenerate] failed:", e);
    return NextResponse.json(
      { ok: false, error: "generation_failed" },
      { status: 500 }
    );
  }
}
