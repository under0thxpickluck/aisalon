// app/api/song/approve-structure/route.ts
// ElevenLabs版（Replicate + Renderマージサーバー → ElevenLabs 1回呼び出しに置き換え）
import { NextResponse } from "next/server";
import { getJob, updateJob, type SongJob } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";
import {
  ElevenLabsProvider,
  uploadToR2,
  type MusicGenerateInput,
} from "@/app/features/music/providers/elevenlabsProvider";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

async function generateAudioBackground(job: SongJob, apiKey: string): Promise<void> {
  const { jobId, structureData, prompt, lyricsData } = job;

  try {
    await updateJob(jobId, { stage: "generating" });

    const input: MusicGenerateInput = {
      prompt:            prompt.theme ?? prompt.genre ?? "",
      genre:             prompt.genre,
      mood:              prompt.mood,
      bpm:               structureData?.bpm ?? 120,
      key:               structureData?.key ?? "C major",
      lyrics:            lyricsData?.lyrics,
      lyricsMode:        lyricsData?.lyrics ? "manual" : "auto",
      language:          prompt.language ?? "ja",
      durationTargetSec: 60,
      vocalMode:         "vocal",
      structurePreset:   "hook_only",
      moodTags:          prompt.moodTags ?? [],
    };

    const provider = new ElevenLabsProvider(apiKey);
    const result   = await provider.generateMusic(input);

    // R2に必ず保存する（base64/data URLは使わない）
    const r2Url = await uploadToR2(result.audioBuffer, jobId, job.userId ?? "unknown");
    if (!r2Url) {
      throw new Error("r2_upload_failed: R2へのアップロードに失敗しました");
    }
    const finalUrl = r2Url;
    console.log(`[Job ${jobId}] Uploaded to R2: ${r2Url}`);

    await updateJob(jobId, {
      status:      "completed",
      audioUrl:    finalUrl,
      downloadUrl: finalUrl,
      bpFinal:     BP_COSTS.music_full,
    });

    console.log(`[Job ${jobId}] Completed successfully`);
  } catch (err: any) {
    const errorMsg = String(err?.message ?? err);
    console.error(`[Job ${jobId}] Failed:`, errorMsg);
    await updateJob(jobId, { status: "failed", error: errorMsg });
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { jobId, approved } = body ?? {};
  if (!jobId)            return NextResponse.json({ ok: false, error: "jobId_required" },        { status: 400 });
  if (approved !== true) return NextResponse.json({ ok: false, error: "approved_must_be_true" }, { status: 400 });

  const job = await getJob(String(jobId));
  if (!job) return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  if (job.status !== "structure_ready") {
    return NextResponse.json({ ok: false, error: "invalid_status", status: job.status }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[ElevenLabs] ELEVENLABS_API_KEY is not set");
    await updateJob(String(jobId), { status: "failed", error: "elevenlabs_api_key_missing" });
    return NextResponse.json({
      ok:      false,
      error:   "elevenlabs_api_key_missing",
      message: "ElevenLabs APIキーが設定されていません。管理者に連絡してください。",
    }, { status: 500 });
  }

  await updateJob(String(jobId), {
    status:    "audio_generating",
    rightsLog: { ...job.rightsLog, structureApproved: true },
  });

  const updatedJob = await getJob(String(jobId));
  if (!updatedJob) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }
  await generateAudioBackground(updatedJob, apiKey); // 完了まで待つ
  const finalJob = await getJob(String(jobId));
  return NextResponse.json({ ok: true, status: finalJob?.status ?? "completed" });
}
