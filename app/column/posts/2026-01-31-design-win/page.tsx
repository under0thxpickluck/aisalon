import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <Link href="/column" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← 一覧へ
          </Link>

          <div className="mt-3 text-[11px] font-semibold text-slate-500">
            2026/01/31 15:30 ・ COLUMN
          </div>

          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
            今日の気づき：結局“設計”が勝つ
          </h1>

          <article className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
{`今日はReddayAIの導線を考えてた。

結局、ツールの性能じゃない。
「誰に」「どんな感情で」「どこへ」誘導するか。
この設計があるかで結果が変わる。

明日はn8nの“ビジネスOS化”の構成をまとめる。`}
          </article>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}
