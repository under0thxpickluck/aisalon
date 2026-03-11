// app/api/admin/grant-bp/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    console.log('grant-bp called, body:', JSON.stringify(body));
    const { request_id, user_id, bp_amount } = body;

    const base = process.env.GAS_WEBAPP_URL;
    const key = process.env.GAS_API_KEY;
    const adminKey = process.env.GAS_ADMIN_KEY;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
        { status: 500 }
      );
    }

    if (!request_id || !user_id || !bp_amount) {
      return NextResponse.json(
        { ok: false, error: "missing_params", need: ["request_id", "user_id", "bp_amount"] },
        { status: 400 }
      );
    }

    const bpNum = Number(bp_amount);
    if (Number.isNaN(bpNum) || bpNum <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_bp_amount" }, { status: 400 });
    }

    const url = `${base}?key=${encodeURIComponent(key)}`;

    // GASに送る直前に追加
    console.log('grant-bp payload:', JSON.stringify({
      action: "grant_bp_for_sell",
      request_id,
      user_id,
      bp_amount: bpNum
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant_bp_for_sell", adminKey, request_id, user_id, bp_amount: bpNum }),
      cache: "no-store",
    });
    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
