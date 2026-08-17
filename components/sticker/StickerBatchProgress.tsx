"use client";

import { useEffect, useState } from "react";

type Props = {
  done: number;
  total: number;
  /** バッチを開始した時刻（ms） */
  startedAt: number;
  /** 開始時点で既に完成していた枚数。再開時に残り時間を誤らせないため */
  doneAtStart: number;
};

function formatDuration(sec: number): string {
  if (sec < 60) return `約${Math.max(1, Math.round(sec))}秒`;
  const m = Math.round(sec / 60);
  return `約${m}分`;
}

// 一括生成中の進捗バー。
//
// 暗転オーバーレイは使わない。グリッドが1枚ずつ埋まっていく様子自体が
// 一番わかりやすい進捗表示なので、隠してしまうと逆効果になるため。
// 40枚だと10分近くかかるので、残り時間の目安を必ず出す。
export default function StickerBatchProgress({
  done,
  total,
  startedAt,
  doneAtStart,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, total - done);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  // 実測のスループットから残り時間を出す。
  // 固定値で見積もると、実際とずれたときに信用されなくなる。
  const elapsedSec = Math.max(1, (now - startedAt) / 1000);
  const completed = Math.max(0, done - doneAtStart);
  const eta =
    completed >= 2 && remaining > 0
      ? (elapsedSec / completed) * remaining
      : null;

  return (
    <div className="sticky bottom-3 z-30 rounded-[18px] border border-indigo-200 dark:border-indigo-900 bg-white/95 dark:bg-gray-900/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-600" />
          </span>
          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            スタンプを作成中
          </p>
        </div>
        <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
          {done} / {total} 枚
        </p>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {eta
            ? `残り ${formatDuration(eta)}`
            : "残り時間を計算しています…"}
        </span>
        <span>できたものから順に表示されます</span>
      </div>

      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
        時間がかかります。もう少し待ってね。
        <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
          閉じてしまっても、次に開いたときに続きから再開できます。
        </span>
      </p>
    </div>
  );
}
