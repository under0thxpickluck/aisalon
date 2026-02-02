"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** ✅ カウントダウン + 調達バー（returnの外に置く） */
function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}
function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function PresaleHeader({
  endAtISO,
  raised,
  goal,
  currencyLabel = "USDT",
}: {
  endAtISO: string;
  raised: number;
  goal: number;
  currencyLabel?: string;
}) {
  const endMs = useMemo(() => new Date(endAtISO).getTime(), [endAtISO]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, endMs - now);
  const totalSec = Math.floor(diff / 1000);

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pct = goal > 0 ? Math.min(100, Math.max(0, (raised / goal) * 100)) : 0;

  return (
    <div className="mt-10 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold text-slate-700">
            プレセール期間中！
          </p>

          <div className="mt-2 flex items-center gap-2">
            <TimeBox label="日" value={pad2(days)} />
            <TimeBox label="時" value={pad2(hours)} />
            <TimeBox label="分" value={pad2(mins)} />
            <TimeBox label="秒" value={pad2(secs)} />
          </div>

          {diff === 0 && (
            <p className="mt-2 text-xs font-semibold text-rose-600">
              プレセールは終了しました
            </p>
          )}
        </div>

        <div className="w-full md:max-w-md">
          <div className="flex items-end justify-between">
            <p className="text-xs font-extrabold text-slate-700">
              {currencyLabel}調達額
            </p>
            <p className="text-sm font-extrabold text-slate-900">
              {formatMoney(raised)} / {formatMoney(goal)}
            </p>
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-600">進捗：{pct.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <p className="text-lg font-extrabold leading-none text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-[920px] px-4 py-10">
        {/* ===== ヘッダー ===== */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 1段目：ロゴ + ログイン */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="LIFAI"
                className="h-12 w-12 rounded-2xl border border-slate-200 bg-white shadow-sm object-contain"
              />
              <div>
                <div className="text-lg font-bold">LIFAI</div>
                <div className="text-xs text-slate-500">AI教育サロン</div>
              </div>
            </div>

            {/* スマホではログインだけを右に */}
            <Link
              href="/login"
              className="md:hidden rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 transition"
            >
              ログイン
            </Link>
          </div>

          {/* 2段目：CTAボタン（スマホは横並び2つ / PCは右寄せ） */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:justify-end">
            <Link
              href="/start"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              LIFAIって何？
            </Link>

            <Link
              href="/vision"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white hover:border-slate-300 transition"
              aria-label="もっと詳しく（ビジョンページへ）"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 group-hover:bg-indigo-100 transition">
                i
              </span>
              もっと詳しく
            </Link>

            {/* PCではログインもここに出す */}
            <Link
              href="/login"
              className="hidden md:inline-flex rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-100 transition"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* ===== メインメッセージ ===== */}
        <div className="mt-14 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
            AI × LIFE × 副業
            <br />
            <span className="text-indigo-600">学びを収益に変える場所</span>
          </h1>

          <p className="mt-6 text-slate-600 max-w-xl mx-auto leading-relaxed">
            LIFAIは、AIを使って「生活を豊かにする力」を身につけるための
            実践型オンラインサロンです。
          </p>
        </div>

        {/* ✅ ここに追加：カウントダウン + 調達バー */}
        <PresaleHeader
          endAtISO="2026-03-01T23:59:59+09:00"
          raised={4882450.37}
          goal={8000000}
          currencyLabel="USDT"
        />

        {/* ===== メインCTA ===== */}
        <div className="mt-10 grid gap-4 max-w-md mx-auto">
          <Link
            href="/purchase"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-base font-bold text-white hover:bg-indigo-700 transition shadow-md"
          >
            権利購入（参加申請）
          </Link>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            すでにIDをお持ちの方はこちら
          </Link>
        </div>

        {/* ===== 始め方 ===== */}
        <div className="relative mt-16 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
          {/* 背景ロゴ */}
          <img
            src="/logo.png"
            alt="LIFAI"
            className="absolute right-[-40px] bottom-[-40px] w-[280px] opacity-[0.06] pointer-events-none select-none"
          />

          <div className="relative z-10">
            <div className="text-lg font-bold mb-4">はじめ方</div>

            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
              <div>① 権利購入（仮想通貨）</div>
              <div>② 申請フォーム入力</div>
              <div>③ 承認後ログインID発行</div>
              <div>④ 学習開始・実践サポート</div>
            </div>
          </div>
        </div>

        {/* ===== 承認待ち ===== */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-bold mb-2">承認待ちの場合</div>
          <p className="text-sm text-slate-600 leading-relaxed">
            現在確認中の可能性があります。通常は数時間〜24時間以内に対応いたします。
          </p>
        </div>

        {/* ===== 利用規約 / rule ===== */}
        <div className="mt-10 grid grid-cols-2 gap-2 max-w-md mx-auto">
          <Link
            href="/rule"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            利用規約
          </Link>
        </div>

        <div className="mt-12 text-center text-xs text-slate-400">
          © LIFAI AI Salon
        </div>
      </div>
    </main>
  );
}
