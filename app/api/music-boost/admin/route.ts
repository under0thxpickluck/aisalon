import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;
export async function GET() {
  const bodyStr = JSON.stringify({ action: "music_boost_admin_list", key: GAS_API_KEY });
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) }, body: bodyStr, redirect: "follow", cache: "no-store" });
    return NextResponse.json(await res.json());
  } catch (err: any) { return NextResponse.json({ ok: false, error: err?.message }, { status: 500 }); }
}
