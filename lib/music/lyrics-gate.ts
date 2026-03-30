// lib/music/lyrics-gate.ts
// lyricsQualityScore と repeatScore から pass/review/reject を判定する

/**
 * 品質ゲート判定。
 *
 * | lyricsQualityScore | repeatScore | 判定    |
 * |--------------------|-------------|---------|
 * | 90以上             | < 15        | pass    |
 * | 80〜89             | any         | review  |
 * | 65〜79             | < 35        | review  |
 * | 65未満             | any         | reject  |
 * | any                | >= 35       | reject以上（少なくとも review）|
 */
export function gateLyricsQuality(params: {
  lyricsQualityScore: number;
  repeatScore: number;
}): {
  gate: "pass" | "review" | "reject";
  distributionReady: boolean;
  reviewRequired: boolean;
} {
  const { lyricsQualityScore, repeatScore } = params;

  // 強反復は常に reject
  if (repeatScore >= 60) {
    return { gate: "reject", distributionReady: false, reviewRequired: true };
  }

  // 高品質
  if (lyricsQualityScore >= 90 && repeatScore < 15) {
    return { gate: "pass", distributionReady: true, reviewRequired: false };
  }

  // 軽微ずれ (review)
  if (lyricsQualityScore >= 80) {
    return { gate: "review", distributionReady: true, reviewRequired: false };
  }

  // 中程度ずれ (review、配信不可)
  if (lyricsQualityScore >= 65 && repeatScore < 35) {
    return { gate: "review", distributionReady: false, reviewRequired: true };
  }

  // 重度ずれ / 反復あり → reject
  return { gate: "reject", distributionReady: false, reviewRequired: true };
}
