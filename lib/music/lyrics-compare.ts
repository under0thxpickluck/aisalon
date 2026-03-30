// lib/music/lyrics-compare.ts

import { normalizeLyricsForCompare, splitIntoLines } from "./lyrics-normalize";

export type CompareResult = {
  score: number;   // 0〜100
  diffJson: string; // JSON文字列
};

/** Build a set of character bigrams from a string. */
function buildBigrams(str: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str[i] + str[i + 1];
    freq.set(bg, (freq.get(bg) ?? 0) + 1);
  }
  return freq;
}

/** Jaccard similarity on bigram multisets. */
function bigramJaccard(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const freqA = buildBigrams(a);
  const freqB = buildBigrams(b);

  let intersection = 0;
  freqA.forEach((countA, bg) => {
    const countB = freqB.get(bg) ?? 0;
    intersection += Math.min(countA, countB);
  });

  const totalA = Math.max(0, a.length - 1);
  const totalB = Math.max(0, b.length - 1);
  const union = totalA + totalB - intersection;

  if (union === 0) return 1;
  return intersection / union;
}

/** Build word frequency map. */
function buildFreqMap(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

/** LCS length via standard DP table. */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Use two rows to save memory
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[n];
}

export function compareLyrics(params: {
  singableLyrics: string;
  asrLyrics: string;
}): CompareResult {
  const { singableLyrics, asrLyrics } = params;

  const normSingable = normalizeLyricsForCompare(singableLyrics);
  const normAsr = normalizeLyricsForCompare(asrLyrics);

  // --- Axis 1: Character-level bigram Jaccard similarity (25pts) ---
  const jaccard = bigramJaccard(normSingable, normAsr);
  const axis1 = jaccard * 25;

  // --- Axis 2: Line match rate (25pts) ---
  const singableLines = splitIntoLines(normSingable);
  const asrLines = splitIntoLines(normAsr);

  let axis2: number;
  if (singableLines.length === 0 && asrLines.length === 0) {
    axis2 = 25;
  } else {
    const asrLineSet = new Set(asrLines);
    let lineMatchCount = 0;
    for (const line of singableLines) {
      if (asrLineSet.has(line)) lineMatchCount++;
    }
    const denom = Math.max(singableLines.length, asrLines.length);
    axis2 = (lineMatchCount / denom) * 25;
  }

  // --- Axis 3: Word match rate (25pts) ---
  const singableWords = normSingable.split(" ").filter((w) => w.length > 0);
  const asrWords = normAsr.split(" ").filter((w) => w.length > 0);

  let axis3: number;
  if (singableWords.length === 0 && asrWords.length === 0) {
    axis3 = 25;
  } else {
    const singableFreq = buildFreqMap(singableWords);
    const asrFreq = buildFreqMap(asrWords);
    let wordMatchCount = 0;
    singableFreq.forEach((countS, w) => {
      const countA = asrFreq.get(w) ?? 0;
      wordMatchCount += Math.min(countS, countA);
    });
    const denom = Math.max(singableWords.length, asrWords.length);
    axis3 = (wordMatchCount / denom) * 25;
  }

  // --- Axis 4: Order preservation via LCS (25pts) ---
  let axis4: number;
  if (singableWords.length === 0 && asrWords.length === 0) {
    axis4 = 25;
  } else {
    const lcs = lcsLength(singableWords, asrWords);
    const denom = Math.max(singableWords.length, asrWords.length);
    axis4 = (lcs / denom) * 25;
  }

  // --- Final score ---
  const total = axis1 + axis2 + axis3 + axis4;
  const score = Math.min(100, Math.max(0, Math.round(total)));

  const diffJson = JSON.stringify({
    axis1_chars: Math.round(axis1 * 10) / 10,
    axis2_lines: Math.round(axis2 * 10) / 10,
    axis3_words: Math.round(axis3 * 10) / 10,
    axis4_order: Math.round(axis4 * 10) / 10,
    total: Math.round(total * 10) / 10,
  });

  return { score, diffJson };
}
