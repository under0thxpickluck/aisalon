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
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const { id, code, title, desc, item_type, asset_count, currency, price,
            delivery_mode, delivery_ref, stock_total } = body;

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "missing_auth" }, { status: 400 });
    }
    if (!title || !item_type || price == null) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const gas = await callGas(gasUrl, gasKey, {
      action: "market_create",
      id,
      code,
      title,
      desc:          desc          ?? "",
      item_type,
      asset_count:   asset_count   ?? 0,
      currency:      currency      ?? "EP",
      price,
      delivery_mode: delivery_mode ?? "",
      delivery_ref:  delivery_ref  ?? "",
      stock_total:   stock_total   ?? 1,
    });

    return NextResponse.json(gas, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
