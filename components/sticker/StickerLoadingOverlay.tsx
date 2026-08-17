"use client";

import { useEffect, useState } from "react";

export type OverlayKind = "upload" | "character" | "retry" | "start";

type Phase = { until: number; text: string };

// 経過秒数に応じて文言を変える。
// ランダムに切り替えるより、実際に進んでいる感じが出る。
const PHASES: Record<OverlayKind, Phase[]> = {
  upload: [
    { until: 5, text: "画像を読み込んでいます" },
    { until: Infinity, text: "画像を保存しています" },
  ],
  character: [
    { until: 6, text: "キャラクターの設計図を作っています" },
    { until: 14, text: "セリフと表情を考えています" },
    { until: 40, text: "基準になる1枚を描いています" },
    { until: 70, text: "表情のバリエーションを描いています" },
    { until: Infinity, text: "仕上げをしています" },
  ],
  retry: [
    { until: 8, text: "新しいキャラクターを描いています" },
    { until: 35, text: "細かいところを描き込んでいます" },
    { until: Infinity, text: "仕上げをしています" },
  ],
  start: [
    { until: 4, text: "ポイントのお支払いを確認しています" },
    { until: Infinity, text: "生成の準備をしています" },
  ],
};

const TITLES: Record<OverlayKind, string> = {
  upload: "画像を読み込み中",
  character: "キャラクターを作成中",
  retry: "キャラクターを作り直し中",
  start: "準備しています",
};

// 目安の所要時間（秒）。バーの進み方の基準に使う。
const ESTIMATES: Record<OverlayKind, number> = {
  upload: 10,
  character: 75,
  retry: 45,
  start: 8,
};

// 「もう少し待ってね」系。一定間隔で入れ替える。
const REASSURANCE = [
  "もう少し待ってね",
  "いい感じに描けてきています",
  "あと少しです",
  "ていねいに描いています",
];

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${String(s).padStart(2, "0")}秒` : `${s}秒`;
}

type Props = {
  kind: OverlayKind;
};

// 生成中に画面全体を覆うオーバーレイ。
// 何も表示されないまま数十秒待たされると「固まった」と思われるため、
// 経過時間・段階・目安を出して、待てる状態にするのが目的。
export default function StickerLoadingOverlay({ kind }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 背後のスクロールを止める（オーバーレイ中に動くと操作できると誤解されるため）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const phase =
    PHASES[kind].find((p) => elapsed < p.until) ??
    PHASES[kind][PHASES[kind].length - 1];

  const estimate = ESTIMATES[kind];
  // 目安を超えても止まって見えないよう、95%で頭打ちにして進み続ける
  const percent = Math.min(95, Math.round((elapsed / estimate) * 100));
  const overtime = elapsed > estimate;

  const reassurance = REASSURANCE[Math.floor(elapsed / 7) % REASSURANCE.length];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-[20px] border border-white/10 bg-white dark:bg-gray-900 p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {/* 回転するリング */}
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-gray-700" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-indigo-600 border-r-indigo-600" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">
              ✏️
            </div>
          </div>

          <p className="mt-4 text-base font-extrabold text-slate-800 dark:text-slate-100">
            {TITLES[kind]}
          </p>
          <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            {phase.text}…
          </p>

          {/* 進捗バー */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-1000 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-2 flex w-full items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>経過 {formatElapsed(elapsed)}</span>
            <span>目安 約{Math.round(estimate / 5) * 5}秒</span>
          </div>

          <p className="mt-4 text-xs font-bold text-slate-600 dark:text-slate-300">
            {overtime ? "もう少しかかっています。そのままお待ちください" : reassurance}
          </p>

          <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
            この画面を閉じたり、更新したりしないでください
          </p>
        </div>
      </div>
    </div>
  );
}
