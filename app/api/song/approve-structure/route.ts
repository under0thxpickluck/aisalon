// app/api/song/approve-structure/route.ts
// 後加工パイプライン付き音楽生成
// ElevenLabs → raw保存 → postprocess → final保存 → completed

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { getJob, updateJob, type SongJob } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";
import {
  ElevenLabsProvider,
  type MusicGenerateInput,
} from "@/app/features/music/providers/elevenlabsProvider";
import { choosePostprocessPreset } from "@/lib/music/presets";
import { runPostprocess } from "@/lib/music/postprocess";
import { uploadRawAudio, uploadFinalAudio, uploadAnalysisJson, cleanupTempFiles } from "@/lib/music/storage";
import { mergeRightsLog } from "@/lib/music/rights-log";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// ── メイン生成パイプライン ────────────────────────────────────────────────────

async function runAudioPipeline(job: SongJob, apiKey: string): Promise<void> {
  const { jobId, structureData, prompt, singableLyrics } = job;
  const rawTempPath   = path.join(os.tmpdir(), `${jobId}_raw.mp3`);
  const finalTempPath = path.join(os.tmpdir(), `${jobId}_final.mp3`);

  // ── Phase 1: ElevenLabs 音声生成 ────────────────────────────────────────────
  await updateJob(jobId, { status: "generating_audio", stage: "generating" });

  const isPro = !!prompt.isPro;

  // Pro: ムードに応じて構成プリセットを選択
  function chooseStructurePreset(mood?: string): string {
    if (!mood) return isPro ? "short_pop" : "hook_only";
    const m = mood;
    if (isPro) {
      if (/激しい|明るい|さわやか/.test(m)) return "upbeat";
      if (/ロマンチック|切ない|エモい/.test(m)) return "ballad";
      if (/クール|落ち着いた/.test(m)) return "cinematic";
      return "short_pop";
    }
    return "hook_only";
  }

  let audioBuffer: ArrayBuffer;
  try {
    // singable_lyrics があれば manual モードで渡す（Phase 1）
    const hasSingable = !!(singableLyrics && singableLyrics.trim().length > 0);
    const input: MusicGenerateInput = {
      prompt:            prompt.theme ?? prompt.genre ?? "",
      genre:             prompt.genre,
      mood:              prompt.mood,
      bpm:               structureData?.bpm ?? 120,
      key:               structureData?.key ?? "C major",
      lyrics:            hasSingable ? singableLyrics : undefined,
      lyricsMode:        hasSingable ? "manual" : "auto",
      language:          prompt.language ?? "ja",
      durationTargetSec: isPro ? 180 : 150,
      vocalMode:         "vocal",
      structurePreset:   chooseStructurePreset(prompt.mood),
      moodTags:          prompt.moodTags ?? [],
      isPro,
    };

    const provider = new ElevenLabsProvider(apiKey);
    const result   = await provider.generateMusic(input);
    audioBuffer    = result.audioBuffer;

    // raw を一時ファイルに書き出し
    fs.writeFileSync(rawTempPath, Buffer.from(audioBuffer));
    console.log(`[Job ${jobId}] ElevenLabs raw generated: ${audioBuffer.byteLength} bytes`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error(`[Job ${jobId}] ElevenLabs failed:`, msg);
    await updateJob(jobId, {
      status: "failed",
      postprocessStatus: "failed",
      postprocessError: `audio_generation_failed: ${msg}`,
    });
    return;
  }

  // raw を R2 に保存
  const rawUrl = await uploadRawAudio(audioBuffer, jobId);
  if (rawUrl) {
    await updateJob(jobId, { rawAudioUrl: rawUrl });
    console.log(`[Job ${jobId}] raw uploaded: ${rawUrl}`);
  } else {
    console.warn(`[Job ${jobId}] raw R2 upload failed (continuing)`);
  }

  // ── Phase 2: postprocess ────────────────────────────────────────────────────
  const preset = choosePostprocessPreset({
    genre:           prompt.genre,
    mood:            prompt.mood,
    structurePreset: prompt.structurePreset,
  });

  await updateJob(jobId, {
    status:                "postprocessing",
    postprocessStatus:     "running",
    postprocessPreset:     preset,
    postprocessStartedAt:  new Date().toISOString(),
    humanizeLevel:         0,
  });

  let postprocessOk = false;
  let finalUrl: string | null = null;
  let finalLufs: number | null = null;
  let finalPeakDb: number | null = null;
  let analysisRecord: Record<string, unknown> = {};

  try {
    const ppResult = await runPostprocess({
      inputPath: rawTempPath,
      jobId,
      preset,
    });

    finalLufs    = ppResult.finalLufs;
    finalPeakDb  = ppResult.finalPeakDb;
    analysisRecord = ppResult.analysis as unknown as Record<string, unknown>;

    console.log(`[Job ${jobId}] postprocess done: lufs=${finalLufs} peak=${finalPeakDb}`);

    // ── Phase 3: uploading_result ──────────────────────────────────────────────
    await updateJob(jobId, { status: "uploading_result" });

    finalUrl = await uploadFinalAudio(ppResult.outputPath, jobId);

    // analysis.json を R2 に保存（失敗は無視）
    await uploadAnalysisJson(analysisRecord, jobId).catch((e) =>
      console.warn(`[Job ${jobId}] analysis.json upload failed:`, e?.message)
    );

    postprocessOk = !!finalUrl;

    await updateJob(jobId, {
      postprocessStatus:      "done",
      postprocessVersion:     ppResult.version,
      postprocessCompletedAt: new Date().toISOString(),
      analysisJson:           JSON.stringify(analysisRecord),
      finalLufs,
      finalPeakDb,
    });

    if (finalUrl) {
      await updateJob(jobId, { processedAudioUrl: finalUrl });
    }
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error(`[Job ${jobId}] postprocess failed:`, msg);
    await updateJob(jobId, {
      postprocessStatus: "failed",
      postprocessError:  msg,
    });
    // postprocess 失敗でも raw があれば completed へフォールバック
  } finally {
    cleanupTempFiles(rawTempPath, finalTempPath);
  }

  // ── Phase 4: transcribing_lyrics（ASR） ───────────────────────────────────────
  // postprocess成否に関わらずASRを試みる。失敗しても completed へ進む。
  const audioUrlForAsr = finalUrl ?? rawUrl ?? undefined;
  if (audioUrlForAsr) {
    try {
      await updateJob(jobId, {
        status:         "transcribing_lyrics",
        asrStatus:      "running",
        asrStartedAt:   new Date().toISOString(),
      });

      const { transcribeSongLyrics } = await import("@/lib/music/asr");
      const asrResult = await transcribeSongLyrics({
        audioUrl:     audioUrlForAsr,
        languageHint: job.prompt.language ?? "ja",
        apiKey,
      });

      await updateJob(jobId, {
        asrLyrics:           asrResult.text,
        lyricsTimestampsJson: asrResult.timestampsJson,
        asrStatus:           "done",
        asrCompletedAt:      new Date().toISOString(),
      });

      // ── Phase 5: merging_lyrics ─────────────────────────────────────────────
      await updateJob(jobId, { status: "merging_lyrics" });

      const { compareLyrics } = await import("@/lib/music/lyrics-compare");
      const { mergeLyricsForDisplay } = await import("@/lib/music/lyrics-merge");

      const singable = job.singableLyrics ?? job.masterLyrics ?? "";
      const compareResult = compareLyrics({
        singableLyrics: singable,
        asrLyrics:      asrResult.text,
      });

      const mergeResult = mergeLyricsForDisplay({
        singableLyrics: singable,
        asrLyrics:      asrResult.text,
        score:          compareResult.score,
      });

      await updateJob(jobId, {
        lyricsMatchScore:    compareResult.score,
        lyricsDiffJson:      compareResult.diffJson,
        displayLyrics:       mergeResult.displayLyrics,
        distributionLyrics:  mergeResult.distributionLyrics,
        lyricsReviewRequired: mergeResult.reviewRequired,
        distributionReady:   mergeResult.distributionReady,
        lyricsSource:        mergeResult.lyricsSource,
      });

      console.log(`[Job ${jobId}] ASR done: score=${compareResult.score} distributionReady=${mergeResult.distributionReady}`);

    } catch (asrErr: any) {
      // ASR失敗: サイレントフォールバック（singable_lyricsをそのまま使用）
      const msg = String(asrErr?.message ?? asrErr);
      console.warn(`[Job ${jobId}] ASR failed (fallback to singable): ${msg}`);
      await updateJob(jobId, {
        asrStatus:           "failed",
        asrError:            msg,
        asrCompletedAt:      new Date().toISOString(),
        lyricsSource:        "singable",
        distributionReady:   false,
        lyricsReviewRequired: true,
      });
    }
  } else {
    // 音声URLが取得できなかった場合もフォールバック
    console.warn(`[Job ${jobId}] No audio URL available for ASR, skipping`);
    await updateJob(jobId, {
      asrStatus:           "failed",
      asrError:            "no_audio_url",
      lyricsSource:        "singable",
      distributionReady:   false,
      lyricsReviewRequired: true,
    });
  }

  // ── Phase 4: completed（または raw フォールバック）─────────────────────────
  const currentJob = await getJob(jobId);
  const rawAudioUrl = currentJob?.rawAudioUrl ?? rawUrl ?? undefined;

  if (postprocessOk && finalUrl) {
    // 正常完了: final を使用
    const updatedRightsLog = mergeRightsLog(currentJob?.rightsLog, {
      type:    "postprocessApplied",
      preset,
      version: "v1",
    });
    await updateJob(jobId, {
      status:      "completed",
      audioUrl:    finalUrl,
      downloadUrl: finalUrl,
      bpFinal:     BP_COSTS.music_full,
      rightsLog:   updatedRightsLog,
    });
    console.log(`[Job ${jobId}] Completed with final: ${finalUrl}`);
  } else {
    // フォールバック: raw を使用
    const fallbackUrl = rawAudioUrl;
    const fallbackReason = postprocessOk
      ? "final_upload_failed"
      : "postprocess_failed";

    const updatedRightsLog = mergeRightsLog(currentJob?.rightsLog, {
      type:   "postprocessFallbackRaw",
      reason: fallbackReason,
    });
    await updateJob(jobId, {
      status:      "completed",
      audioUrl:    fallbackUrl,
      downloadUrl: fallbackUrl,
      bpFinal:     BP_COSTS.music_full,
      rightsLog:   updatedRightsLog,
    });
    console.log(`[Job ${jobId}] Completed with raw fallback (${fallbackReason}): ${fallbackUrl}`);
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────────

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

  // structure 承認ログを記録してからパイプライン開始
  const rightsLog = mergeRightsLog(job.rightsLog, { type: "structureApproved" });
  await updateJob(String(jobId), {
    status:            "generating_audio",
    postprocessStatus: "pending",
    rightsLog,
  });

  const updatedJob = await getJob(String(jobId));
  if (!updatedJob) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  await runAudioPipeline(updatedJob, apiKey);

  const finalJob = await getJob(String(jobId));
  return NextResponse.json({ ok: true, status: finalJob?.status ?? "completed" });
}
