import { NextRequest, NextResponse } from "next/server";

const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_KEY = process.env.GAS_API_KEY!;

// GET /api/fortune/result?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "fortune_result_get", userId }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}

// POST /api/fortune/result
// body: { userId, result }
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.userId || !body.result) {
    return NextResponse.json({ ok: false, error: "userId_and_result_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "fortune_result_save", ...body }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}
