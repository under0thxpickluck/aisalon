import { NextRequest, NextResponse } from "next/server";

const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_KEY = process.env.GAS_API_KEY!;

// GET /api/music/history?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "music_history_list", userId }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}

// POST /api/music/history
// body: { userId, jobId, title, audioUrl, downloadUrl, lyrics, createdAt, expiresAt }
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.userId || !body.jobId) {
    return NextResponse.json({ ok: false, error: "userId_and_jobId_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "music_history_save", ...body }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}
