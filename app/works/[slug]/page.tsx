import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WORKS, getWorkBySlug, getRelatedWorks } from "@/data/works";
import WorkCard from "@/components/WorkCard";

export async function generateStaticParams() {
  return WORKS.map(w => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const work = getWorkBySlug(params.slug);
  if (!work) return {};
  return {
    title: `${work.title}｜LIFAI AI作品ギャラリー`,
    description: work.description,
  };
}

export default function WorkPage({ params }: { params: { slug: string } }) {
  const work = getWorkBySlug(params.slug);
  if (!work) notFound();

  const related = getRelatedWorks(work.relatedSlugs);

  const BADGE: Record<typeof work.tab, string> = {
    music:   "bg-indigo-50 text-indigo-700 ring-indigo-200",
    image:   "bg-violet-50 text-violet-700 ring-violet-200",
    article: "bg-orange-50 text-orange-700 ring-orange-200",
  };

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* 戻るリンク */}
        <Link
          href="/gallery#works"
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition hover:bg-neutral-50 dark:hover:bg-gray-700"
        >
          ← ギャラリーに戻る
        </Link>

        {/* ヘッダー */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="h-[3px] bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
          <div className="p-8">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${BADGE[work.tab]}`}>
              {work.category}
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-neutral-900 dark:text-white md:text-3xl">
              {work.title}
            </h1>
          </div>
        </div>

        {/* プレビュー */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          {work.preview.type === "audio" && (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-4xl">
                🎵
              </div>
              {work.preview.src ? (
                <audio controls src={work.preview.src} className="w-full max-w-md" />
              ) : (
                <p className="text-sm text-neutral-400 dark:text-neutral-500">音源は準備中です</p>
              )}
            </div>
          )}

          {work.preview.type === "image" && (
            <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-gray-800">
              {work.preview.src ? (
                <Image
                  src={work.preview.src}
                  alt={work.preview.alt ?? work.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-300 dark:text-neutral-600">
                  画像は準備中です
                </div>
              )}
            </div>
          )}

          {work.preview.type === "text" && (
            <div className="border-b border-neutral-100 dark:border-gray-700 bg-neutral-50 dark:bg-gray-800 px-8 py-6">
              <p className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 mb-2">記事冒頭</p>
              <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">{work.preview.excerpt}</p>
            </div>
          )}
        </div>

        {/* 本文 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">📖 作品について</h2>
          <div className="space-y-4">
            {work.body.split("\n\n").map((para, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* 生成条件 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">📝 生成条件</h2>
          <div className="rounded-xl bg-neutral-50 dark:bg-gray-800 border border-neutral-200 dark:border-gray-600 px-5 py-4">
            <p className="font-mono text-sm text-neutral-700 dark:text-neutral-300">{work.prompt}</p>
          </div>

          <h2 className="mb-3 mt-6 text-lg font-bold text-neutral-900 dark:text-white">⚙️ 生成方法</h2>
          <p className="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">{work.howTo}</p>
        </div>

        {/* 応用例 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">💡 応用例</h2>
          <ul className="space-y-2">
            {work.applications.map(app => (
              <li key={app} className="flex items-start gap-2.5 text-[15px] text-neutral-600 dark:text-neutral-300">
                <span className="mt-0.5 shrink-0 text-xs font-bold text-indigo-400">✓</span>
                {app}
              </li>
            ))}
          </ul>
        </div>

        {/* 関連作品 */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">🔗 関連作品</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map(r => (
                <WorkCard key={r.slug} work={r} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm text-center">
          <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400" />
          <div className="p-8">
            <p className="text-lg font-bold text-neutral-900 dark:text-white">この作品を自分でも作ってみる</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">LIFAIに参加すると全機能が使えます</p>
            <Link
              href="/purchase"
              className="mt-6 inline-flex items-center rounded-xl bg-neutral-900 dark:bg-neutral-100 px-8 py-3 text-sm font-bold text-white dark:text-neutral-900 transition hover:bg-neutral-800 dark:hover:bg-neutral-200"
            >
              参加申請（権利購入）→
            </Link>
          </div>
        </div>

        {/* 戻るリンク（下部） */}
        <div className="mt-6 text-center">
          <Link
            href="/gallery#works"
            className="text-sm text-neutral-500 dark:text-neutral-400 underline-offset-4 hover:underline"
          >
            ← ギャラリーに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
