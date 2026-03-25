/**
 * プレセール調達額の動的計算
 * 2026-03-25 12:00 JST を初回加算とし、毎日12時に +172 USDT
 */
export const PRESALE_BASE_MS = new Date("2026-03-25T12:00:00+09:00").getTime();
export const PRESALE_BASE_RAISED = 4852;
export const PRESALE_INCREMENT = 172;

/**
 * 現在時刻 (ms) から調達額を返す
 * - BASE_MS 未満: PRESALE_BASE_RAISED
 * - BASE_MS 以降: BASE_MS を踏んだ時点で +1 回目、以降 24h ごとに +1 回
 */
export function computeRaised(nowMs: number): number {
  if (nowMs < PRESALE_BASE_MS) return PRESALE_BASE_RAISED;
  const daysPassed =
    Math.floor((nowMs - PRESALE_BASE_MS) / 86_400_000) + 1;
  return PRESALE_BASE_RAISED + daysPassed * PRESALE_INCREMENT;
}
