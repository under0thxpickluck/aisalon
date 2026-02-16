import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const base = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_env",
          need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"],
        },
        { status: 500 }
      );
    }

    // 🔥 GAS用URL（GETクエリ）
    const url =
      `${base}?action=admin_list` +
      `&key=${encodeURIComponent(key)}` +
      `&adminKey=${encodeURIComponent(adminKey)}`;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}