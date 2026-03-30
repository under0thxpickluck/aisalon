// lib/music/analyze.ts

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type AudioAnalysis = {
  durationSec: number;
  peakDb: number | null;
  rmsDb: number | null;
  lufs: number | null;
  // 将来拡張用
  sampleRate?: number;
  channels?: number;
};

function getFfprobePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
    return ffprobeInstaller.path as string;
  } catch {
    return "ffprobe";
  }
}

function getFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require("ffmpeg-static");
    return ffmpegStatic as string;
  } catch {
    return "ffmpeg";
  }
}

/** ffprobe で duration / sampleRate / channels を取得 */
async function probeBasicInfo(inputPath: string): Promise<{
  durationSec: number;
  sampleRate: number;
  channels: number;
}> {
  const ffprobePath = getFfprobePath();
  const args = [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-select_streams", "a:0",
    inputPath,
  ];

  try {
    const { stdout } = await execFileAsync(ffprobePath, args, { timeout: 30_000 });
    const json = JSON.parse(stdout);
    const stream = json?.streams?.[0] ?? {};
    return {
      durationSec: parseFloat(stream.duration ?? "0") || 0,
      sampleRate: parseInt(stream.sample_rate ?? "44100", 10) || 44100,
      channels: parseInt(stream.channels ?? "2", 10) || 2,
    };
  } catch (e) {
    console.warn("[analyze] ffprobe failed, using defaults:", e);
    return { durationSec: 0, sampleRate: 44100, channels: 2 };
  }
}

/** ffmpeg の astats フィルタで peak / RMS を取得 */
async function probeAstats(inputPath: string): Promise<{
  peakDb: number | null;
  rmsDb: number | null;
}> {
  const ffmpegPath = getFfmpegPath();
  const args = [
    "-i", inputPath,
    "-af", "astats=metadata=1:reset=1",
    "-f", "null",
    "-",
  ];

  try {
    // astats は stderr に出力される
    const { stderr } = await execFileAsync(ffmpegPath, args, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });

    const peakMatch = stderr.match(/Peak level dB:\s*([-\d.]+)/);
    const rmsMatch  = stderr.match(/RMS level dB:\s*([-\d.]+)/);

    return {
      peakDb: peakMatch ? parseFloat(peakMatch[1]) : null,
      rmsDb:  rmsMatch  ? parseFloat(rmsMatch[1])  : null,
    };
  } catch (e) {
    console.warn("[analyze] astats failed:", e);
    return { peakDb: null, rmsDb: null };
  }
}

/** ffmpeg の loudnorm フィルタで LUFS を取得 */
async function probeLufs(inputPath: string): Promise<number | null> {
  const ffmpegPath = getFfmpegPath();
  const args = [
    "-i", inputPath,
    "-af", "loudnorm=print_format=json",
    "-f", "null",
    "-",
  ];

  try {
    const { stderr } = await execFileAsync(ffmpegPath, args, {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });

    // loudnorm は stderr に JSON を出力
    const jsonMatch = stderr.match(/\{[\s\S]*"input_i"\s*:\s*"([-\d.]+)"/);
    if (jsonMatch) {
      return parseFloat(jsonMatch[1]);
    }

    // fallback: 直接 input_i を探す
    const lufsMatch = stderr.match(/"input_i"\s*:\s*"([-\d.inf]+)"/);
    if (lufsMatch) {
      const val = parseFloat(lufsMatch[1]);
      return isFinite(val) ? val : null;
    }
    return null;
  } catch (e) {
    console.warn("[analyze] loudnorm analysis failed:", e);
    return null;
  }
}

/** 音源ファイルを解析して AudioAnalysis を返す */
export async function analyzeAudio(inputPath: string): Promise<AudioAnalysis> {
  const [basic, astats, lufs] = await Promise.all([
    probeBasicInfo(inputPath),
    probeAstats(inputPath),
    probeLufs(inputPath),
  ]);

  return {
    durationSec: basic.durationSec,
    peakDb:      astats.peakDb,
    rmsDb:       astats.rmsDb,
    lufs,
    sampleRate:  basic.sampleRate,
    channels:    basic.channels,
  };
}
