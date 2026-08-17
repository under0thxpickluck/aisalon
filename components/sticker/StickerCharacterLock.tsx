"use client";

import { packCost } from "@/app/lib/sticker/cost";
import type { StickerCharacter, StickerCount } from "@/app/lib/sticker/types";

type Props = {
  character: StickerCharacter;
  count: StickerCount;
  balance: number;
  busy: boolean;
  onLock: () => void;
  onRetry: () => void;
  /** セリフ編集など、確定ボタンの手前に差し込む内容 */
  children?: React.ReactNode;
};

// STEP2: キャラクターを確定する（Character LOCK）。
// ここで確定した master.png を、以降すべてのスタンプが参照する。
// 確定前に作り直せるようにしておかないと、40枚作ったあとで後悔することになる。
export default function StickerCharacterLock({
  character,
  count,
  balance,
  busy,
  onLock,
  onRetry,
  children,
}: Props) {
  const packBp = packCost(count);
  const enough = balance >= packBp;
  const images = [character.masterUrl, ...character.variantUrls].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          このキャラクターで作りますか？
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          確定すると、{count}枚すべてがこのキャラクターをもとに描かれます。
          途中でキャラクターを変えることはできません。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {images.map((url, i) => (
          <div
            key={url}
            className="relative rounded-xl border border-slate-200 dark:border-gray-700 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,#1f2937_0%_50%)] bg-[length:16px_16px] p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={i === 0 ? "基準画像" : `表情${i}`} className="w-full" />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                基準
              </span>
            )}
          </div>
        ))}
      </div>

      {character.profile?.name && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 px-4 py-3">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {character.profile.name}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {[
              character.profile.species,
              character.profile.body,
              character.profile.color,
              character.profile.style,
            ]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
      )}

      {children}

      {!enough && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
          BPが足りません（スタンプ{count}個に {packBp}BP 必要・現在 {balance}BP）
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={onRetry}
          className="flex-1 rounded-xl border border-slate-300 dark:border-gray-600 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          作り直す（50BP）
        </button>
        <button
          type="button"
          disabled={busy || !enough || !character.masterUrl}
          onClick={onLock}
          className="flex-[2] rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-gray-700"
        >
          {busy ? "準備中…" : `このキャラクターで${count}枚作る（${packBp}BP）`}
        </button>
      </div>
    </div>
  );
}
