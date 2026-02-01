import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      process.env.GAS_WEBAPP_URL + "?action=list&key=" + process.env.GAS_API_KEY
    );

    const text = await res.text();

    return new NextResponse(text, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
