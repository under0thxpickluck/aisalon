// ブラウザ専用。キャラクター画像にセリフを重ねて1枚のスタンプにする。
//
// 画像AIには文字を描かせない（日本語が崩れるため）。文字は必ずここで重ねる。
// この方式なら文字の修正が再生成なしで済み、BPも消費しない。
//
// 重ね順: 背景エフェクト → キャラクター → 文字

import { drawEffect, DEFAULT_EFFECT, type EffectStyle } from "./effects";

export type TextStyle = {
  /** 文字色 */
  color: string;
  /** フチの色 */
  strokeColor: string;
  /** フチの太さ（フォントサイズに対する比率） */
  strokeRatio: number;
  /** 配置 */
  position: "top" | "bottom" | "none";
  /** フォント指定。日本語が確実に出る端末フォントを優先して並べている */
  fontFamily: string;
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  color: "#1f2933",
  strokeColor: "#ffffff",
  strokeRatio: 0.22,
  position: "bottom",
  fontFamily:
    '"Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", "Yu Gothic", "YuGothic", "Meiryo", "Noto Sans JP", sans-serif',
};

export const TEXT_PRESETS: { id: string; label: string; style: Partial<TextStyle> }[] = [
  { id: "default", label: "黒文字・白フチ", style: {} },
  {
    id: "white",
    label: "白文字・黒フチ",
    style: { color: "#ffffff", strokeColor: "#1f2933" },
  },
  {
    id: "pop",
    label: "ピンク・白フチ",
    style: { color: "#e0407f", strokeColor: "#ffffff" },
  },
  {
    id: "cool",
    label: "青・白フチ",
    style: { color: "#2563eb", strokeColor: "#ffffff" },
  },
];

/**
 * canvas に描く画像は必ず同一オリジンのプロキシ経由にする。
 *
 * R2の公開ドメイン（pub-*.r2.dev）はCORSヘッダを返さず設定もできないため、
 * 直接読むと crossOrigin='anonymous' が失敗し、
 * 仮に読めても canvas が汚染されて toBlob() が SecurityError になる。
 */
export function toSameOriginUrl(url: string): string {
  if (!url) return url;
  // data: と相対パスはそのまま扱える
  if (url.startsWith("data:") || url.startsWith("/")) return url;
  return `/api/sticker/image?url=${encodeURIComponent(url)}`;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = toSameOriginUrl(url);
  });
}

// これより長いセリフは自動で2行に割る。
// 1行のままだと横幅に合わせて字が小さくなり、スタンプとして読めなくなるため。
export const AUTO_WRAP_MIN = 6;

// 行頭に来てはいけない文字（禁則処理）
const NO_LINE_START =
  "、。，．・！？!?」』）］｝ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヵヶ々〆〜:;：；";
// 行末に来てはいけない文字
const NO_LINE_END = "「『（［｛(";

/**
 * セリフを表示用の行に分ける。
 * 手動の改行があればそれを優先し、無ければ中央付近で自動的に2行へ割る。
 */
export function wrapText(text: string, maxLines = 2): string[] {
  const manual = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (manual.length > 1) return manual.slice(0, maxLines);

  const t = (manual[0] ?? "").trim();
  if (!t) return [];

  // 絵文字などのサロゲートペアを壊さないよう1文字ずつに分ける
  const chars = Array.from(t);
  if (chars.length <= AUTO_WRAP_MIN) return [t];

  let split = Math.ceil(chars.length / 2);
  // 行頭禁則にあたる文字が来たら、区切りを1つ後ろへずらす
  for (let i = 0; i < 2 && NO_LINE_START.includes(chars[split] ?? ""); i++) {
    split++;
  }
  // 行末禁則にあたる文字で終わるなら、区切りを1つ前へ戻す
  for (let i = 0; i < 2 && NO_LINE_END.includes(chars[split - 1] ?? ""); i++) {
    split--;
  }
  if (split <= 0 || split >= chars.length) return [t];

  return [chars.slice(0, split).join(""), chars.slice(split).join("")];
}

/**
 * 指定した最大幅に収まるフォントサイズを二分探索で求める。
 * セリフの長さがバラバラでも文字の大きさが破綻しないようにするため。
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  fontFamily: string,
  maxWidth: number,
  maxFontSize: number
): number {
  let lo = 8;
  let hi = Math.max(9, Math.floor(maxFontSize));
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    ctx.font = `bold ${mid}px ${fontFamily}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type ComposeOptions = {
  /** 出力キャンバスの寸法 */
  canvasWidth: number;
  canvasHeight: number;
  /** イラストを収める内側の寸法（余白を除いた分） */
  innerWidth: number;
  innerHeight: number;
  text: string;
  style: TextStyle;
  /** キャラクターの後ろに描く背景エフェクト */
  effect?: EffectStyle;
};

/**
 * キャラクター画像とセリフを1枚のキャンバスに合成する。
 * 背景は透過のまま維持する（LINEの必須要件）。
 */
export function composeToCanvas(
  img: HTMLImageElement,
  opts: ComposeOptions
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = opts.canvasWidth;
  canvas.height = opts.canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";

  // 背景エフェクトを先に描く（キャラクターの後ろになる）。
  // 背景は塗りつぶさないので透過は保たれる。
  drawEffect(ctx, canvas.width, canvas.height, opts.effect ?? DEFAULT_EFFECT);

  // イラストをアスペクト比を保って内側領域に収める
  const scale = Math.min(
    opts.innerWidth / img.width,
    opts.innerHeight / img.height
  );
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = (canvas.width - drawW) / 2;
  const drawY = (canvas.height - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  const text = opts.text.trim();
  if (!text || opts.style.position === "none") return canvas;

  // 長いセリフは自動で2行に割る。1行のままだと字が小さくなって読めないため。
  const lines = wrapText(text);
  if (!lines.length) return canvas;

  const maxTextWidth = canvas.width * 0.9;
  // 2行なら1行あたりの上限を下げる
  const maxFontSize = (canvas.height * (lines.length > 1 ? 0.2 : 0.28));
  const fontSize = fitFontSize(
    ctx,
    lines,
    opts.style.fontFamily,
    maxTextWidth,
    maxFontSize
  );

  ctx.font = `bold ${fontSize}px ${opts.style.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(2, fontSize * opts.style.strokeRatio);

  const lineHeight = fontSize * 1.15;
  const blockHeight = lineHeight * lines.length;
  const margin = fontSize * 0.35;
  const startY =
    opts.style.position === "top"
      ? margin + lineHeight / 2
      : canvas.height - margin - blockHeight + lineHeight / 2;

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    // 袋文字。フチを先に描いてから塗る。
    ctx.strokeStyle = opts.style.strokeColor;
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillStyle = opts.style.color;
    ctx.fillText(line, canvas.width / 2, y);
  });

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas_to_blob_failed"));
    }, "image/png");
  });
}
