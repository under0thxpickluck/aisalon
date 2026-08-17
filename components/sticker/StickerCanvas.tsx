"use client";

import { useEffect, useRef, useState } from "react";
import { canvasSizeFor, innerBox } from "@/app/lib/sticker/line_spec";
import { composeToCanvas, loadImage, type TextStyle } from "@/app/lib/sticker/client/composer";
import type { EffectStyle } from "@/app/lib/sticker/client/effects";

type Props = {
  imageUrl: string;
  text: string;
  style: TextStyle;
  effect: EffectStyle;
  /** 表示幅（px）。実際の合成は常にLINE規格サイズで行い、表示だけ縮める */
  displayWidth?: number;
  className?: string;
};

// 合成結果をそのまま見せるプレビュー。
// ここに映っているものが、そのまま書き出されるPNGになる。
export default function StickerCanvas({
  imageUrl,
  text,
  style,
  effect,
  displayWidth = 160,
  className = "",
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  const spec = canvasSizeFor("sticker");
  const displayHeight = Math.round((displayWidth * spec.height) / spec.width);

  useEffect(() => {
    let cancelled = false;
    if (!imageUrl) return;

    setFailed(false);
    (async () => {
      try {
        const img = await loadImage(imageUrl);
        if (cancelled) return;
        const inner = innerBox(spec);
        const composed = composeToCanvas(img, {
          canvasWidth: spec.width,
          canvasHeight: spec.height,
          innerWidth: inner.width,
          innerHeight: inner.height,
          text,
          style,
          effect,
        });
        const target = ref.current;
        if (!target || cancelled) return;
        target.width = spec.width;
        target.height = spec.height;
        const ctx = target.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(composed, 0, 0);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, text, style, effect, spec.width, spec.height]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-slate-100 dark:bg-gray-800 text-[10px] text-slate-400 ${className}`}
        style={{ width: displayWidth, height: displayHeight }}
      >
        表示できません
      </div>
    );
  }

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: displayWidth, height: displayHeight }}
    />
  );
}
