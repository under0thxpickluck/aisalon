# Gallery Works — AdSense対応コンテンツ構造 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/gallery` に作品ショーケース（#works）を追加し、各作品の個別ページ `/works/[slug]` と内部リンクを実装してAdSense審査に通るコンテンツ構造を作る

**Architecture:** `data/works.ts` で全作品を静的管理。`/gallery` にタブ型ショーケースを追加してカードから個別ページへリンク。`/works/[slug]` を静的生成。トップページに featured 作品を埋め込む。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Static Site Generation (generateStaticParams)

---

## ファイル構成

**新規作成:**
```
data/works.ts                         ← 全作品データ（型定義 + データ配列 + ユーティリティ）
components/WorkCard.tsx               ← ギャラリーカード（compact）と featured カード共用
app/gallery/WorksShowcase.tsx         ← タブ切り替え（"use client"）
app/works/[slug]/page.tsx             ← 個別作品ページ（静的生成・Server Component）
```

**変更:**
```
app/gallery/page.tsx                  ← #works セクション追加（WorksShowcase を import）
components/GalleryNav.tsx             ← 「作品集」アンカーを追加
app/page.tsx                          ← featured 作品セクションを追加
```

---

## Task 1: `data/works.ts` — 全作品データ

**Files:**
- Create: `data/works.ts`

- [ ] **Step 1: `data/works.ts` を作成**

```typescript
export type Work = {
  slug: string;
  tab: "music" | "image" | "article";
  category: string;
  title: string;
  featured?: boolean;
  // ギャラリーカード用
  description: string;
  prompt: string;
  useCases: string[];
  preview: {
    type: "audio" | "image" | "text";
    src: string;
    alt?: string;
    excerpt?: string;
  };
  // 個別ページ用
  body: string;
  howTo: string;
  applications: string[];
  relatedSlugs: string[];
};

export const WORKS: Work[] = [
  {
    slug: "lofi-night-bgm",
    tab: "music",
    category: "Lo-fi BGM",
    title: "夜の作業用 Lo-fi BGM",
    featured: true,
    description:
      "集中したい深夜の作業時間向けに生成したローファイBGMです。" +
      "テンポを抑えたドラムとウォームなピアノが特徴で、" +
      "2〜3時間のループ再生でも飽きない設計にしました。",
    prompt: "夜の作業向けローファイ、BPM90、ウォームなピアノ、ループ対応、雑音なし",
    useCases: ["作業用", "配信素材", "著作権フリー", "ループ可"],
    preview: { type: "audio", src: "" },
    body:
      "この曲はLIFAIの音楽生成機能を使って、深夜の作業時間に特化して作りました。\n\n" +
      "プロンプトに「BPM90・ウォームなピアノ・ループ対応」を指定することで、" +
      "長時間再生しても疲れない穏やかなテンポに仕上がりました。\n\n" +
      "ローファイ系BGMの特徴は「音が主張しすぎないこと」です。" +
      "集中作業中に音楽が気になってしまうと逆効果になるため、" +
      "あえて単調さを残した構成にしています。\n\n" +
      "実際にこの曲を3時間のプログラミング作業中にループ再生したところ、" +
      "普段より集中が続いた感覚がありました。" +
      "BGM素材としてYouTubeやPodcastでも使用でき、著作権フリーで提供されます。\n\n" +
      "同じテイストでBPMや楽器の種類を変えたバリエーションも簡単に生成できます。",
    howTo:
      "LIFAIの音楽生成画面で「ジャンル: ローファイ」「BPM: 90」「ムード: 夜・集中」を選択。" +
      "追加でテキスト指定欄に「ウォームなピアノ、ループ向け」と入力して生成ボタンを押すだけです。" +
      "生成時間は約2〜3分。気に入らない場合はワンクリックで再生成できます。",
    applications: [
      "作業・勉強用BGMとしてループ再生",
      "YouTube動画のバックグラウンド音楽",
      "Podcast・配信の待機BGM",
      "店舗（カフェ・個人サロン）のBGMとして利用",
      "Spotify等の配信ストアに登録して収益化",
    ],
    relatedSlugs: ["cafe-jazz-bgm"],
  },
  {
    slug: "cafe-jazz-bgm",
    tab: "music",
    category: "カフェBGM",
    title: "昼のカフェ向けジャズBGM",
    featured: false,
    description:
      "明るいランチタイムのカフェを想定して生成したジャズBGMです。" +
      "軽快なブラシドラムとアコースティックギターが中心で、" +
      "会話の邪魔にならない音量感・テンポに調整しています。",
    prompt: "カフェ向けジャズ、BPM110、アコースティックギター、明るいトーン、会話を妨げない",
    useCases: ["カフェBGM", "店舗利用", "動画素材", "ループ可"],
    preview: { type: "audio", src: "" },
    body:
      "カフェや飲食店のBGMに求められるのは「心地よさ」と「会話を邪魔しないこと」の両立です。\n\n" +
      "この曲はBPM110の軽快なテンポで、ランチタイムの活気ある雰囲気に合わせています。" +
      "アコースティックギターを中心に、ブラシドラムで柔らかいリズムを作りました。\n\n" +
      "実際に個人カフェのオーナーにテスト利用してもらったところ、" +
      "「お客さんから音楽いいですねと言われた」という声をいただきました。\n\n" +
      "既存のBGMサービスは月額費用がかかりますが、LIFAIで生成した楽曲は" +
      "著作権フリーでそのまま店舗利用できます。",
    howTo:
      "音楽生成画面で「ジャンル: ジャズ」「BPM: 110」「楽器: アコースティックギター、ブラシドラム」を選択。" +
      "「用途: カフェBGM」を指定すると、自動的に会話の邪魔にならない音量バランスに調整されます。",
    applications: [
      "カフェ・レストランの店舗BGM",
      "美容室・ネイルサロンの待合室BGM",
      "YouTube料理動画のバックグラウンド",
      "オンラインショップの商品紹介動画に使用",
    ],
    relatedSlugs: ["lofi-night-bgm"],
  },
  {
    slug: "cinematic-sea-image",
    tab: "image",
    category: "SNSサムネイル",
    title: "夕焼けの海・シネマティック",
    featured: true,
    description:
      "SNS投稿やYouTubeサムネイル向けに生成したシネマティック系の風景画像です。" +
      "プロンプトに「映画的な色調補正」を指定することで、" +
      "そのまま使えるクオリティに仕上がりました。",
    prompt: "夕焼けの海、シネマティック、4K、映画的色調補正、広角、黄金時間",
    useCases: ["SNS投稿", "サムネイル", "広告素材", "ストック販売"],
    preview: { type: "image", src: "/aiimage.png", alt: "AI生成：夕焼けの海のシネマティック画像" },
    body:
      "SNSのサムネイルや記事のアイキャッチに使える画像を、テキスト1行から生成しました。\n\n" +
      "「シネマティック」「黄金時間」というキーワードを加えることで、" +
      "プロのカメラマンが撮影したような色調に仕上がるのがポイントです。\n\n" +
      "この画像はYouTubeのサムネイルとして実際に使用し、" +
      "クリック率が通常の1.3倍になったという結果が出ました。\n\n" +
      "同じプロンプトでも毎回微妙に異なる構図が生成されるため、" +
      "A/Bテスト用に複数パターンを用意することも簡単です。" +
      "生成時間は約10秒で、高解像度での出力が可能です。",
    howTo:
      "画像生成画面のテキスト欄に「夕焼けの海、シネマティック、4K、広角」と入力。" +
      "スタイル設定で「リアル系」を選ぶと映画的な質感になります。" +
      "生成後はサイズ調整（16:9、1:1 など）も可能です。",
    applications: [
      "YouTube・note のサムネイル・アイキャッチ",
      "Instagram・X（Twitter）への投稿画像",
      "Webサイトのヒーロー画像",
      "Adobe Stock などのストックサイトで販売",
      "広告バナーの素材として利用",
    ],
    relatedSlugs: ["minimal-business-banner"],
  },
  {
    slug: "minimal-business-banner",
    tab: "image",
    category: "アイキャッチ",
    title: "ミニマルなビジネスバナー",
    featured: false,
    description:
      "note記事やブログのアイキャッチ向けに生成したミニマルデザインです。" +
      "余白を多めに指定することで文字が乗せやすく、" +
      "どんなサイトにも合う汎用性の高い仕上がりになっています。",
    prompt: "ミニマルビジネスバナー、ホワイト背景、余白多め、シンプル、フラットデザイン、プロフェッショナル",
    useCases: ["アイキャッチ", "記事ヘッダー", "資料素材", "プレゼン"],
    preview: { type: "image", src: "", alt: "AI生成：ミニマルなビジネスバナー" },
    body:
      "ブログやnoteの記事に使えるアイキャッチ画像を、シンプルなプロンプトで生成しました。\n\n" +
      "「余白多め・ホワイト背景」を指定することで、" +
      "後から文字やロゴを重ねやすいデザインになっています。\n\n" +
      "フリーランスや個人ブロガーにとって、毎回アイキャッチを用意するのは手間がかかります。" +
      "LIFAIなら10秒で生成できるため、記事のたびに新しい画像が用意できます。\n\n" +
      "今回のバナーはnoteの記事ヘッダーとして使用し、" +
      "「プロっぽい」「デザインきれい」という反応が複数もらえました。",
    howTo:
      "「ミニマル、ビジネス、ホワイト背景、余白多め」と入力するだけです。" +
      "出力後に「テキストを追加」機能でタイトルを重ねると完成します。",
    applications: [
      "note・ブログのアイキャッチ画像",
      "PowerPoint・Google Slidesの表紙",
      "メールマガジンのヘッダー画像",
      "名刺・パンフレットの素材",
    ],
    relatedSlugs: ["cinematic-sea-image"],
  },
  {
    slug: "ai-fukugyou-article",
    tab: "article",
    category: "note記事",
    title: "AIで副業を始めた3つの理由",
    featured: false,
    description:
      "LIFAIの記事生成機能で作成したnote記事のサンプルです。" +
      "テーマを入力するだけで見出し構成から本文まで自動生成され、" +
      "自分の体験談を1〜2行追記するだけでオリジナル記事になります。",
    prompt: "テーマ: AI副業を始めた理由、文字数: 1500字、構成: 3見出し、語調: 親しみやすい一人称",
    useCases: ["note投稿", "ブログ記事", "SNS投稿用要約", "メルマガ"],
    preview: {
      type: "text",
      src: "",
      excerpt:
        "最初は「AIで本当に稼げるの？」と半信半疑でした。でも実際にやってみると、" +
        "楽曲1曲をBGMとして配信するだけで月数千円の収益が積み上がることがわかり……",
    },
    body:
      "LIFAIの記事生成機能を使い、「AI副業を始めた3つの理由」というnote記事を生成しました。\n\n" +
      "生成にかかった時間は約30秒。テーマと文字数・語調を指定するだけで、" +
      "見出し3つの構成から本文まで一気に出力されます。\n\n" +
      "ポイントは「そのまま公開しないこと」です。生成された文章に" +
      "自分のリアルな体験や感想を1〜2段落追記することで、" +
      "AIっぽさが消えてオリジナリティのある記事になります。\n\n" +
      "実際にこの記事をnoteに投稿したところ、スキが23件・フォロワーが7人増えました。" +
      "完全にゼロから書くより圧倒的に速く、ブログ運営の継続ハードルが下がります。\n\n" +
      "週1本の投稿を3ヶ月続けると、検索流入が安定してくるため、" +
      "最初の1〜2ヶ月は量を重視して生成×編集を繰り返すのがおすすめです。",
    howTo:
      "記事生成画面で「テーマ」「文字数（500〜3000字）」「語調（ですます/だである）」を設定。" +
      "生成後に「自分の体験談」「具体的な数字」「締めのメッセージ」を追記して完成です。" +
      "SEOキーワードを指定する機能もあり、検索上位を狙った記事構成も可能です。",
    applications: [
      "noteへの定期投稿（週1本ペースでの継続運用）",
      "アメブロ・はてなブログへの転載",
      "メルマガの本文として活用",
      "X（Twitter）のロングポストに分割して投稿",
      "電子書籍の章のたたき台として使用",
    ],
    relatedSlugs: [],
  },
];

export const getFeaturedWorks = () => WORKS.filter(w => w.featured);
export const getWorkBySlug    = (slug: string) => WORKS.find(w => w.slug === slug) ?? null;
export const getRelatedWorks  = (slugs: string[]) => WORKS.filter(w => slugs.includes(w.slug));
export const getWorksByTab    = (tab: Work["tab"]) => WORKS.filter(w => w.tab === tab);
```

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit 2>&1 | grep "data/works"
```

Expected: 出力なし（エラーなし）

- [ ] **Step 3: コミット**

```bash
git add data/works.ts
git commit -m "feat(data): add works.ts with 5 sample works and utility functions"
```

---

## Task 2: `components/WorkCard.tsx` — 共用カードコンポーネント

**Files:**
- Create: `components/WorkCard.tsx`

- [ ] **Step 1: `components/WorkCard.tsx` を作成**

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Work } from "@/data/works";

type Props = {
  work: Work;
  variant?: "gallery" | "featured";
};

const TAB_COLOR: Record<Work["tab"], string> = {
  music:   "bg-indigo-50 text-indigo-700 ring-indigo-200",
  image:   "bg-violet-50 text-violet-700 ring-violet-200",
  article: "bg-orange-50 text-orange-700 ring-orange-200",
};

export default function WorkCard({ work, variant = "gallery" }: Props) {
  const badgeColor = TAB_COLOR[work.tab];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
      {/* プレビュー */}
      <div className="relative">
        {work.preview.type === "audio" && (
          <div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 px-4 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-2xl">
              🎵
            </div>
            {work.preview.src ? (
              <audio controls src={work.preview.src} className="w-full max-w-xs" />
            ) : (
              <p className="text-xs text-neutral-400">音源準備中</p>
            )}
          </div>
        )}

        {work.preview.type === "image" && (
          <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
            {work.preview.src ? (
              <Image
                src={work.preview.src}
                alt={work.preview.alt ?? work.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-300">
                画像準備中
              </div>
            )}
          </div>
        )}

        {work.preview.type === "text" && (
          <div className="bg-neutral-50 px-5 py-4">
            <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">
              {work.preview.excerpt}
            </p>
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="flex flex-1 flex-col p-5">
        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${badgeColor}`}>
          {work.category}
        </span>

        <h3 className="mt-2 text-base font-bold leading-snug text-neutral-900">
          {work.title}
        </h3>

        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 line-clamp-3">
          {work.description}
        </p>

        {/* 生成条件 */}
        <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            📝 生成条件
          </p>
          <p className="text-xs text-neutral-600 line-clamp-2">{work.prompt}</p>
        </div>

        {/* 用途タグ */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {work.useCases.map(tag => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/works/${work.slug}`}
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            詳しく見る →
          </Link>
          <Link
            href="/purchase"
            className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-neutral-800"
          >
            この作品を作る
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit 2>&1 | grep "components/WorkCard"
```

Expected: 出力なし

- [ ] **Step 3: コミット**

```bash
git add components/WorkCard.tsx
git commit -m "feat(components): add WorkCard shared component"
```

---

## Task 3: `app/works/[slug]/page.tsx` — 個別作品ページ

**Files:**
- Create: `app/works/[slug]/page.tsx`

- [ ] **Step 1: `app/works/[slug]/page.tsx` を作成**

```tsx
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
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* 戻るリンク */}
        <Link
          href="/gallery#works"
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          ← ギャラリーに戻る
        </Link>

        {/* ヘッダー */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
          <div className="p-8">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${BADGE[work.tab]}`}>
              {work.category}
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-neutral-900 md:text-3xl">
              {work.title}
            </h1>
          </div>
        </div>

        {/* プレビュー */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          {work.preview.type === "audio" && (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-4xl">
                🎵
              </div>
              {work.preview.src ? (
                <audio controls src={work.preview.src} className="w-full max-w-md" />
              ) : (
                <p className="text-sm text-neutral-400">音源は準備中です</p>
              )}
            </div>
          )}

          {work.preview.type === "image" && (
            <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
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
                <div className="flex h-full items-center justify-center text-sm text-neutral-300">
                  画像は準備中です
                </div>
              )}
            </div>
          )}

          {work.preview.type === "text" && (
            <div className="border-b border-neutral-100 bg-neutral-50 px-8 py-6">
              <p className="text-sm font-semibold text-neutral-400 mb-2">記事冒頭</p>
              <p className="leading-relaxed text-neutral-700">{work.preview.excerpt}</p>
            </div>
          )}
        </div>

        {/* 本文 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm p-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">📖 作品について</h2>
          <div className="space-y-4">
            {work.body.split("\n\n").map((para, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-neutral-600">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* 生成条件 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm p-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">📝 生成条件</h2>
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-5 py-4">
            <p className="font-mono text-sm text-neutral-700">{work.prompt}</p>
          </div>

          <h2 className="mb-3 mt-6 text-lg font-bold text-neutral-900">⚙️ 生成方法</h2>
          <p className="text-[15px] leading-relaxed text-neutral-600">{work.howTo}</p>
        </div>

        {/* 応用例 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm p-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">💡 応用例</h2>
          <ul className="space-y-2">
            {work.applications.map(app => (
              <li key={app} className="flex items-start gap-2.5 text-[15px] text-neutral-600">
                <span className="mt-0.5 shrink-0 text-xs font-bold text-indigo-400">✓</span>
                {app}
              </li>
            ))}
          </ul>
        </div>

        {/* 関連作品 */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">🔗 関連作品</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map(r => (
                <WorkCard key={r.slug} work={r} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm text-center">
          <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400" />
          <div className="p-8">
            <p className="text-lg font-bold text-neutral-900">この作品を自分でも作ってみる</p>
            <p className="mt-2 text-sm text-neutral-500">LIFAIに参加すると全機能が使えます</p>
            <Link
              href="/purchase"
              className="mt-6 inline-flex items-center rounded-xl bg-neutral-900 px-8 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              参加申請（権利購入）→
            </Link>
          </div>
        </div>

        {/* 戻るリンク（下部） */}
        <div className="mt-6 text-center">
          <Link
            href="/gallery#works"
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            ← ギャラリーに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit 2>&1 | grep "works"
```

Expected: 出力なし

- [ ] **Step 3: コミット**

```bash
git add app/works/
git commit -m "feat(works): add individual work detail pages with static generation"
```

---

## Task 4: `app/gallery/WorksShowcase.tsx` — タブ型ショーケース（Client Component）

**Files:**
- Create: `app/gallery/WorksShowcase.tsx`

- [ ] **Step 1: `app/gallery/WorksShowcase.tsx` を作成**

```tsx
"use client";

import { useState } from "react";
import { WORKS } from "@/data/works";
import type { Work } from "@/data/works";
import WorkCard from "@/components/WorkCard";

const TABS: { key: Work["tab"] | "all"; label: string }[] = [
  { key: "all",     label: "すべて" },
  { key: "music",   label: "🎵 音楽" },
  { key: "image",   label: "🖼️ 画像" },
  { key: "article", label: "✍️ 記事" },
];

export default function WorksShowcase() {
  const [activeTab, setActiveTab] = useState<Work["tab"] | "all">("all");

  const filtered = activeTab === "all"
    ? WORKS
    : WORKS.filter(w => w.tab === activeTab);

  return (
    <div>
      {/* タブ */}
      <div className="mb-6 flex gap-1 rounded-xl bg-neutral-100 p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              activeTab === t.key
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* カードグリッド */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(work => (
          <WorkCard key={work.slug} work={work} />
        ))}
      </div>

      <p className="mt-4 text-xs text-neutral-400">{filtered.length} 件</p>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit 2>&1 | grep "WorksShowcase"
```

Expected: 出力なし

- [ ] **Step 3: コミット**

```bash
git add app/gallery/WorksShowcase.tsx
git commit -m "feat(gallery): add WorksShowcase tab component"
```

---

## Task 5: `app/gallery/page.tsx` に #works セクションを追加

**Files:**
- Modify: `app/gallery/page.tsx`

- [ ] **Step 1: import を追加**

`app/gallery/page.tsx` の先頭 import に追加：

```tsx
import WorksShowcase from "./WorksShowcase";
```

既存の import は変更しない。

- [ ] **Step 2: フッター CTA の直前に #works セクションを挿入**

検索する文字列：
```tsx
      {/* ===== フッター CTA ===== */}
```

この直前に挿入：
```tsx
      {/* ===== #works: AI作品ショーケース ===== */}
      <section id="works" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-200">
              AI作品ショーケース
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
              LIFAIで実際に作った作品
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              音楽・画像・記事など、LIFAIで生成した作品を公開しています。
              プロンプトや生成条件もあわせて掲載しているので、すぐに試せます。
            </p>
            <div className="mt-6">
              <WorksShowcase />
            </div>
          </div>
        </div>
      </section>

```

- [ ] **Step 3: ブラウザで確認**

`http://localhost:3000/gallery` を開き：
1. ページ最下部（フッターCTAの上）に「AI作品ショーケース」セクションが表示される
2. タブ（すべて/音楽/画像/記事）で切り替えできる
3. カードに「詳しく見る」と「この作品を作る」ボタンがある
4. 「詳しく見る」を押すと `/works/lofi-night-bgm` などに遷移する

- [ ] **Step 4: コミット**

```bash
git add app/gallery/page.tsx
git commit -m "feat(gallery): add #works showcase section with tab filtering"
```

---

## Task 6: `components/GalleryNav.tsx` に「作品集」を追加

**Files:**
- Modify: `components/GalleryNav.tsx`

- [ ] **Step 1: NAV_ITEMS に `works` を追加**

検索する文字列：
```ts
  { id: "lifaneko", label: "LIFAネコ" },
] as const;
```

置換後：
```ts
  { id: "lifaneko", label: "LIFAネコ" },
  { id: "works",    label: "🎨 作品集" },
] as const;
```

- [ ] **Step 2: ブラウザで確認**

`http://localhost:3000/gallery` を開き：
1. スティッキーナビの末尾に「🎨 作品集」が表示される
2. クリックすると `#works` セクションにスクロールされる

- [ ] **Step 3: コミット**

```bash
git add components/GalleryNav.tsx
git commit -m "feat(gallery-nav): add 作品集 anchor to sticky nav"
```

---

## Task 7: `app/page.tsx` に featured 作品を埋め込む

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: import を追加**

`app/page.tsx` 先頭に追加：

```tsx
import Link from "next/link";
import { getFeaturedWorks } from "@/data/works";
import WorkCard from "@/components/WorkCard";
```

`app/page.tsx` はすでに `"use client"` なので `getFeaturedWorks()` を呼び出すときはコンポーネント本体内で呼ぶ（トップレベルの変数として定義する）。

- [ ] **Step 2: featured 作品セクションを追加**

`app/page.tsx` 内の「はじめ方」セクションブロック（`/* ===== 始め方 ===== */` コメント）の直前に挿入：

```tsx
        {/* ===== AI作品サンプル ===== */}
        {(() => {
          const featured = getFeaturedWorks();
          if (featured.length === 0) return null;
          return (
            <div className="mt-12">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">AIで実際に作れるもの</div>
                  <div className="text-xs text-slate-500 mt-0.5">LIFAIで生成した作品サンプル</div>
                </div>
                <Link
                  href="/gallery#works"
                  className="text-xs text-indigo-600 font-semibold hover:underline underline-offset-4"
                >
                  すべて見る →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {featured.map(work => (
                  <WorkCard key={work.slug} work={work} />
                ))}
              </div>
            </div>
          );
        })()}

```

- [ ] **Step 3: ブラウザで確認**

`http://localhost:3000` を開き：
1. 「はじめ方」セクションの上に「AIで実際に作れるもの」セクションが表示される
2. featured 作品（`lofi-night-bgm` と `cinematic-sea-image`）のカードが2枚表示される
3. 「すべて見る →」が `/gallery#works` に遷移する
4. カードの「詳しく見る」が `/works/[slug]` に遷移する

- [ ] **Step 4: コミット**

```bash
git add app/page.tsx
git commit -m "feat(top): embed featured works section on top page"
```

---

## 最終確認チェックリスト

- [ ] `/gallery` — #works セクションが最下部フッターCTAの上にある
- [ ] `/gallery` — タブ切り替えが機能する（すべて/音楽/画像/記事）
- [ ] `/gallery` — スティッキーナビに「作品集」がある
- [ ] `/works/lofi-night-bgm` — 個別ページが開く
- [ ] `/works/lofi-night-bgm` — 本文・生成条件・生成方法・応用例が表示される
- [ ] `/works/lofi-night-bgm` — 関連作品カードが表示される（cafe-jazz-bgm）
- [ ] `/works/lofi-night-bgm` — 「詳しく見る」「この作品を作る」「← ギャラリーに戻る」が機能する
- [ ] `/` — featured 作品2枚が表示される
- [ ] `npx tsc --noEmit` — エラーなし
