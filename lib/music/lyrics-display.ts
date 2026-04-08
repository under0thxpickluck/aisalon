// lib/music/lyrics-display.ts
// singableLyrics と asrLyrics を行単位でマージして displayLyrics を確定する。
// 「比較用正規化」と「表示向け正規化」は明確に分離している。
// normalizeAsrLineForDisplay は表示向け軽整形のみで情報を削りすぎない。

const SIMILARITY_THRESHOLD_DEFAULT = 0.68;
const SIMILARITY_THRESHOLD_SHORT   = 0.82; // singable 行が 4 文字以内の場合
const SHORT_LINE_MAX_LEN           = 4;
const WINDOW_HALF                  = 3;
const DEDUP_MAX_CONSECUTIVE        = 2;

// ── バイグラム Jaccard（行レベル）────────────────────────────────────────────
// lyrics-compare.ts の関数と同ロジック。循環参照を避けるため独立実装。

function buildBigrams(str: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str[i] + str[i + 1];
    freq.set(bg, (freq.get(bg) ?? 0) + 1);
  }
  return freq;
}

export function bigramJaccardLine(a: string, b: string): number {
  if (a.length <= 1 || b.length <= 1) return 0;
  const freqA = buildBigrams(a);
  const freqB = buildBigrams(b);

  let intersection = 0;
  freqA.forEach((countA, bg) => {
    intersection += Math.min(countA, freqB.get(bg) ?? 0);
  });

  const totalA = Math.max(0, a.length - 1);
  const totalB = Math.max(0, b.length - 1);
  const union  = totalA + totalB - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

// ── ノイズ行判定 ──────────────────────────────────────────────────────────────

export function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4)        return true; // 極端に短い
  if (/^[\s\W]+$/.test(t)) return true; // 記号・空白のみ
  if (/^\[/.test(t))       return true; // セクションタグ
  return false;
}

// ── ASR 行の表示向け正規化 ────────────────────────────────────────────────────
// 目的: 表示向けに軽く整形するのみ。比較用に情報を削らない。
// normalizeLyricsForCompare() は呼ばない。

export function normalizeAsrLineForDisplay(line: string): string {
  let s = line.trim();
  s = s.replace(/\s+/g, " ");                 // 連続空白を1つに圧縮
  s = s.replace(/^[-・•]\s*/, "");            // 行頭の記号プレフィックスを除去
  return s;
}

// ── 同一行の過剰連続圧縮 ──────────────────────────────────────────────────────
// 3連続以上の同一行を DEDUP_MAX_CONSECUTIVE（2）行に圧縮する。

function dedupeSequentialLines(lines: string[]): string[] {
  const result: string[]  = [];
  let consecutiveCount    = 0;
  let lastLine            = "";

  for (const line of lines) {
    if (line === lastLine) {
      consecutiveCount++;
      if (consecutiveCount <= DEDUP_MAX_CONSECUTIVE) {
        result.push(line);
      }
    } else {
      result.push(line);
      consecutiveCount = 1;
      lastLine         = line;
    }
  }
  return result;
}

// ── ウィンドウ付き逐次マッチング ──────────────────────────────────────────────

export function mergeSingableWithAsr(
  singable: string,
  asr: string
): { displayLyrics: string; replacedCount: number; keptCount: number } {
  const singableLines = singable.split("\n");

  // ASR 行を表示向け正規化してノイズフィルタ
  const asrLines = asr
    .split("\n")
    .map(normalizeAsrLineForDisplay)
    .filter((l) => !isNoiseLine(l));

  const asrUsed     = new Set<number>();
  let   asrPtr      = 0;
  let   replacedCount = 0;
  let   keptCount     = 0;
  const result: string[] = [];

  for (const singableLine of singableLines) {
    const trimmed = singableLine.trim();

    // セクションタグはそのまま保持（比較対象にしない）
    if (/^\[.*\]$/.test(trimmed)) {
      result.push(singableLine);
      continue;
    }

    // 空行はそのまま保持
    if (trimmed.length === 0) {
      result.push(singableLine);
      continue;
    }

    // ウィンドウ内の候補を探す
    const windowStart = Math.max(0, asrPtr - WINDOW_HALF);
    const windowEnd   = Math.min(asrLines.length - 1, asrPtr + WINDOW_HALF);

    let bestIdx = -1;
    let bestSim = -1;

    for (let i = windowStart; i <= windowEnd; i++) {
      if (asrUsed.has(i)) continue;
      const sim = bigramJaccardLine(trimmed, asrLines[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    // 採用閾値: 短い行は厳しく
    const threshold = trimmed.length <= SHORT_LINE_MAX_LEN
      ? SIMILARITY_THRESHOLD_SHORT
      : SIMILARITY_THRESHOLD_DEFAULT;

    // ASR行が元行の35%未満の長さなら切り捨て（短すぎるASR結果が置き換わるのを防ぐ）
    const lengthRatioOk =
      bestIdx >= 0 && asrLines[bestIdx].length >= trimmed.length * 0.35;

    const shouldAdopt =
      bestIdx >= 0 &&
      bestSim >= threshold &&
      !isNoiseLine(asrLines[bestIdx]) &&
      lengthRatioOk;

    if (shouldAdopt) {
      result.push(asrLines[bestIdx]);
      asrUsed.add(bestIdx);
      asrPtr = bestIdx + 1;
      replacedCount++;
    } else {
      result.push(singableLine);
      keptCount++;
    }
  }

  const dedupedLines = dedupeSequentialLines(result);
  return {
    displayLyrics: dedupedLines.join("\n"),
    replacedCount,
    keptCount,
  };
}

// ── top-level: displayLyrics 確定（フォールバック込み）────────────────────────

export function finalizeDisplayLyrics(
  singable: string,
  asr: string | null | undefined,
  jobId?: string
): { displayLyrics: string; lyricsSource: "singable" | "asr_merged"; removedNoise: number } {
  const tag = jobId ? `[merge][jobId=${jobId}]` : "[merge]";

  // フォールバック: ASR なし
  if (!asr || asr.trim().length === 0) {
    console.log(`${tag} fallback reason=asr_unavailable`);
    return { displayLyrics: singable, lyricsSource: "singable", removedNoise: 0 };
  }

  // ASR の行数確認（ノイズフィルタ前後）
  const rawLines      = asr.split("\n").map(normalizeAsrLineForDisplay);
  const filteredLines = rawLines.filter((l) => !isNoiseLine(l));
  const removedNoise  = rawLines.length - filteredLines.length;

  console.log(`${tag} asr available=true asrRawLength=${asr.length}`);

  if (filteredLines.length === 0) {
    console.log(`${tag} fallback reason=asr_empty_after_filter`);
    return { displayLyrics: singable, lyricsSource: "singable", removedNoise };
  }

  // singable のコンテンツ行数（セクションタグ・空行を除く）
  const singableContentLines = singable
    .split("\n")
    .filter((l) => l.trim().length > 0 && !/^\[.*\]$/.test(l.trim()));

  console.log(
    `${tag} singableLines=${singableContentLines.length} asrLines=${filteredLines.length} removedNoise=${removedNoise}`
  );

  // マージ実行
  try {
    const { displayLyrics, replacedCount, keptCount } = mergeSingableWithAsr(singable, asr);
    const lyricsSource: "singable" | "asr_merged" = replacedCount > 0 ? "asr_merged" : "singable";

    console.log(
      `${tag} replaced=${replacedCount} kept=${keptCount} finalDisplayLength=${displayLyrics.length} lyricsSource=${lyricsSource}`
    );

    return { displayLyrics, lyricsSource, removedNoise };
  } catch (e) {
    console.warn(`${tag} fallback reason=merge_exception`, e);
    return { displayLyrics: singable, lyricsSource: "singable", removedNoise };
  }
}
