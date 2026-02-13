import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!; // = ADMIN_SECRET

    if (!url || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
        { status: 500 }
      );
    }

    const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "admin_list", adminKey }),
      cache: "no-store",
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

    // ✅ ここがポイント：
    // GASは { ok:true, items:[...] } を返す想定
    // AdminPageは { ok:true, rows:[...] } を期待しているので整形して返す
    const items = Array.isArray(data?.items) ? data.items : [];

    return NextResponse.json(
      {
        ok: !!data?.ok,
        rows: items,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}