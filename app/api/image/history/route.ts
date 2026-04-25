import { NextRequest, NextResponse } from "next/server";

const GAS_URL = process.env.GAS_WEBAPP_URL ?? "";
const GAS_KEY = process.env.GAS_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const code = searchParams.get("code");

  if (!id || !code) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_KEY)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "image_history", id }),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
