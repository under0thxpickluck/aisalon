// app/api/song/approve-structure/route.ts
import { NextResponse } from "next/server";
import { getJob, updateJob, type SongJob } from "../_jobStore";
import { BP_COSTS } from "@/lib/bp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 1セクション分を生成してURLを返すヘルパー
async function generateSection(sectionPrompt: string, token: string): Promise<string> {
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      input: {
        prompt: sectionPrompt,
        duration: 30,
        model_version: "stereo-large",
        output_format: "wav",
      },
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(`replicate_error: ${JSON.stringify(errData)}`);
  }

  const prediction = await createRes.json();
  console.log('[song/audio] replicate response:', JSON.stringify(prediction, null, 2));

  const predictionId = String(prediction.id ?? "");
  if (!predictionId) throw new Error("no_prediction_id");

  // 完了までポーリング（最大5分）
  const maxWait = 5 * 60 * 1000;
  const pollInterval = 3_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const poll = await pollRes.json().catch(() => ({ status: "unknown" }));

    if (poll.status === "succeeded") {
      const outputUrl = Array.isArray(poll.output) ? poll.output[0] : poll.output;
      if (!outputUrl) throw new Error("no_output_url");
      return String(outputUrl);
    }

    if (poll.status === "failed" || poll.status === "canceled") {
      throw new Error(`replicate_${poll.status}`);
    }
  }

  throw new Error("replicate_timeout");
}

async function generateAudioBackground(job: SongJob, token: string): Promise<void> {
  const { jobId, structureData, prompt } = job;

  console.log('[song/audio] starting replicate generation, jobId:', jobId);
  console.log('[song/audio] REPLICATE_API_TOKEN present:', !!process.env.REPLICATE_API_TOKEN);

  try {
    const qualitySuffix =
      "high quality, no noise, clean audio, professional recording, no distortion, clear sound, studio quality";

    const basePrompt = [
      prompt.genre,
      prompt.mood,
      `${structureData?.bpm ?? 120} BPM`,
      structureData?.key ?? "C major",
      "instrumental",
    ]
      .filter(Boolean)
      .join(", ");

    const sections: Array<{
      name: string;
      prefix: string;
      stage: "intro" | "verse" | "chorus" | "outro";
    }> = [
      { name: "intro",  prefix: "intro section, gentle opening, establishing melody", stage: "intro" },
      { name: "verse",  prefix: "verse section, main melody",                         stage: "verse" },
      { name: "chorus", prefix: "chorus section, peak energy, hook",                  stage: "chorus" },
      { name: "outro",  prefix: "outro section, gentle ending, fade out",             stage: "outro" },
    ];

    const sectionUrls: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      console.log(`[song/audio] generating section ${i + 1}/4: ${sec.name}`);
      updateJob(jobId, { stage: sec.stage });

      const sectionPrompt = [sec.prefix, basePrompt, qualitySuffix].join(", ");
      const url = await generateSection(sectionPrompt, token);
      sectionUrls.push(url);
    }

    // Renderサーバーでセクションを結合
    console.log('[song/audio] merging sections, jobId:', jobId);
    updateJob(jobId, { stage: "merging" });

    const mergeServerUrl = process.env.MERGE_SERVER_URL;
    console.log('[song/audio] MERGE_SERVER_URL:', mergeServerUrl);
    if (!mergeServerUrl) throw new Error("merge_server_url_missing");

    // ヘルスチェック（Renderのスリープ復帰確認）
    const healthRes = await fetch(`${mergeServerUrl}/health`).catch((e: any) => {
      console.error('[song/audio] merge server health check failed', e);
      throw e;
    });
    if (!healthRes.ok) {
      console.error('[song/audio] merge server health check failed', healthRes.status);
      throw new Error(`health_check_failed: ${healthRes.status}`);
    }
    console.log('[song/audio] merge server health check ok');

    console.log('[song/audio] sending to merge server:', sectionUrls);
    const mergeController = new AbortController();
    const mergeTimeout = setTimeout(() => mergeController.abort(), 120000);
    let mergeRes: Response;
    try {
      mergeRes = await fetch(`${mergeServerUrl}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: sectionUrls, job_id: jobId }),
        signal: mergeController.signal,
      });
    } catch (mergeErr: any) {
      clearTimeout(mergeTimeout);
      console.error('[song/audio] merge server error:', mergeErr);
      throw mergeErr;
    }
    clearTimeout(mergeTimeout);

    if (!mergeRes.ok) {
      const errData = await mergeRes.json().catch(() => ({}));
      const errMsg = `merge_error: ${JSON.stringify(errData)}`;
      console.error('[song/audio] merge server error:', errMsg);
      throw new Error(errMsg);
    }

    const mergeResult = await mergeRes.json();
    console.log('[song/audio] merge response:', mergeResult);
    console.log('[song/audio] merge result:', JSON.stringify(mergeResult, null, 2));

    const mergedUrl = mergeResult.url ?? mergeResult.audio_url ?? mergeResult.output_url ?? "";
    if (!mergedUrl) throw new Error("no_merged_url");

    updateJob(jobId, {
      status: "completed",
      audioUrl: String(mergedUrl),
      downloadUrl: String(mergedUrl),
      bpFinal: BP_COSTS.music_full,
    });
  } catch (err: any) {
    console.error('[song/audio] merge failed:', err);
    console.error('[song/audio] error:', err);
    console.error('[song/audio] error stack:', err?.stack);
    updateJob(jobId, { status: "failed", error: String(err?.message ?? err) });
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

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId_required" }, { status: 400 });
  }
  if (approved !== true) {
    return NextResponse.json({ ok: false, error: "approved_must_be_true" }, { status: 400 });
  }

  const job = getJob(String(jobId));
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }
  if (job.status !== "structure_ready") {
    return NextResponse.json(
      { ok: false, error: "invalid_status", status: job.status },
      { status: 400 }
    );
  }

  updateJob(String(jobId), {
    status: "audio_generating",
    rightsLog: { ...job.rightsLog, structureApproved: true },
  });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    updateJob(String(jobId), { status: "failed", error: "replicate_token_missing" });
    return NextResponse.json({ ok: true, status: "audio_generating" });
  }

  const updatedJob = getJob(String(jobId))!;
  generateAudioBackground(updatedJob, token);

  return NextResponse.json({ ok: true, status: "audio_generating" });
}
