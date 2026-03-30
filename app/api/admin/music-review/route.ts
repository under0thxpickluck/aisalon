// app/api/admin/music-review/route.ts
// 音楽レビュー管理 API
// GET  : review_required な曲一覧を返す
// POST : 手動確認後に配信可/配信不可 で確定する

import { NextResponse } from "next/server";
import { getJob, updateJob } from "../../song/_jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

async function callGas(action: string, params: Record<string, unknown>) {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action, key: GAS_API_KEY, ...params }),
    cache:   "no-store",
    redirect: "follow",
  });
  return res.json();
}

// ── GET: review_required な曲一覧 ──────────────────────────────────────────

export async function GET() {
  try {
    const res = await callGas("list_review_required_music_jobs", {});
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error ?? "gas_error" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, jobs: res.jobs ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

// ── POST: 手動確認アクション ────────────────────────────────────────────────

type ReviewAction = "confirm_distribution" | "reject_distribution" | "update_lyrics";

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { jobId, action, displayLyrics, distributionLyrics } = body ?? {};

  if (!jobId)  return NextResponse.json({ ok: false, error: "jobId_required" },  { status: 400 });
  if (!action) return NextResponse.json({ ok: false, error: "action_required" }, { status: 400 });

  const job = await getJob(String(jobId));
  if (!job) return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });

  const reviewAction = action as ReviewAction;

  if (reviewAction === "confirm_distribution") {
    // 配信可で確定: distributionLyrics に displayLyrics を採用、gate=pass
    const distLyrics = distributionLyrics ?? job.displayLyrics ?? job.singableLyrics ?? "";
    await updateJob(String(jobId), {
      status:               "completed",
      distributionReady:    true,
      distributionLyrics:   distLyrics,
      lyricsGateResult:     "pass",
      lyricsReviewRequired: false,
    });
    return NextResponse.json({ ok: true, action: "confirmed", jobId });

  } else if (reviewAction === "reject_distribution") {
    // 配信不可のまま完了: distributionLyrics を空に
    await updateJob(String(jobId), {
      status:               "completed",
      distributionReady:    false,
      distributionLyrics:   "",
      lyricsGateResult:     "reject",
      lyricsReviewRequired: false,
    });
    return NextResponse.json({ ok: true, action: "rejected", jobId });

  } else if (reviewAction === "update_lyrics") {
    // 手動編集して保存
    if (displayLyrics === undefined && distributionLyrics === undefined) {
      return NextResponse.json({ ok: false, error: "lyrics_required" }, { status: 400 });
    }
    const updates: Record<string, unknown> = { lyricsSource: "manual" };
    if (displayLyrics !== undefined)      updates.displayLyrics      = displayLyrics;
    if (distributionLyrics !== undefined) updates.distributionLyrics = distributionLyrics;
    await updateJob(String(jobId), updates);
    return NextResponse.json({ ok: true, action: "updated", jobId });

  } else {
    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  }
}
