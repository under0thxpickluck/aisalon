import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body     = await req.json().catch(() => ({} as any));
    const { month } = body ?? {};

    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, error: "invalid_month" }, { status: 400 });
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "affiliate_monthly_summary", adminKey, month }),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
