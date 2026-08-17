// ブラウザ専用。キャラクター画像にセリフを重ねて1枚のスタンプにする。
//
// 画像AIには文字を描かせない（日本語が崩れるため）。文字は必ずここで重ねる。
// この方式なら文字の修正が再生成なしで済み、BPも消費しない。

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

/** R2 の画像を canvas に描くため crossOrigin を付けて読み込む */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = url;
  });
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

  const lines = text.split("\n").filter(Boolean).slice(0, 2);
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
