// LINE Sticker Studio の BP 価格表。
//
// 1BP ≒ $0.01（BPパック 500BP = $5 / app/lib/bp-config.ts）で換算している。
// gpt-image-1 1024x1024 の実売単価は概ね medium $0.042 / high $0.167。

import type { StickerCount } from "./types";
import { isValidStickerCount } from "./line_spec";

export const STICKER_BP = {
  // キャラクター基準画像（high 1枚 + medium 2枚）— 原価 約$0.25
  character: 50,
  // 1枚だけの再生成 — 原価 約$0.042
  regenerate: 15,
  // 文字の変更・LINE規格変換・ZIP書き出しは再生成を伴わないため無料
  textEdit: 0,
  export: 0,
} as const;

// 枚数パック（一括先払い）
// LINEが受け付ける枚数はすべて定義しておく。
// 既に作りかけのプロジェクトが最後まで進めるようにするため、
// 提供をやめた枚数の価格も消さない。
//
// 提供中の枚数の建て付け（キャラ作成50BPは別途）:
//   8個 …… 1枚30BP × 8 = 240BP（+50BP = 合計290BP）
//  16個 …… 1枚25BP × 16 = 400BP（+50BP = 合計450BP）
export const STICKER_PACK_BP: Record<StickerCount, number> = {
  8: 240,
  16: 400,
  24: 320,
  32: 420,
  40: 500,
};

/**
 * 画面で選べる枚数。
 *
 * LINEは 8/16/24/32/40 を受け付けるが（line_spec.ts の allowedCounts）、
 * 現状は 8 と 16 だけを提供する。24枚以上は完成まで5分以上かかり、
 * 途中離脱や失敗の影響が大きいため。
 */
export const OFFERED_COUNTS = [8, 16] as const;

export function isOfferedCount(n: number): n is StickerCount {
  return (OFFERED_COUNTS as readonly number[]).includes(n);
}

export function packCost(count: number): number {
  if (!isValidStickerCount(count)) {
    throw new Error(`invalid_sticker_count: ${count}`);
  }
  return STICKER_PACK_BP[count];
}

/** パック購入で得られる生成クレジット数（＝枚数） */
export function creditsForPack(count: number): number {
  if (!isValidStickerCount(count)) {
    throw new Error(`invalid_sticker_count: ${count}`);
  }
  return count;
}

/** 1枚あたりの実効BP。UIで「1枚あたり○BP」と出すため。 */
export function bpPerSticker(count: number): number {
  return Math.round((packCost(count) / count) * 10) / 10;
}

export type StickerCostPlan = {
  characterBp: number;
  packBp: number;
  totalBp: number;
  credits: number;
  perSticker: number;
};

/**
 * キャラクター未生成の状態から最後までにかかる総BP。
 * キャラ生成済みなら characterAlreadyPaid = true を渡す。
 */
export function planCost(
  count: number,
  characterAlreadyPaid: boolean
): StickerCostPlan {
  const characterBp = characterAlreadyPaid ? 0 : STICKER_BP.character;
  const pack = packCost(count);
  return {
    characterBp,
    packBp: pack,
    totalBp: characterBp + pack,
    credits: creditsForPack(count),
    perSticker: bpPerSticker(count),
  };
}
