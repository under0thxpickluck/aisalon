import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
    }

    const url = process.env.GAS_WEBAPP_URL;
    const key = process.env.GAS_API_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "env_missing" },
        { status: 500 }
      );
    }

    const gasUrl = `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "user_id_remind", email }),
    });

    const json = await res.json().catch(() => ({ ok: false, error: "gas_not_json" }));
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
