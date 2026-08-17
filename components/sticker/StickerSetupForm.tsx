"use client";

import { useEffect, useRef, useState } from "react";
import { LINE_SPEC } from "@/app/lib/sticker/line_spec";
import { STICKER_BP, packCost, bpPerSticker } from "@/app/lib/sticker/cost";
import { THEME_LABELS } from "@/app/lib/sticker/templates";
import type { StickerCount, StickerTheme } from "@/app/lib/sticker/types";

export type SetupValues = {
  sourcePrompt: string;
  sourceImage: File | null;
  theme: StickerTheme;
  themeCustom: string;
  count: StickerCount;
};

type Props = {
  balance: number;
  busy: boolean;
  onSubmit: (v: SetupValues) => void;
};

type Mode = "text" | "image";

const THEMES: StickerTheme[] = ["daily", "polite", "couple", "work", "funny", "custom"];

const PLACEHOLDER = "白くて丸い柴犬。少し生意気。ゆるキャラ風";

// アップロードできる画像の上限。R2へ載せる前にここで弾く。
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// 完成までの目安。1枚あたり約40秒、同時2本で処理する前提。
function estimateLabel(count: number): string {
  const minutes = Math.max(1, Math.round((count * 40) / 2 / 60));
  return `約${minutes}分`;
}

// STEP1: キャラクターの元ネタ・テーマ・枚数を決める。
// ここでの操作を極力少なくするのが狙い。
export default function StickerSetupForm({ balance, busy, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>("text");
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [theme, setTheme] = useState<StickerTheme>("daily");
  const [themeCustom, setThemeCustom] = useState("");
  // 8をデフォルトにする。40枚は完成まで10分近くかかり、
  // 初めての人が最初に選ぶ枚数としては重すぎるため。
  const [count, setCount] = useState<StickerCount>(8);

  const fileRef = useRef<HTMLInputElement>(null);

  // プレビュー用のURLは差し替え・破棄のたびに解放する
  useEffect(() => {
    if (!sourceImage) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(sourceImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sourceImage]);

  const pickFile = (file: File | null) => {
    setImageError("");
    if (!file) {
      setSourceImage(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError("PNG / JPEG / WebP の画像を選んでください");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(
        `画像が大きすぎます（${Math.round(file.size / 1024 / 1024)}MB）。8MB以下にしてください`
      );
      return;
    }
    setSourceImage(file);
  };

  const totalBp = STICKER_BP.character + packCost(count);
  const enough = balance >= STICKER_BP.character;
  const themeReady = theme !== "custom" || themeCustom.trim().length > 0;
  const sourceReady =
    mode === "text" ? sourcePrompt.trim().length > 0 : sourceImage !== null;
  const ready = sourceReady && themeReady;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
          キャラクター
        </label>

        {/* 作り方の切り替え */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={[
              "rounded-xl border px-3 py-2 text-xs font-bold transition",
              mode === "text"
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400",
            ].join(" ")}
          >
            文章から作る
          </button>
          <button
            type="button"
            onClick={() => setMode("image")}
            className={[
              "rounded-xl border px-3 py-2 text-xs font-bold transition",
              mode === "image"
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400",
            ].join(" ")}
          >
            画像から作る
          </button>
        </div>

        {mode === "text" ? (
          <>
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
          </>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />

            {previewUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="アップロードした画像"
                  className="h-20 w-20 rounded-lg object-contain"
                />
                <div className="flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {sourceImage?.name}
                  </p>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      選び直す
                    </button>
                    <button
                      type="button"
                      onClick={() => pickFile(null)}
                      className="text-[11px] font-bold text-slate-500 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-8 transition hover:border-indigo-400"
              >
                <span className="text-2xl">🖼️</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  画像を選ぶ
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  PNG / JPEG / WebP・8MBまで
                </span>
              </button>
            )}

            {imageError && (
              <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                {imageError}
              </p>
            )}

            <input
              value={sourcePrompt}
              onChange={(e) => setSourcePrompt(e.target.value)}
              placeholder="補足があれば（例：もっと丸っこく／色は青系で）"
              maxLength={200}
              className="mt-2 w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />

            <p className="mt-2 rounded-lg bg-slate-50 dark:bg-gray-800/50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              アップロードした画像をもとに、スタンプ用のキャラクターを描き起こします。
              ご自身が権利を持つ画像を使ってください。実在の人物の写真や、
              他人が作ったキャラクターは審査で落ちる原因になります。
            </p>
          </>
        )}
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
                "relative rounded-xl border py-2 text-sm font-bold transition",
                count === n
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400",
              ].join(" ")}
            >
              {n}
              {n === 8 && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[9px] font-bold text-white">
                  おすすめ
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          1枚あたり約 {bpPerSticker(count)}BP・完成まで{estimateLabel(count)}
        </p>
        {count >= 24 && (
          <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            枚数が多いほど時間がかかります。まずは8枚で試すことをおすすめします。
          </p>
        )}
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
          スタンプ分の {packCost(count)}BP は、キャラクターとセリフを確認したあとに
          引き落とされます。文字の変更とLINE形式への変換は無料です。
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
          onSubmit({
            sourcePrompt: sourcePrompt.trim(),
            sourceImage: mode === "image" ? sourceImage : null,
            theme,
            themeCustom: themeCustom.trim(),
            count,
          })
        }
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-gray-700"
      >
        {busy ? "キャラクターを作成中…" : `キャラクターを作る（${STICKER_BP.character}BP）`}
      </button>
    </div>
  );
}
