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
  return (
    <Link
      href={t.href}
      className="group relative rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_60px_rgba(2,6,23,.12)] active:translate-y-0"
    >
      {t.badge ? (
        <div className="absolute right-3 top-3 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {t.badge}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        {/* アプリアイコン */}
        <div
          className={[
            "relative grid h-14 w-14 place-items-center rounded-[18px] text-white shadow-[0_14px_30px_rgba(2,6,23,.18)]",
            "bg-gradient-to-br",
            tintClass(t.tint),
          ].join(" ")}
        >
          <div className="text-[22px] leading-none">{t.icon}</div>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">{t.title}</div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-600">{t.desc}</div>
        </div>
      </div>

      <div className="mt-3 text-right text-xs font-semibold text-slate-500 group-hover:text-slate-800">
        開く →
      </div>
    </Link>
  );
}

export default function AppHomePage() {
  const [auth, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  // 未ログインならログインへ（運用時は middleware にしてもOK）
  useEffect(() => {
    if (auth === null) return; // 初回読み込み中
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
      // 必要なら「管理/申請」系も残す（いらなければ削除OK）
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
      {/* 白系・近代的（読みやすい） */}
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
                TOP（ログイン後）
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {tiles.map((t) => (
              <AppIconCard key={t.href} t={t} />
            ))}
          </div>

          {/* まだ未実装のページがある場合の案内（消してもOK） */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            ※ まだページ未作成の機能（/music など）は、リンク先を作ったら動きます。
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}
