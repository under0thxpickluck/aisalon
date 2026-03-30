// app/api/song/result/route.ts
// processed_audio_url 優先、なければ raw_audio_url にフォールバック
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

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  console.log(`[song/result] jobId=${jobId} status=${job.status} processedAudioUrl=${job.processedAudioUrl} rawAudioUrl=${job.rawAudioUrl} audioUrl=${job.audioUrl}`);

  if (job.status !== "completed") {
    return NextResponse.json(
      { ok: false, error: "not_completed", status: job.status },
      { status: 200 }
    );
  }

  // 返却優先順位: processed → raw → audioUrl (旧互換)
  const processedAudioUrl = job.processedAudioUrl ?? null;
  const rawAudioUrl       = job.rawAudioUrl ?? null;
  const usedFallback      = !processedAudioUrl && !!rawAudioUrl;
  const audioUrl          = processedAudioUrl ?? rawAudioUrl ?? job.audioUrl ?? null;

  // 歌詞の優先順位: display_lyrics > singable_lyrics > master_lyrics
  const displayLyrics      = job.displayLyrics      ?? job.singableLyrics ?? job.masterLyrics ?? "";
  const distributionLyrics = job.distributionLyrics ?? job.singableLyrics ?? job.masterLyrics ?? "";

  return NextResponse.json({
    ok:                   true,
    jobId:                job.jobId,
    title:                job.structureData?.title ?? job.lyricsData?.title ?? "",
    audioUrl,
    downloadUrl:          audioUrl,
    rawAudioUrl,
    processedAudioUrl,
    usedFallback,
    usedBp:               job.bpFinal ?? BP_COSTS.music_full,
    // 後方互換: lyrics は displayLyrics と同値
    lyrics:               displayLyrics,
    displayLyrics,
    distributionLyrics,
    masterLyrics:         job.masterLyrics         ?? null,
    singableLyrics:       job.singableLyrics        ?? null,
    lyricsMatchScore:     job.lyricsMatchScore      ?? null,
    lyricsReviewRequired: job.lyricsReviewRequired  ?? true,
    distributionReady:    job.distributionReady     ?? false,
    lyricsSource:         job.lyricsSource          ?? "singable",
    asrStatus:            job.asrStatus             ?? null,
    postprocessPreset:    job.postprocessPreset      ?? null,
    postprocessVersion:   job.postprocessVersion     ?? null,
    finalLufs:            job.finalLufs              ?? null,
    finalPeakDb:          job.finalPeakDb            ?? null,
  });
}
