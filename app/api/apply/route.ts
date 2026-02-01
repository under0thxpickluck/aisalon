import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const apiKey = process.env.GAS_API_KEY;

    if (!gasUrl) {
      return NextResponse.json({ ok: false, where: "env", error: "GAS_WEBAPP_URL missing" }, { status: 500 });
    }
    if (!apiKey) {
      return NextResponse.json({ ok: false, where: "env", error: "GAS_API_KEY missing" }, { status: 500 });
    }

    // ★ exec を想定。末尾が /exec になってるか確認しやすいように返す
    const url = `${gasUrl}?key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply", ...body }),
      cache: "no-store",
    });

    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    return NextResponse.json({
      ok: r.ok && parsed?.ok !== false,
      gas: {
        requestUrl: url,
        httpStatus: r.status,
        raw: text,
        parsed,
      },
    }, { status: r.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, where: "api", error: String(err) }, { status: 500 });
  }
}
