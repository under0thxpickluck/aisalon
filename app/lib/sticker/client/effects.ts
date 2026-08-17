// ブラウザ専用。キャラクターの後ろに描く背景エフェクト（Effect Layer）。
//
// 画像生成AIは使わず、Canvasで手続き的に描く。
//   - BPを消費しない。切り替えが即時
//   - 何度でもやり直せる
//   - 透過を保てる（LINEの必須要件。塗りつぶしの背景は作らない）

export type EffectId =
  | "none"
  | "burst"
  | "sparkle"
  | "heart"
  | "dot"
  | "glow"
  | "anger";

export const EFFECT_LABELS: Record<EffectId, string> = {
  none: "なし",
  burst: "集中線",
  sparkle: "キラキラ",
  heart: "ハート",
  dot: "ドット",
  glow: "後光",
  anger: "怒り",
};

export type EffectStyle = {
  id: EffectId;
  color: string;
};

export const DEFAULT_EFFECT: EffectStyle = { id: "none", color: "#f5b301" };

export const EFFECT_COLORS = [
  { id: "amber", label: "黄", value: "#f5b301" },
  { id: "pink", label: "桃", value: "#f472b6" },
  { id: "sky", label: "水", value: "#38bdf8" },
  { id: "violet", label: "紫", value: "#a78bfa" },
  { id: "slate", label: "灰", value: "#94a3b8" },
];

// 乱数は使わない。同じスタンプが毎回違う見た目になると
// プレビューと書き出しがずれるため、位置は決め打ちで持つ。
const SPARKLE_POINTS = [
  [0.12, 0.16, 1.0],
  [0.86, 0.2, 0.75],
  [0.2, 0.78, 0.7],
  [0.9, 0.7, 0.9],
  [0.5, 0.08, 0.6],
  [0.08, 0.5, 0.55],
] as const;

const HEART_POINTS = [
  [0.14, 0.2, 1.0],
  [0.85, 0.26, 0.8],
  [0.22, 0.75, 0.65],
  [0.9, 0.66, 0.55],
] as const;

function drawBurst(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.hypot(w, h);
  const lines = 28;

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = color;
  ctx.lineCap = "butt";
  for (let i = 0; i < lines; i++) {
    const angle = (Math.PI * 2 * i) / lines;
    // 線の太さを交互に変えると集中線らしくなる
    ctx.lineWidth = i % 2 === 0 ? w * 0.035 : w * 0.018;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * w * 0.3, cy + Math.sin(angle) * h * 0.3);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  // 4方向に伸びるキラキラ。ベジェで菱形をふくらませる。
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fill();
  ctx.restore();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  const base = Math.min(w, h) * 0.13;
  for (const [px, py, scale] of SPARKLE_POINTS) {
    drawStar(ctx, w * px, h * py, base * scale, color);
  }
  ctx.restore();
}

function drawHeartShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-50, -10, -30, -55, 0, -25);
  ctx.bezierCurveTo(30, -55, 50, -10, 0, 30);
  ctx.fill();
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.8;
  const base = Math.min(w, h) * 0.3;
  for (const [px, py, scale] of HEART_POINTS) {
    drawHeartShape(ctx, w * px, h * py, base * scale, color);
  }
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const step = Math.min(w, h) / 9;
  const r = step * 0.17;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = color;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(w, h) * 0.55;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawAnger(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  // 怒りマーク（井桁）を右上に2つ
  const marks: [number, number, number][] = [
    [0.82, 0.16, 1],
    [0.66, 0.08, 0.6],
  ];
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (const [px, py, scale] of marks) {
    const s = Math.min(w, h) * 0.11 * scale;
    const x = w * px;
    const y = h * py;
    ctx.lineWidth = Math.max(2, s * 0.22);
    // 上下の弧2本
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.35);
    ctx.lineTo(x + s * 0.3, y - s * 0.35);
    ctx.moveTo(x - s * 0.3, y + s * 0.35);
    ctx.lineTo(x + s, y + s * 0.35);
    // 左右の弧2本
    ctx.moveTo(x - s * 0.35, y - s);
    ctx.lineTo(x - s * 0.35, y + s * 0.3);
    ctx.moveTo(x + s * 0.35, y - s * 0.3);
    ctx.lineTo(x + s * 0.35, y + s);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * キャラクターを描く前に呼ぶ。背景は塗りつぶさず、透過を保つ。
 */
export function drawEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: EffectStyle
): void {
  switch (effect.id) {
    case "burst":
      return drawBurst(ctx, width, height, effect.color);
    case "sparkle":
      return drawSparkle(ctx, width, height, effect.color);
    case "heart":
      return drawHeart(ctx, width, height, effect.color);
    case "dot":
      return drawDot(ctx, width, height, effect.color);
    case "glow":
      return drawGlow(ctx, width, height, effect.color);
    case "anger":
      return drawAnger(ctx, width, height, effect.color);
    case "none":
    default:
      return;
  }
}
