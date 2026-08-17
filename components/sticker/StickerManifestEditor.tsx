"use client";

import { useState } from "react";
import { MAX_TEXT_LENGTH } from "@/app/lib/sticker/manifest";
import type { StickerItem } from "@/app/lib/sticker/types";

type Props = {
  items: StickerItem[];
  onChange: (index: number, text: string) => void;
};

// 生成前にセリフを直すための一覧。
//
// 生成後でも文字は無料で変えられるが、絵のポーズと表情は
// 生成時のセリフに合わせて描かれる。ポイントを払う前にここで直しておけば、
// 「セリフと絵が噛み合わない」状態を避けられる。
export default function StickerManifestEditor({ items, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const preview = items.slice(0, 6).map((i) => i.text).join("・");

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            セリフ（{items.length}個）
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {preview}
            {items.length > 6 ? " …" : ""}
          </p>
        </div>
        <span className="flex-shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
          {open ? "閉じる" : "編集する"}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-gray-700 p-4">
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            絵のポーズと表情は、ここに書いたセリフに合わせて描かれます。
            作成をはじめる前に直しておくと、セリフと絵が噛み合います。
            （作成後も文字だけなら無料で変更できます）
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.index} className="flex items-center gap-2">
                <span className="w-6 flex-shrink-0 text-right text-[10px] font-bold text-slate-400">
                  {item.index}
                </span>
                <input
                  value={item.text}
                  maxLength={MAX_TEXT_LENGTH}
                  onChange={(e) => onChange(item.index, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>

          <p className="mt-3 text-right text-[10px] text-slate-400">
            1つあたり{MAX_TEXT_LENGTH}文字まで
          </p>
        </div>
      )}
    </div>
  );
}
