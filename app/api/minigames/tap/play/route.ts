import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { userId, comboCount } = body ?? {};
  if (!userId) return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });

  const bodyStr = JSON.stringify({ action: "tap_play", key: GAS_API_KEY, userId, comboCount: comboCount ?? 0 });
  const url = `${GAS_URL}?key=${encodeURIComponent(GAS_API_KEY)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) },
      body: bodyStr,
      redirect: "follow",
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
