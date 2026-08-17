"use client";

import { useState } from "react";
import StickerCanvas from "./StickerCanvas";
import { STICKER_BP } from "@/app/lib/sticker/cost";
import { MAX_TEXT_LENGTH } from "@/app/lib/sticker/manifest";
import { selectedAssetUrl, type StickerItem } from "@/app/lib/sticker/types";
import type { TextStyle } from "@/app/lib/sticker/client/composer";
import type { EffectStyle } from "@/app/lib/sticker/client/effects";

type Props = {
  items: StickerItem[];
  style: TextStyle;
  effect: EffectStyle;
  onRegenerate: (index: number) => void;
  onTextChange: (index: number, text: string) => void;
  onSelectVersion: (index: number, version: number) => void;
};

// STEP4-5: 生成結果の一覧。1枚ずつ作り直したり文字を直したりする。
// 40枚まとめて作り直させないことがこの画面の目的。
export default function StickerGrid({
  items,
  style,
  effect,
  onRegenerate,
  onTextChange,
  onSelectVersion,
}: Props) {
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const url = selectedAssetUrl(item);
        const isEditing = editing === item.index;

        return (
          <div
            key={item.index}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2"
          >
            <div className="relative flex items-center justify-center rounded-lg bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,#1f2937_0%_50%)] bg-[length:12px_12px] p-1">
              <span className="absolute left-1 top-1 z-10 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {String(item.index).padStart(2, "0")}
              </span>

              {item.status === "rendering" && (
                <div className="flex h-[122px] w-[140px] items-center justify-center">
                  <span className="text-[11px] font-semibold text-slate-400 animate-pulse">
                    生成中…
                  </span>
                </div>
              )}

              {item.status === "pending" && (
                <div className="flex h-[122px] w-[140px] items-center justify-center">
                  <span className="text-[11px] text-slate-300 dark:text-slate-600">
                    待機中
                  </span>
                </div>
              )}

              {item.status === "failed" && (
                <div className="flex h-[122px] w-[140px] flex-col items-center justify-center gap-1">
                  <span className="text-[11px] font-semibold text-rose-500">
                    失敗しました
                  </span>
                  <span className="text-[9px] text-slate-400">BPは戻っています</span>
                </div>
              )}

              {item.status === "done" && url && (
                <StickerCanvas
                  imageUrl={url}
                  text={item.text}
                  style={style}
                  effect={effect}
                  displayWidth={140}
                />
              )}
            </div>

            {isEditing ? (
              <div>
                <textarea
                  autoFocus
                  rows={2}
                  value={item.text}
                  maxLength={MAX_TEXT_LENGTH + 1} // 改行1文字分だけ余裕を持たせる
                  onChange={(e) => onTextChange(item.index, e.target.value)}
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="w-full resize-none rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 px-2 py-1 text-center text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
                <p className="mt-0.5 text-center text-[9px] text-slate-400">
                  Enterで改行・Escで完了
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(item.index)}
                className="w-full truncate rounded-lg px-2 py-1 text-center text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-gray-800"
                title="クリックで文字を編集（無料・Enterで改行できます）"
              >
                {item.text ? item.text.replace(/\n/g, " ⏎ ") : "（文字なし）"}
              </button>
            )}

            <div className="flex items-center justify-between gap-1">
              {item.assets.length > 1 ? (
                <select
                  value={item.selectedVersion}
                  onChange={(e) =>
                    onSelectVersion(item.index, Number(e.target.value))
                  }
                  className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-[10px] text-slate-600 dark:text-slate-300"
                >
                  {item.assets.map((a) => (
                    <option key={a.version} value={a.version}>
                      v{a.version}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}

              <button
                type="button"
                disabled={item.status === "rendering" || !item.assets.length}
                onClick={() => onRegenerate(item.index)}
                className="rounded-md px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-40"
                title={`この1枚だけ作り直す（${STICKER_BP.regenerate}BP）`}
              >
                🔄 {STICKER_BP.regenerate}BP
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
