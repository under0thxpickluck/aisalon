"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clearAuth, getAuth, type AuthState } from "../lib/auth";

type Tile = {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
  tint?: "indigo" | "cyan" | "violet" | "emerald" | "amber" | "rose";
  comingSoon?: boolean; 
};

function tintClass(tint: Tile["tint"]) {
  switch (tint) {
    case "indigo":
      return "from-indigo-600 to-indigo-400";
    case "cyan":
      return "from-cyan-600 to-cyan-400";
    case "violet":
      return "from-violet-600 to-violet-400";
    case "emerald":
      return "from-emerald-600 to-emerald-400";
    case "amber":
      return "from-amber-600 to-amber-400";
    case "rose":
      return "from-rose-600 to-rose-400";
    default:
      return "from-slate-700 to-slate-500";
  }
}

function AppIconCard({ t }: { t: Tile }) {
  const isSoon = t.comingSoon ?? true; // ← デフォルト全部準備中

  return (
    <div
      className={[
        "relative rounded-[24px] border p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)] transition",
        isSoon
          ? "border-slate-200 bg-slate-100 opacity-70 cursor-not-allowed"
          : "border-slate-200 bg-white hover:-translate-y-[1px] hover:shadow-[0_22px_60px_rgba(2,6,23,.12)] active:translate-y-0",
      ].join(" ")}
    >
      {/* 準備中バッジ */}
      {isSoon && (
        <div className="absolute right-3 top-3 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white">
          準備中
        </div>
      )}

      <div className="flex items-center gap-4">
        <div
          className={[
            "relative grid h-14 w-14 place-items-center rounded-[18px] text-white shadow-[0_10px_20px_rgba(2,6,23,.12)]",
            isSoon
              ? "bg-gradient-to-br from-slate-500 to-slate-400"
              : ["bg-gradient-to-br", tintClass(t.tint)].join(" "),
          ].join(" ")}
        >
          <div className="text-[22px] leading-none">{t.icon}</div>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-700">
            {t.title}
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-500">
            {t.desc}
          </div>
        </div>
      </div>

      <div className="mt-3 text-right text-xs font-semibold text-slate-500">
        {isSoon ? "公開予定" : "開く →"}
      </div>
    </div>
  );
}


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
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold text-slate-700">
            プレセール終了まで
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

export default function AppHomePage() {
  const [auth, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  useEffect(() => {
    if (auth === null) return;
    if (!auth) window.location.href = "/login";
    if (auth?.status === "pending") window.location.href = "/pending";
  }, [auth]);

  const tiles = useMemo<Tile[]>(
    () => [
      {
        title: "音楽生成",
        desc: "テーマを入力してBGM/ループ案を生成",
        href: "/music",
        icon: "🎵",
        tint: "indigo",
        badge: "NEW",
      },
      {
        title: "note記事生成",
        desc: "構成→本文→見出し→導入文まで一括",
        href: "/note",
        icon: "📝",
        tint: "violet",
      },
      {
        title: "ワークフロー生成",
        desc: "n8n/自動化の設計テンプレを作る",
        href: "/workflow",
        icon: "🧩",
        tint: "cyan",
      },
      {
        title: "アプリ作成",
        desc: "要件→画面→実装方針をサクッと",
        href: "/app-builder",
        icon: "📱",
        tint: "emerald",
      },
      {
        title: "毎日占い",
        desc: "今日の運勢をサクッと確認",
        href: "/fortune",
        icon: "🔮",
        tint: "amber",
      },
      {
        title: "コラム",
        desc: "管理者のNEWSやコラムが更新されます",
        href: "/column",
        icon: "📚",
        tint: "indigo",
        badge: "NEW",
      },
      {
        title: "権利購入（申請）",
        desc: "権利購入〜申請フローへ",
        href: "/purchase",
        icon: "🧾",
        tint: "rose",
      },
    ],
    []
  );

  const logout = () => {
    clearAuth();
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.14) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,.35)]" />
                LIFAI APP HOME
              </div>

              <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
                LIFAIへようこそ
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                使いたい機能を「アプリアイコン」から開けます。
              </p>
            </div>

            <button
              onClick={logout}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ログアウト
            </button>
          </div>

          {/* ✅ここ：ヘッダー直下、タイル一覧の直前 */}
          <PresaleHeader
            endAtISO="2026-04-01T23:59:59+09:00"
            raised={4825}
            goal={10000}
            currencyLabel="USDT"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {tiles.map((t) => (
              <AppIconCard key={t.href} t={t} />
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            問い合わせはTOPページにございます。
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}