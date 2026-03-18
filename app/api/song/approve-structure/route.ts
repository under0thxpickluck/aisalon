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
    updateJob(jobId, { stage: "generating" });

    const input: MusicGenerateInput = {
      prompt:            prompt.theme ?? prompt.genre ?? "",
      genre:             prompt.genre,
      mood:              prompt.mood,
      bpm:               structureData?.bpm ?? 120,
      key:               structureData?.key ?? "C major",
      lyrics:            lyricsData?.lyrics,
      lyricsMode:        lyricsData?.lyrics ? "manual" : "auto",
      language:          prompt.language ?? "ja",
      durationTargetSec: prompt.durationTargetSec ?? 165,
      vocalMode:         "vocal",
      structurePreset:   prompt.structurePreset ?? "ballad",
      moodTags:          prompt.moodTags ?? [],
    };

    const provider = new ElevenLabsProvider(apiKey);
    const result   = await provider.generateMusic(input);

    let finalUrl = result.audioUrl;
    if (result.audioUrl.startsWith("data:")) {
      const base64Data  = result.audioUrl.split(",")[1];
      const audioBuffer = Buffer.from(base64Data, "base64").buffer;
      const r2Url       = await uploadToR2(audioBuffer, jobId, job.userId ?? "unknown");
      if (r2Url) {
        finalUrl = r2Url;
        console.log(`[Job ${jobId}] Uploaded to R2: ${r2Url}`);
      }
    }

    updateJob(jobId, {
      status:      "completed",
      audioUrl:    finalUrl,
      downloadUrl: finalUrl,
      bpFinal:     BP_COSTS.music_full,
    });

    console.log(`[Job ${jobId}] Completed successfully`);
  } catch (err: any) {
    const errorMsg = String(err?.message ?? err);
    console.error(`[Job ${jobId}] Failed:`, errorMsg);
    updateJob(jobId, { status: "failed", error: errorMsg });
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

  const job = getJob(String(jobId));
  if (!job) return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  if (job.status !== "structure_ready") {
    return NextResponse.json({ ok: false, error: "invalid_status", status: job.status }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[ElevenLabs] ELEVENLABS_API_KEY is not set");
    updateJob(String(jobId), { status: "failed", error: "elevenlabs_api_key_missing" });
    return NextResponse.json({
      ok:      false,
      error:   "elevenlabs_api_key_missing",
      message: "ElevenLabs APIキーが設定されていません。管理者に連絡してください。",
    }, { status: 500 });
  }

  updateJob(String(jobId), {
    status:    "audio_generating",
    rightsLog: { ...job.rightsLog, structureApproved: true },
  });

  const updatedJob = getJob(String(jobId))!;
  generateAudioBackground(updatedJob, apiKey); // fire-and-forget

  return NextResponse.json({ ok: true, status: "audio_generating" });
}
