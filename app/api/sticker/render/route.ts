import { NextRequest, NextResponse } from "next/server";
import { editImage } from "@/app/lib/image/image_client";
import { changeCredits, assertStorableUrl } from "@/app/lib/sticker/gas";
import { buildStickerPrompt } from "@/app/lib/sticker/character_prompt";
import { normalizeProfile } from "@/app/lib/sticker/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// スタンプ1枚を生成する。1リクエスト＝1枚。
//
// BP は /api/sticker/start で先払い済みなので、ここでは生成クレジットを1消費する。
// クレジットの増減は GAS 側で原子的に行われるため、クライアントを信用しなくてよい。
export async function POST(req: NextRequest) {
  const { id, code, projectId, masterUrl, profile, item } = (await req
    .json()
    .catch(() => ({}))) as {
    id?: string;
    code?: string;
    projectId?: string;
    masterUrl?: string;
    profile?: unknown;
    item?: { emotion?: string; pose?: string; expression?: string };
  };

  if (!id || !code) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!projectId || !masterUrl || !item) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // 1クレジット消費（残っていなければここで止まる）
  const consumed = await changeCredits(id, projectId, -1);
  if (!consumed.ok) {
    return NextResponse.json(
      { ok: false, error: consumed.error ?? "no_credits" },
      { status: 402 }
    );
  }

  const prompt = buildStickerPrompt(normalizeProfile(profile), {
    emotion: item.emotion ?? "",
    pose: item.pose ?? "",
    expression: item.expression ?? "",
  });

  try {
    const imageUrl = await editImage({
      imageUrl: masterUrl, // ← Character LOCK。全枚数がこのマスターを参照する
      instruction: prompt,
      size: "1024x1024",
      quality: "medium",
      background: "transparent",
      keyPrefix: "stickers/items",
    });
    assertStorableUrl(imageUrl);

    return NextResponse.json({
      ok: true,
      imageUrl,
      credits: consumed.credits,
    });
  } catch (e) {
    console.error("[sticker/render] failed:", e);
    // 生成に失敗したらクレジットを戻す（＝無料リトライ）
    const restored = await changeCredits(id, projectId, 1).catch(() => null);
    return NextResponse.json(
      {
        ok: false,
        error: "generation_failed",
        credits: restored?.credits ?? consumed.credits + 1,
      },
      { status: 500 }
    );
  }
}
