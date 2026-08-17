"use client";

import { useState } from "react";
import { LINE_SPEC } from "@/app/lib/sticker/line_spec";
import { STICKER_BP, packCost, bpPerSticker } from "@/app/lib/sticker/cost";
import { THEME_LABELS } from "@/app/lib/sticker/templates";
import type { StickerCount, StickerTheme } from "@/app/lib/sticker/types";

type Props = {
  balance: number;
  busy: boolean;
  onSubmit: (v: {
    sourcePrompt: string;
    theme: StickerTheme;
    themeCustom: string;
    count: StickerCount;
  }) => void;
};

const THEMES: StickerTheme[] = ["daily", "polite", "couple", "work", "funny", "custom"];

const PLACEHOLDER = "白くて丸い柴犬。少し生意気。ゆるキャラ風";

// STEP1: キャラクターの説明・テーマ・枚数を決める。
// ここでの操作を極力少なくするのが狙い。
export default function StickerSetupForm({ balance, busy, onSubmit }: Props) {
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [theme, setTheme] = useState<StickerTheme>("daily");
  const [themeCustom, setThemeCustom] = useState("");
  const [count, setCount] = useState<StickerCount>(40);

  const totalBp = STICKER_BP.character + packCost(count);
  const enough = balance >= STICKER_BP.character;
  const ready =
    sourcePrompt.trim().length > 0 &&
    (theme !== "custom" || themeCustom.trim().length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
          キャラクター
        </label>
        <textarea
          value={sourcePrompt}
          onChange={(e) => setSourcePrompt(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={3}
          maxLength={200}
          className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
        />
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          例：{PLACEHOLDER}
        </p>
      </section>

      <section>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
          スタンプの雰囲気
        </label>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={[
                "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                theme === t
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400",
              ].join(" ")}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
        {theme === "custom" && (
          <input
            value={themeCustom}
            onChange={(e) => setThemeCustom(e.target.value)}
            placeholder="例：関西弁でツッコミ多め"
            maxLength={100}
            className="mt-2 w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
          />
        )}
      </section>

      <section>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
          スタンプ数
        </label>
        <div className="grid grid-cols-5 gap-2">
          {LINE_SPEC.allowedCounts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={[
                "rounded-xl border py-2 text-sm font-bold transition",
                count === n
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          1枚あたり約 {bpPerSticker(count)}BP
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 p-4">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>キャラクター作成</span>
          <span className="font-bold">{STICKER_BP.character} BP</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>スタンプ {count}個</span>
          <span className="font-bold">{packCost(count)} BP</span>
        </div>
        <div className="mt-2 border-t border-slate-200 dark:border-gray-700 pt-2 flex items-center justify-between text-sm">
          <span className="font-bold text-slate-700 dark:text-slate-200">合計</span>
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
            {totalBp} BP
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          スタンプ分の {packCost(count)}BP は、キャラクターを確定したあとに引き落とされます。
          文字の変更とLINE形式への変換は無料です。
        </p>
      </section>

      {!enough && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
          BPが足りません（キャラクター作成に {STICKER_BP.character}BP 必要・現在 {balance}BP）
        </p>
      )}

      <button
        type="button"
        disabled={!ready || !enough || busy}
        onClick={() =>
          onSubmit({ sourcePrompt: sourcePrompt.trim(), theme, themeCustom: themeCustom.trim(), count })
        }
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-gray-700"
      >
        {busy ? "キャラクターを作成中…" : `キャラクターを作る（${STICKER_BP.character}BP）`}
      </button>
    </div>
  );
}
