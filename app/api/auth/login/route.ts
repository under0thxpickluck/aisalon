import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, code } = await req.json().catch(() => ({}));

    const url = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY"] },
        { status: 500 }
      );
    }
    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "id/code required" }, { status: 400 });
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "login",
        key,
        id,
        code,
      }),
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

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}