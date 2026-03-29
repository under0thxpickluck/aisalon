import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applyId = searchParams.get("apply_id") ?? "";

  if (!applyId) {
    return NextResponse.json({ ok: false, error: "apply_id required" }, { status: 400 });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "env missing" }, { status: 500 });
  }

  try {
    const r = await fetch(`${gasUrl}?key=${encodeURIComponent(gasKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_apply_status_5000", applyId }),
      cache: "no-store",
    });
    const text = await r.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    return NextResponse.json(
      parsed ?? { ok: false, error: "gas_not_json" },
      { status: r.ok ? 200 : 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
