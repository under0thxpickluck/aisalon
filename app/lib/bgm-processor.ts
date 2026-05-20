import Ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

if (ffmpegPath) Ffmpeg.setFfmpegPath(ffmpegPath);

function tmpFile(ext: string): string {
  return path.join(os.tmpdir(), `bgm_${crypto.randomBytes(8).toString("hex")}${ext}`);
}

/** EBU R128 loudness 正規化（-16 LUFS、BGM 標準） */
export function normalizeLoudness(inputPath: string): Promise<string> {
  const outputPath = tmpFile(".wav");
  return new Promise((resolve, reject) => {
    Ffmpeg(inputPath)
      .audioFilters("loudnorm=I=-16:TP=-1.5:LRA=11")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

/** 音声ファイルの長さ（秒）を取得する */
export function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration ?? 0);
    });
  });
}

/**
 * ループベイク: 末尾 crossfadeSec 秒と先頭 crossfadeSec 秒を crossfade で重ねたループファイルを生成する。
 * ブラウザで <audio loop> 再生したときに末尾→先頭が自然に聴こえる。
 */
export async function bakeLoop(inputPath: string, crossfadeSec = 4): Promise<string> {
  const duration = await getAudioDuration(inputPath);
  if (duration <= crossfadeSec * 2) {
    return inputPath;
  }

  const bodyEnd = duration - crossfadeSec;
  const outputPath = tmpFile(".wav");

  const filter = [
    `[0]atrim=end=${bodyEnd}[body]`,
    `[0]atrim=start=${bodyEnd},afade=t=out:st=0:d=${crossfadeSec}[tail_fade]`,
    `[0]atrim=duration=${crossfadeSec},afade=t=in:st=0:d=${crossfadeSec}[head_fade]`,
    `[tail_fade][head_fade]amix=inputs=2:duration=longest[xfade]`,
    `[body][xfade]concat=n=2:v=0:a=1[out]`,
  ].join(";");

  return new Promise((resolve, reject) => {
    Ffmpeg(inputPath)
      .complexFilter(filter, "out")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

/**
 * Pro 用 EQ + 軽いリバーブ加工。
 * - low shelf +2dB @ 120Hz（warmth）
 * - high shelf +2dB @ 8kHz（air）
 * - aecho で軽いホールリバーブ感
 */
export function applyProEffects(inputPath: string): Promise<string> {
  const outputPath = tmpFile(".wav");
  return new Promise((resolve, reject) => {
    Ffmpeg(inputPath)
      .audioFilters([
        "equalizer=f=120:width_type=o:width=2:g=2",
        "equalizer=f=8000:width_type=o:width=2:g=2",
        "aecho=0.8:0.9:40:0.2",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

/**
 * シームレスループを N 回繰り返して長尺ファイルを作る。
 * targetSec に最も近い繰り返し数を自動計算する（最低 2 回）。
 */
export async function extendLoop(
  inputPath: string,
  targetSec = 180
): Promise<string> {
  const duration = await getAudioDuration(inputPath);
  const repeatCount = Math.max(2, Math.ceil(targetSec / duration));
  const outputPath = tmpFile(".wav");

  const inputs = Array.from({ length: repeatCount }, (_, i) => `[${i}]`).join("");
  const filterStr = `${inputs}concat=n=${repeatCount}:v=0:a=1[out]`;

  return new Promise((resolve, reject) => {
    let cmd = Ffmpeg();
    for (let i = 0; i < repeatCount; i++) cmd = cmd.input(inputPath);
    cmd
      .complexFilter(filterStr, "out")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

/** 一時ファイルを削除する（エラーは無視） */
export function cleanupTmp(...paths: string[]): void {
  for (const p of paths) {
    if (p && p.startsWith(os.tmpdir())) {
      fs.unlink(p, () => {});
    }
  }
}
