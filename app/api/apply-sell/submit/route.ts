import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const loginId  = String(body?.loginId  ?? "");
  const title    = String(body?.title    ?? "").trim();
  const musicUrl = String(body?.musicUrl ?? "").trim();
  const priceUsd = String(body?.priceUsd ?? "").trim();
  const memo     = String(body?.memo     ?? "").trim();

  if (!loginId)  return NextResponse.json({ ok: false, error: "loginId_required" },  { status: 400 });
  if (!title)    return NextResponse.json({ ok: false, error: "title_required" },     { status: 400 });
  if (!musicUrl) return NextResponse.json({ ok: false, error: "music_url_required" }, { status: 400 });

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "music_sell_submit",
        loginId,
        title,
        music_url: musicUrl,
        price_usdt: priceUsd,
        memo,
      }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}
