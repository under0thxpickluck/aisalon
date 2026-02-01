"use client";

import Link from "next/link";
import { useMemo } from "react";

type PostType = "news" | "column";
type Post = { id: string; type: PostType; title: string; body: string; createdAt: string };

function formatJP(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ColumnDetailPage({ params }: { params: { id: string } }) {
  // ✅ いまは仮データ（後で取得ロジック差し替え）
  const allPosts = useMemo<Post[]>(
    () => [
      {
        id: "col_001",
        type: "column",
        title: "今日の気づき：結局“設計”が勝つ",
        body:
          "今日はReddayAIの導線を考えてた。\n\n結局、ツールの性能じゃない。\n「誰に」「どんな感情で」「どこへ」誘導するか。\nこの設計があるかで結果が変わる。\n\n明日はn8nの“ビジネスOS化”の構成をまとめる。",
        createdAt: "2026-01-31T06:30:00.000Z",
      },
      {
        id: "news_001",
        type: "news",
        title: "LIFAI：コラム機能を追加しました",
        body:
          "ログイン後TOPからコラムへアクセスできます。\n\n次は管理者投稿画面を追加して、NEWS/コラムを更新できるようにします。",
        createdAt: "2026-01-31T05:10:00.000Z",
      },
      {
        id: "col_002",
        type: "column",
        title: "日記：やることを減らすほど伸びる",
        body:
          "今日はタスクが多すぎて詰まった。\n\nでも結局、やることを減らして“当たり”に集中する方が伸びる。\n\n次は、コラムを毎日更新できる仕組みを作る。",
        createdAt: "2026-01-30T10:15:00.000Z",
      },
    ],
    []
  );

  const post = allPosts.find((p) => p.id === params.id);

  if (!post) {
    return (
      <main className="min-h-screen text-slate-900">
        <div className="mx-auto max-w-[920px] px-4 py-10">
          <Link href="/column" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← 一覧へ
          </Link>
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-6">
            見つかりませんでした。
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <Link href="/column" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← 一覧へ
          </Link>

          <div className="mt-3 text-[11px] font-semibold text-slate-500">
            {formatJP(post.createdAt)} ・ {post.type === "news" ? "NEWS" : "COLUMN"}
          </div>

          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">{post.title}</h1>

          <article className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
            {post.body}
          </article>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}
