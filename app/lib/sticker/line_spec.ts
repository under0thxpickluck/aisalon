// LINE Creators Market 通常スタンプの規格。
//
// ⚠️ LINE側の仕様が変わったときは、このファイルだけを修正すれば全体が追随する。
// 他のファイルに規格の数値を直接書かないこと。

import type { StickerCount } from "./types";

export const LINE_SPEC = {
  // スタンプ画像（最大サイズ）
  sticker: { maxWidth: 370, maxHeight: 320 },
  // メイン画像
  main: { width: 240, height: 240 },
  // トークルームタブ画像
  tab: { width: 96, height: 74 },

  // イラスト周囲に確保する余白
  padding: 10,

  // 1画像あたりの上限
  maxFileBytes: 1024 * 1024, // 1MB
  // ZIP一括提出時の上限
  maxZipBytes: 60 * 1024 * 1024, // 60MB

  titleMaxLength: 40,
  descriptionMaxLength: 160,

  allowedCounts: [8, 16, 24, 32, 40] as const,
} as const;

export type BoxSize = { width: number; height: number };

/** LINEは縦横とも偶数pxを要求する。2未満にはしない。 */
export function toEven(n: number): number {
  const floored = Math.floor(n);
  const even = floored - (floored % 2);
  return even < 2 ? 2 : even;
}

/**
 * アスペクト比を保ったまま box に収まる寸法を返す（contain）。
 * 拡大はしない — 元画像より大きくすると輪郭がぼやけるため。
 */
export function fitContain(
  srcWidth: number,
  srcHeight: number,
  box: BoxSize
): BoxSize {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: 2, height: 2 };
  }
  const scale = Math.min(box.width / srcWidth, box.height / srcHeight, 1);
  return {
    width: toEven(srcWidth * scale),
    height: toEven(srcHeight * scale),
  };
}

/** キャンバスサイズから、イラストを描画してよい内側の領域を返す（余白を除いた分）。 */
export function innerBox(canvas: BoxSize): BoxSize {
  const p = LINE_SPEC.padding * 2;
  return {
    width: Math.max(2, canvas.width - p),
    height: Math.max(2, canvas.height - p),
  };
}

/**
 * 各書き出し種別のキャンバスサイズ。
 * スタンプは最大サイズ固定にする — 枚数ごとに寸法がばらつくと審査で指摘されやすいため。
 */
export function canvasSizeFor(kind: "sticker" | "main" | "tab"): BoxSize {
  if (kind === "main") {
    return { width: LINE_SPEC.main.width, height: LINE_SPEC.main.height };
  }
  if (kind === "tab") {
    return { width: LINE_SPEC.tab.width, height: LINE_SPEC.tab.height };
  }
  return {
    width: LINE_SPEC.sticker.maxWidth,
    height: LINE_SPEC.sticker.maxHeight,
  };
}

export function isValidStickerCount(n: number): n is StickerCount {
  return (LINE_SPEC.allowedCounts as readonly number[]).includes(n);
}

export type ValidationIssue = {
  field: string;
  message: string;
};

export function validateTitle(title: string): ValidationIssue | null {
  const t = title.trim();
  if (!t) return { field: "title", message: "タイトルを入力してください" };
  if (t.length > LINE_SPEC.titleMaxLength) {
    return {
      field: "title",
      message: `タイトルは${LINE_SPEC.titleMaxLength}文字以内にしてください（現在${t.length}文字）`,
    };
  }
  return null;
}

export function validateDescription(description: string): ValidationIssue | null {
  const d = description.trim();
  if (!d) return { field: "description", message: "説明文を入力してください" };
  if (d.length > LINE_SPEC.descriptionMaxLength) {
    return {
      field: "description",
      message: `説明文は${LINE_SPEC.descriptionMaxLength}文字以内にしてください（現在${d.length}文字）`,
    };
  }
  return null;
}

/** 書き出し済みPNGのサイズ検証。ZIP生成の直前に呼ぶ。 */
export function validateFileSizes(
  files: { name: string; bytes: number }[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const f of files) {
    if (f.bytes > LINE_SPEC.maxFileBytes) {
      issues.push({
        field: f.name,
        message: `${f.name} が1MBを超えています（${Math.round(f.bytes / 1024)}KB）`,
      });
    }
  }
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  if (total > LINE_SPEC.maxZipBytes) {
    issues.push({
      field: "zip",
      message: `ZIP全体が60MBを超えています（${Math.round(total / 1024 / 1024)}MB）`,
    });
  }
  return issues;
}

/** ZIP内のファイル名（01.png 形式のゼロ埋め2桁） */
export function stickerFileName(index: number): string {
  return `${String(index).padStart(2, "0")}.png`;
}
