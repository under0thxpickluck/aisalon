// app/api/radio/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGasEnv() {
  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;
  return { gasUrl, gasKey, gasAdminKey };
}

function buildGasUrl(gasUrl: string, gasKey: string) {
  return `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
}

async function callGas(payload: Record<string, unknown>): Promise<NextResponse> {
  const { gasUrl, gasKey, gasAdminKey } = getGasEnv();
  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }
  try {
    const url = buildGasUrl(gasUrl, gasKey);
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      cache:   "no-store",
      body:    JSON.stringify({ ...payload, adminKey: gasAdminKey }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}

// GET ?action=songs  → get_radio_songs
// GET ?action=status&loginId=xxx  → get_radio_status
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action  = searchParams.get("action");
  const loginId = searchParams.get("loginId");

  if (action === "songs") {
    return callGas({ action: "get_radio_songs" });
  }

  if (action === "status") {
    if (!loginId) {
      return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
    }
    return callGas({ action: "get_radio_status", loginId });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}

// POST body={action:"start", loginId, song_id}
//      body={action:"submit", loginId, mission_id, screenshot_note}
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action = String(body?.action ?? "");

  if (action === "start") {
    const loginId = String(body?.loginId  ?? "");
    const songId  = String(body?.song_id  ?? "");
    if (!loginId) return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
    if (!songId)  return NextResponse.json({ ok: false, error: "song_id_required" }, { status: 400 });
    return callGas({ action: "radio_start", loginId, song_id: songId });
  }

  if (action === "submit") {
    const loginId        = String(body?.loginId         ?? "");
    const missionId      = String(body?.mission_id      ?? "");
    const screenshotNote = String(body?.screenshot_note ?? "");
    if (!loginId)   return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
    if (!missionId) return NextResponse.json({ ok: false, error: "mission_id_required" }, { status: 400 });
    return callGas({ action: "radio_submit", loginId, mission_id: missionId, screenshot_note: screenshotNote });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}
