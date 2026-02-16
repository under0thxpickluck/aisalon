import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1) フロントから rowIndex を受け取る（ここは今のままでOK）
    const body = await req.json().catch(() => ({} as any));
    const rowIndex = Number(body?.rowIndex || 0);

    const base = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    // 2) envチェック
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

    // 3) rowIndexチェック
    if (!rowIndex || rowIndex < 2) {
      return NextResponse.json(
        { ok: false, error: "bad_rowIndex", got: body },
        { status: 400 }
      );
    }

    // ✅ 4) GASには GETクエリで渡す（listと同じ方式）
    const url =
      `${base}?action=admin_approve` +
      `&key=${encodeURIComponent(key)}` +
      `&adminKey=${encodeURIComponent(adminKey)}` +
      `&rowIndex=${encodeURIComponent(String(rowIndex))}`;

    // 5) GAS呼び出し
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    // 6) 応答をJSONとして返す（GAS側がJSONを返している前提）
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", status: res.status, raw: text.slice(0, 800) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}