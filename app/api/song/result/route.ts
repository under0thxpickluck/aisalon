// app/api/song/result/route.ts
import { NextResponse } from "next/server";
import { getJob } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId_required" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  console.log('[song/result] job.audioUrl:', job.audioUrl);

  if (job.status !== "completed") {
    return NextResponse.json(
      { ok: false, error: "not_completed", status: job.status },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    title: job.structureData?.title ?? job.lyricsData?.title ?? "",
    audioUrl: job.audioUrl,
    downloadUrl: job.downloadUrl,
    usedBp: job.bpFinal ?? BP_COSTS.music_full,
    lyrics: job.lyricsData?.lyrics ?? "",
  });
}
