// app/api/5000/admin/approve/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const applyId = String(body?.applyId || "");

    const base = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
        { status: 500 }
      );
    }

    if (!applyId) {
      return NextResponse.json({ ok: false, error: "applyId required" }, { status: 400 });
    }

    const hasQuery = base.includes("?");
    const gasUrl = `${base}${hasQuery ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "admin_approve_5000",
        adminKey,
        applyId,
      }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
