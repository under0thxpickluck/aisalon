import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const adminKey = process.env.GAS_ADMIN_KEY;
    if (!gasUrl || !gasKey || !adminKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const { order_id, note } = body;

    if (!order_id) {
      return NextResponse.json({ ok: false, error: "missing_order_id" }, { status: 400 });
    }

    const gas = await callGas(gasUrl, gasKey, {
      action: "market_refund",
      adminKey,
      order_id,
      note: note ?? "",
    });

    return NextResponse.json(gas, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
