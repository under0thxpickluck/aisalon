// ブラウザ専用。合成済みのキャンバスを LINE の提出規格に合わせて PNG 化する。
//
// 規格の数値は line_spec.ts が唯一の出典。ここには数値を直接書かない。

import {
  LINE_SPEC,
  canvasSizeFor,
  innerBox,
  stickerFileName,
} from "../line_spec";
import type { StickerItem } from "../types";
import { selectedAssetUrl } from "../types";
import {
  composeToCanvas,
  canvasToBlob,
  loadImage,
  type TextStyle,
} from "./composer";
import type { EffectStyle } from "./effects";

export type ExportedFile = {
  name: string;
  blob: Blob;
};

/**
 * PNG は品質パラメータを持たないため、1MB を超えたら段階的に縮小する。
 * 370x320 の透過PNGが1MBを超えることはまず無く、これは安全網。
 */
async function toPngUnderLimit(canvas: HTMLCanvasElement): Promise<Blob> {
  let current = canvas;
  for (let attempt = 0; attempt < 4; attempt++) {
    const blob = await canvasToBlob(current);
    if (blob.size <= LINE_SPEC.maxFileBytes) return blob;

    // 縦横を偶数に保ったまま85%に縮める
    const next = document.createElement("canvas");
    next.width = Math.max(2, Math.floor((current.width * 0.85) / 2) * 2);
    next.height = Math.max(2, Math.floor((current.height * 0.85) / 2) * 2);
    const ctx = next.getContext("2d");
    if (!ctx) return blob;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  return canvasToBlob(current);
}

async function renderOne(
  imageUrl: string,
  text: string,
  style: TextStyle,
  effect: EffectStyle,
  kind: "sticker" | "main" | "tab"
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const canvas = canvasSizeFor(kind);
  const inner = innerBox(canvas);
  const composed = composeToCanvas(img, {
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    innerWidth: inner.width,
    innerHeight: inner.height,
    text,
    style,
    effect,
  });
  return toPngUnderLimit(composed);
}

/** スタンプ1枚（370x320・セリフ入り） */
export function renderSticker(
  imageUrl: string,
  text: string,
  style: TextStyle,
  effect: EffectStyle
): Promise<Blob> {
  return renderOne(imageUrl, text, style, effect, "sticker");
}

/** メイン画像（240x240・セリフ入り） */
export function renderMain(
  imageUrl: string,
  text: string,
  style: TextStyle,
  effect: EffectStyle
): Promise<Blob> {
  return renderOne(imageUrl, text, style, effect, "main");
}

const NO_TEXT_STYLE: TextStyle = {
  color: "#000000",
  strokeColor: "#ffffff",
  strokeRatio: 0,
  position: "none",
  fontFamily: "sans-serif",
};

/** タブ画像（96x74・文字なし。小さすぎて文字が潰れるため） */
export function renderTab(imageUrl: string): Promise<Blob> {
  // エフェクトも入れない。96x74ではキャラクターの判別を最優先する。
  return renderOne(imageUrl, "", NO_TEXT_STYLE, NO_EFFECT, "tab");
}

const NO_EFFECT: EffectStyle = { id: "none", color: "#000000" };

export type BuildProgress = (done: number, total: number) => void;

/**
 * 提出用の全ファイルを書き出す。
 * main / tab には1枚目のスタンプ画像を使う。
 */
export async function buildExportFiles(
  items: StickerItem[],
  style: TextStyle,
  effect: EffectStyle,
  onProgress?: BuildProgress
): Promise<ExportedFile[]> {
  const ready = items.filter((it) => selectedAssetUrl(it));
  if (!ready.length) throw new Error("no_stickers");

  const total = ready.length + 2; // main と tab の分
  let done = 0;
  const step = () => onProgress?.(++done, total);

  const files: ExportedFile[] = [];

  const coverUrl = selectedAssetUrl(ready[0]);
  files.push({
    name: "main.png",
    blob: await renderMain(coverUrl, ready[0].text, style, effect),
  });
  step();
  files.push({ name: "tab.png", blob: await renderTab(coverUrl) });
  step();

  // 直列で処理する。40枚でも数秒で終わるうえ、進捗を素直に出せる。
  for (const item of ready) {
    const url = selectedAssetUrl(item);
    files.push({
      name: stickerFileName(item.index),
      blob: await renderSticker(url, item.text, style, effect),
    });
    step();
  }

  return files;
}
