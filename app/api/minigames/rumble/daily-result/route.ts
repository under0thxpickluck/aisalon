import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTodayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function pendingFallback(date: string) {
  const todayJst = getTodayJST();
  return NextResponse.json({
    ok: true,
    status: "pending",
    date,
    participant_count: 0,
    winnerCount: 0,
    isToday: date === todayJst,
    participants: [],
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? getTodayJST();

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  if (!gasUrl || !gasKey) return pendingFallback(date);

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "rumble_daily_result", date }),
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) return pendingFallback(date);
    return NextResponse.json(data);
  } catch {
    return pendingFallback(date);
  }
}
