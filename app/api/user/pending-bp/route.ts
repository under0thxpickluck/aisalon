// app/api/user/pending-bp/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, code } = await req.json().catch(() => ({} as any));

    const url = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY"] },
        { status: 500 }
      );
    }

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "missing_auth" }, { status: 400 });
    }

    const hasQuery = url.includes("?");
    const gasUrl = `${url}${hasQuery ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const r = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "get_pending_bp", id, code }),
    });

    const text = await r.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    // GASから { ok, hasPending, amount } を期待
    return NextResponse.json({
      ok: data.ok ?? false,
      hasPending: Boolean(data.hasPending),
      amount: Number(data.amount ?? 0),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
