import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;
const GAS_ADMIN_KEY = process.env.GAS_ADMIN_KEY!;
export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const weekId = body?.weekId ?? "";
  const payload: Record<string, string> = { action: "rumble_reward_distribute", key: GAS_API_KEY, adminKey: GAS_ADMIN_KEY };
  if (weekId) payload.weekId = weekId;
  const bodyStr = JSON.stringify(payload);
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) }, body: bodyStr, redirect: "follow", cache: "no-store" });
    return NextResponse.json(await res.json());
  } catch (err: any) { return NextResponse.json({ ok: false, error: err?.message }, { status: 500 }); }
}
