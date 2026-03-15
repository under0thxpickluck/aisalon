// app/api/missions/route.ts
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

  const { gasUrl, gasKey, gasAdminKey } = getGasEnv();
  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  const url = buildGasUrl(gasUrl, gasKey);

  // 1日1回制限チェック：GASから現在のミッション状態を取得して確認
  // （in-memoryは Vercel サーバーレスで再起動時にリセットされるため不適切）
  try {
    const checkRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action:   "get_missions",
        adminKey: gasAdminKey,
        loginId,
      }),
    });
    const checkData = await checkRes.json().catch(() => ({ ok: false }));

    if (checkData.ok && checkData.missions?.[missionType]?.done === true) {
      return NextResponse.json({ ok: false, error: "already_completed_today" }, { status: 400 });
    }
  } catch {
    // 確認失敗はスキップして続行（GASが落ちていても complete_mission 自体を止めない）
  }

  try {
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
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}
