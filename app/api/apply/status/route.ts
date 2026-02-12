import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const applyId = searchParams.get("applyId");

    if (!applyId) {
      return NextResponse.json({ ok: false, error: "missing_applyId" }, { status: 400 });
    }

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const apiKey = process.env.GAS_API_KEY;

    if (!gasUrl || !apiKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const url = `${gasUrl}?key=${encodeURIComponent(apiKey)}&action=admin_list&adminKey=${process.env.GAS_ADMIN_KEY}`;

    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();

    if (!data?.ok || !Array.isArray(data.items)) {
      return NextResponse.json({ ok: false, error: "gas_failed" }, { status: 400 });
    }

    const found = data.items.find((item: any) => item.apply_id === applyId);

    if (!found) {
      return NextResponse.json({ ok: true, status: "not_found" });
    }

    return NextResponse.json({
      ok: true,
      status: found.status, // pending / paid / approved
    });

  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
