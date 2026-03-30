// app/api/song/status/route.ts
import { NextResponse } from "next/server";
import { getJob, type JobStatus } from "../_jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ステータス → 進捗パーセント */
const STATUS_PROGRESS: Record<JobStatus, number> = {
  queued:            3,
  lyrics_generating: 10,
  lyrics_ready:      25,
  structure_generating: 35,
  structure_ready:   45,
  audio_generating:  65,   // 旧ステータス（後方互換）
  generating_audio:  65,
  postprocessing:    88,
  uploading_result:  96,
  completed:         100,
  failed:            100,
  cancelled:         100,
};

/** ステータス → ユーザー向けラベル */
const STATUS_LABEL: Partial<Record<JobStatus, string>> = {
  lyrics_generating:    "歌詞を生成しています",
  lyrics_ready:         "歌詞の生成が完了しました",
  structure_generating: "曲の構成を組み立てています",
  structure_ready:      "構成の生成が完了しました",
  audio_generating:     "音楽を生成しています",
  generating_audio:     "音楽を生成しています",
  postprocessing:       "音質を自然に整えています",
  uploading_result:     "最終データを保存しています",
  completed:            "完成しました",
  failed:               "生成に失敗しました",
  cancelled:            "キャンセルされました",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId_required" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  const progress   = STATUS_PROGRESS[job.status] ?? 0;
  const stageLabel = STATUS_LABEL[job.status] ?? null;

  return NextResponse.json({
    ok:                true,
    jobId:             job.jobId,
    status:            job.status,
    progress,
    stageLabel,
    postprocessStatus: job.postprocessStatus ?? null,
    bpLocked:          job.bpLocked,
    bpFinal:           job.bpFinal,
    // 旧 stage フィールド（後方互換）
    ...(
      (job.status === "audio_generating" || job.status === "generating_audio") &&
      job.stage
        ? { stage: job.stage }
        : {}
    ),
  });
}
