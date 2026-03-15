// app/api/missions/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── 1日1回制限：サーバーサイドin-memoryキャッシュ ────────────────────────────
// key: `${loginId}:${missionType}:${YYYY-MM-DD(JST)}`
const missionCompletedCache = new Map<string, true>();

function todayJST(): string {
  return new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function missionCacheKey(loginId: string, missionType: string): string {
  return `${loginId}:${missionType}:${todayJST()}`;
}

function getGasEnv() {
  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;
  return { gasUrl, gasKey, gasAdminKey };
}

function buildGasUrl(gasUrl: string, gasKey: string) {
  return `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
}

// GET: ミッション状況取得
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const loginId = searchParams.get("loginId");

  if (!loginId) {
    return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
  }

  const { gasUrl, gasKey, gasAdminKey } = getGasEnv();
  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = buildGasUrl(gasUrl, gasKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action:   "get_missions",
        adminKey: gasAdminKey,
        loginId,
      }),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}

// POST: ミッション完了
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const loginId     = String(body?.loginId ?? "");
  const missionType = String(body?.mission_type ?? "");

  if (!loginId) {
    return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
  }
  if (!missionType) {
    return NextResponse.json({ ok: false, error: "mission_type_required" }, { status: 400 });
  }

  // 1日1回制限チェック
  const cacheKey = missionCacheKey(loginId, missionType);
  if (missionCompletedCache.has(cacheKey)) {
    return NextResponse.json({ ok: false, error: "already_completed_today" }, { status: 400 });
  }

  const { gasUrl, gasKey, gasAdminKey } = getGasEnv();
  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = buildGasUrl(gasUrl, gasKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action:       "complete_mission",
        adminKey:     gasAdminKey,
        loginId,
        mission_type: missionType,
      }),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));

    // GASが成功した場合のみキャッシュに記録
    if (data.ok) {
      missionCompletedCache.set(cacheKey, true);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}
