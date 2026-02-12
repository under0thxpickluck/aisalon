import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, applyId } = body;

    if (!plan || !applyId) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const apiKey = process.env.GAS_API_KEY;

    if (!gasUrl || !apiKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const url = `${gasUrl}?key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "apply",
        plan,
        applyId,
        email: "temp@pending.com",
        name: "pending",
        nameKana: "pending"
      }),
      cache: "no-store",
    });

    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}

    return NextResponse.json({
      ok: r.ok && parsed?.ok !== false,
      gas: parsed,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
