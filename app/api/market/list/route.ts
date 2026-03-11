import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function callGas(gasUrl: string, gasKey: string, payload: object) {
  const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: "bad_gas_json" }; }
}

export async function GET(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const status    = searchParams.get("status")    ?? "active";
    const item_type = searchParams.get("item_type") ?? "";
    const currency  = searchParams.get("currency")  ?? "";
    const page      = Number(searchParams.get("page") ?? "1");
    const limit     = Number(searchParams.get("limit") ?? "20");

    const gas = await callGas(gasUrl, gasKey, {
      action: "market_list",
      status,
      item_type,
      currency,
      page,
      limit,
    });

    return NextResponse.json(gas, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
