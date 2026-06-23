"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PostType = "news" | "column";

type Post = {
  id: string;
  type: PostType;
  title: string;
  excerpt: string;   // 一覧用の短い本文（要約）
  createdAt: string; // ISO
  href: string;      // 投稿ページへの固定リンク
};

function formatJP(iso: string) {
  const d = new Date(iso);
  // 日本時間で見やすく（ブラウザのロケールでもOK）
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ColumnHomePage() {
  /**
   * ✅ 運用方法（超ラク）
   * 1) 新しい投稿を追加したい
   *    → app/column/posts/<slug>/page.tsx を作る
   * 2) ここ(allPosts)に1行だけ追加する
   *
   * これで「管理画面なし」でも更新が回せる。
   */
  const allPosts = useMemo<Post[]>(
    () => [
      {
        id: "2026-01-31-feature-add",
        type: "news",
        title: "LIFAI：コラム機能を追加しました",
        excerpt:"サービス開始まで今しばらくお待ちください。",
        createdAt: "2026-01-31T05:10:00.000Z",
        href: "/column/posts/2026-01-31-feature-add",
      },
      {
        id: "2026-01-31-design-win",
        type: "column",
        title: "今日の気づき：結局“設計”が勝つ",
        excerpt:
          "今日はReddayAIの導線を考えてた。\n結局、ツールの性能じゃない。\n「誰に」「どんな感情で」「どこへ」誘導するか。",
        createdAt: "2026-01-31T06:30:00.000Z",
        href: "/column/posts/2026-01-31-design-win",
      },
      {
        id: "2026-01-30-less-is-more",
        type: "column",
        title: "日記：やることを減らすほど伸びる",
        excerpt:
          "今日はタスクが多すぎて詰まった。\nでも結局、やることを減らして“当たり”に集中する方が伸びる。",
        createdAt: "2026-01-30T10:15:00.000Z",
        href: "/column/posts/2026-01-30-less-is-more",
      },
    ],
    []
  );

  const [tab, setTab] = useState<PostType>("news");

  const posts = useMemo(() => {
    return allPosts
      .filter((p) => p.type === tab)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allPosts, tab]);

  return (
    <main className="min-h-screen text-slate-900 dark:text-white">
      {/* 背景：TOPと同系統 */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)] dark:bg-none dark:bg-gray-950" />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)] dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/" className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">
                ← TOPへ戻る
              </Link>
              <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">NEWS / コラム</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                NEWSは更新情報、コラムはプチPOINTとして残していきます。
              </p>
            </div>
          </div>

          {/* タブ */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("news")}
              className={[
                "rounded-full border px-4 py-2 text-xs font-extrabold",
                tab === "news"
                  ? "border-slate-900 dark:border-gray-200 bg-slate-900 dark:bg-gray-200 text-white dark:text-gray-900"
                  : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700",
              ].join(" ")}
            >
              📰 NEWS
            </button>
            <button
              type="button"
              onClick={() => setTab("column")}
              className={[
                "rounded-full border px-4 py-2 text-xs font-extrabold",
                tab === "column"
                  ? "border-slate-900 dark:border-gray-200 bg-slate-900 dark:bg-gray-200 text-white dark:text-gray-900"
                  : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700",
              ].join(" ")}
            >
              📚 コラム
            </button>
          </div>

          {/* 一覧 */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={p.href}
                className="group rounded-[24px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)] dark:shadow-none transition hover:-translate-y-[1px] hover:shadow-[0_22px_60px_rgba(2,6,23,.12)]"
              >
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {formatJP(p.createdAt)} ・ {p.type === "news" ? "NEWS" : "COLUMN"}
                </div>

                <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{p.title}</div>

                <div className="mt-2 line-clamp-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {p.excerpt}
                </div>

                <div className="mt-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white">
                  開く →
                </div>
              </Link>
            ))}

            {posts.length === 0 && (
              <div className="rounded-[24px] border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-4 text-sm text-slate-600 dark:text-slate-300">
                まだ投稿がありません。
              </div>
            )}
          </div>

          {/* 運用メモ（消してもOK） */}
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
            ※ 投稿は不定期となります。
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">© LIFAI</div>
      </div>
    </main>
  );
}
