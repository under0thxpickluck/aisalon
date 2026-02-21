// app/api/wallet/balance/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));

    const url = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY"] },
        { status: 500 }
      );
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    // ✅ 重要：GASは pickKey_(e) で URLクエリの key を見ている
    // なので body に key を入れるのではなく URL に ?key= を付与する
    const hasQuery = url.includes("?");
    const gasUrl = `${url}${hasQuery ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const r = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "get_balance",
        id,
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