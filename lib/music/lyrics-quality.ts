// lib/music/lyrics-quality.ts
// 歌詞品質スコアの統合計算

import { normalizeLyricsForCompare } from "./lyrics-normalize";

/**
 * 7軸スコアから統合 lyricsQualityScore を計算する。
 *
 * lyricsQualityScore =
 *   baseCompareScore    * 0.55
 * + anchorRetentionScore * 0.20
 * + hookRetentionScore   * 0.20
 * - repeatPenalty        * 0.15
 * + orderBonus           * 0.05
 */
export function computeLyricsQuality(params: {
  singableLyrics: string;
  asrLyrics: string;
  anchorWords: string[];
  hookLines: string[];
  baseCompareScore: number;  // compareLyrics の score (0-100)
  repeatScore: number;       // detectRepetition の repeatScore (0-100)
}): {
  lyricsQualityScore: number;
  anchorRetentionScore: number;
  hookRetentionScore: number;
} {
  const { asrLyrics, anchorWords, hookLines, baseCompareScore, repeatScore } = params;

  // anchorRetentionScore: anchorWords の何% が asrLyrics に含まれるか
  const anchorRetentionScore = computeAnchorRetention(asrLyrics, anchorWords);

  // hookRetentionScore: hookLines の何% が asrLyrics に類似しているか
  const hookRetentionScore = computeHookRetention(asrLyrics, hookLines);

  // orderBonus: baseCompareScore から order 軸のボーナス（スコアが高いほど加点）
  const orderBonus = Math.min(100, baseCompareScore);

  // 最終スコア計算
  const raw =
    baseCompareScore     * 0.55 +
    anchorRetentionScore * 0.20 +
    hookRetentionScore   * 0.20 -
    repeatScore          * 0.15 +
    orderBonus           * 0.05;

  const lyricsQualityScore = Math.min(100, Math.max(0, Math.round(raw)));

  return { lyricsQualityScore, anchorRetentionScore, hookRetentionScore };
}

/** anchorWords の保持率を 0-100 で返す */
function computeAnchorRetention(asrLyrics: string, anchorWords: string[]): number {
  if (anchorWords.length === 0) return 80; // データなしは中立値

  const normAsr = normalizeLyricsForCompare(asrLyrics);
  let matched = 0;

  for (const word of anchorWords) {
    const normWord = normalizeLyricsForCompare(word);
    if (normWord.length >= 2 && normAsr.includes(normWord)) {
      matched++;
    }
  }

  return Math.round((matched / anchorWords.length) * 100);
}

/** hookLines の保持率を 0-100 で返す */
function computeHookRetention(asrLyrics: string, hookLines: string[]): number {
  if (hookLines.length === 0) return 80; // データなしは中立値

  const normAsr = normalizeLyricsForCompare(asrLyrics);
  const asrWords = new Set(normAsr.split(/\s+/).filter(w => w.length > 0));
  let totalScore = 0;

  for (const hookLine of hookLines) {
    const normHook = normalizeLyricsForCompare(hookLine);
    const hookWords = normHook.split(/\s+/).filter(w => w.length > 0);

    if (hookWords.length === 0) continue;

    // hookLine の単語が asrLyrics にどれだけ含まれるか
    let matchedWords = 0;
    for (const w of hookWords) {
      if (w.length >= 2 && (asrWords.has(w) || normAsr.includes(w))) {
        matchedWords++;
      }
    }

    totalScore += (matchedWords / hookWords.length) * 100;
  }

  return Math.round(totalScore / hookLines.length);
}
