// app/api/narasu-agency/pay-ep/route.ts
import { NextResponse } from "next/server";

const NARASU_EP_COST = 300;

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const gasAdminKey = process.env.GAS_ADMIN_KEY;
    if (!gasUrl || !gasKey || !gasAdminKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const loginId = String(body?.loginId ?? "").trim();
    if (!loginId) {
      return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
    }

    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "deduct_ep",
        adminKey: gasAdminKey,
        loginId,
        amount: NARASU_EP_COST,
      }),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
