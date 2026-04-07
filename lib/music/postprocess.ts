// lib/music/postprocess.ts
// 方式A: Node + FFmpeg による後加工
// 将来 Python サービス化時は runPostprocess の中身だけ差し替える

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { PRESETS, type PostprocessPreset, type PresetParams } from "./presets";
import { analyzeAudio, type AudioAnalysis } from "./analyze";

const execFileAsync = promisify(execFile);

export type { PostprocessPreset };

export type PostprocessResult = {
  outputPath: string;
  analysis: AudioAnalysis;
  finalLufs: number | null;
  finalPeakDb: number | null;
  preset: PostprocessPreset;
  version: string;
};

const POSTPROCESS_VERSION = "v1";

function getFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require("ffmpeg-static");
    return ffmpegStatic as string;
  } catch {
    return "ffmpeg";
  }
}

/** PresetParams から FFmpeg audio filter 文字列を組み立てる */
function buildFilterChain(p: PresetParams): string {
  const filters: string[] = [];

  // 1. Low shelf boost (bass boost)
  filters.push(
    `bass=gain=${p.lowBoostGain}:frequency=${p.lowBoostFreq}:width_type=s:width=0.5`
  );

  // 2. High shelf cut (high cut)
  filters.push(
    `treble=gain=${p.highCutGain}:frequency=${p.highCutFreq}:width_type=s:width=0.5`
  );

  // 3. Compressor
  //    threshold=-20dB は固定（全プリセット共通）、ratio はプリセットで変化
  filters.push(
    `acompressor=ratio=${p.compressorRatio}:threshold=-20dB:attack=10:release=80:makeup=2dB`
  );

  // 4. Reverb (aecho による簡易実装)
  //    in_gain=0.8, out_gain=0.9, delays, decays
  filters.push(
    `aecho=0.8:0.9:${p.reverbDelay}:${p.reverbDecay}`
  );

  // 5. Loudness normalization (EBU R128)
  filters.push(
    `loudnorm=I=${p.targetLufs}:TP=${p.truePeakTarget}:LRA=11:linear=true`
  );

  return filters.join(",");
}

/**
 * raw 音源を読み取り、preset に応じた EQ/Comp/Reverb/Loudness を適用して final を生成する。
 * 将来 Python worker 化する際はこの関数を差し替えるだけでよい。
 */
export async function runPostprocess(params: {
  inputPath: string;
  jobId: string;
  preset: PostprocessPreset;
}): Promise<PostprocessResult> {
  const { inputPath, jobId, preset } = params;
  const p = PRESETS[preset];
  const filterChain = buildFilterChain(p);

  // 出力パスを /tmp に生成
  const outputPath = path.join(os.tmpdir(), `${jobId}_final.wav`);

  const ffmpegPath = getFfmpegPath();
  const args = [
    "-y",            // overwrite if exists
    "-i", inputPath,
    "-af", filterChain,
    "-c:a", "pcm_s16le",
    "-ar", "44100",
    outputPath,
  ];

  console.log(`[postprocess] jobId=${jobId} preset=${preset}`);
  console.log(`[postprocess] filter: ${filterChain}`);

  try {
    const { stderr } = await execFileAsync(ffmpegPath, args, {
      timeout: 180_000,  // 3分タイムアウト
      maxBuffer: 1024 * 1024,
    });
    if (stderr) {
      // FFmpeg は進捗を stderr に出すが、エラーかどうかは exit code で判断される
      console.log(`[postprocess] ffmpeg stderr (last 500): ${stderr.slice(-500)}`);
    }
  } catch (err: any) {
    console.error(`[postprocess] ffmpeg failed:`, err?.message);
    throw new Error(`postprocess_ffmpeg_failed: ${err?.message ?? err}`);
  }

  // 加工後の音源を解析
  const analysis = await analyzeAudio(outputPath);

  return {
    outputPath,
    analysis,
    finalLufs:  analysis.lufs,
    finalPeakDb: analysis.peakDb,
    preset,
    version: POSTPROCESS_VERSION,
  };
}

// ── 将来実装予定の枠（Phase 2-3 用プレースホルダー） ──────────────────────────

/** [将来] タイム揺らぎ（humanize）処理 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function applyHumanize(_params: {
  inputPath: string;
  level: number;  // 0 = off, 1-3 = strength
}): Promise<void> {
  // Phase 3 で実装予定
}

/** [将来] ピッチ揺らぎ処理 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function applyPitchVariation(_params: {
  inputPath: string;
}): Promise<void> {
  // Phase 3 で実装予定
}

/** [将来] ボーカル/インスト分離 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function separateVocalInstrumental(_params: {
  inputPath: string;
}): Promise<{ vocalPath: string; instrumentalPath: string }> {
  // Phase 3 で実装予定
  throw new Error("not_implemented");
}
