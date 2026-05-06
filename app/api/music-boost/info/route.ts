import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

async function callGas(bodyObj: object) {
  const bodyStr = JSON.stringify(bodyObj);
  const url     = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  const res     = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) },
    body: bodyStr,
    redirect: "follow",
    cache: "no-store",
  });
  return res.json();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  try {
    return NextResponse.json(await callGas({ action: "music_boost_get_info", key: GAS_API_KEY, userId }));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const { userId, artist, album, tracks } = body ?? {};
  if (!userId) return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });

  // tracks 配列が送られた場合は set_tracks アクションを使う
  if (Array.isArray(tracks)) {
    try {
      return NextResponse.json(
        await callGas({ action: "music_boost_set_tracks", key: GAS_API_KEY, userId, tracks })
      );
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
    }
  }

  // 従来の artist/album 単体更新（後方互換）
  try {
    return NextResponse.json(
      await callGas({ action: "music_boost_update_info", key: GAS_API_KEY, userId, artist: artist ?? "", album: album ?? "" })
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
