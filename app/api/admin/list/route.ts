import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const url = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!url || !key || !adminKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_env",
          need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"],
        },
        { status: 500 }
      );
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "admin_list",
        key,
        adminKey,
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