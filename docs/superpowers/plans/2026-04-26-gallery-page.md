# /gallery ギャラリーページ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログイン前ユーザー向けに LIFAI の全サービスのデモ・サンプルを展示する静的ギャラリーページ `/gallery` を作成する

**Architecture:** サーバーコンポーネント `app/gallery/page.tsx` + クライアントコンポーネント `components/GalleryNav.tsx` の2ファイル構成。11サービスセクションをマガジン型レイアウトで縦積み。コンテンツはすべて静的ハードコード。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS

---

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `components/GalleryNav.tsx` | スティッキーアンカーナビ（クライアントコンポーネント）。IntersectionObserver でアクティブセクションをハイライト |
| `app/gallery/page.tsx` | メインページ（サーバーコンポーネント）。ヒーロー・11セクション・AdSense予約スロット・フッターを含む |

---

### Task 1: GalleryNav コンポーネント

**Files:**
- Create: `components/GalleryNav.tsx`

- [ ] **Step 1: GalleryNav.tsx を作成**

```tsx
// components/GalleryNav.tsx
"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "music", label: "音楽生成" },
  { id: "bgm", label: "BGM" },
  { id: "image", label: "画像生成" },
  { id: "note", label: "note記事" },
  { id: "fortune", label: "占い" },
  { id: "music-boost", label: "Music Boost" },
  { id: "games", label: "ゲーム" },
  { id: "gacha", label: "ガチャ" },
  { id: "market", label: "マーケット" },
  { id: "radio", label: "ラジオ" },
  { id: "lifaneko", label: "LIFAネコ" },
] as const;

export default function GalleryNav() {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex gap-1 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeId === id
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add components/GalleryNav.tsx
git commit -m "feat(gallery): add GalleryNav sticky anchor nav component"
```

---

### Task 2: Gallery ページシェル（ヒーロー＋ナビ＋フッター）

**Files:**
- Create: `app/gallery/page.tsx`

- [ ] **Step 1: ページシェルを作成**

```tsx
// app/gallery/page.tsx
import Image from "next/image";
import Link from "next/link";
import GalleryNav from "@/components/GalleryNav";

export const metadata = {
  title: "LIFAIでできること｜AI副業サービス一覧・デモ",
  description:
    "LIFAIの全サービスを体験できるギャラリーページ。音楽生成・画像生成・note記事・占いなど、ログイン前にサンプルを確認できます。",
};

export default function GalleryPage() {
  return (
    <main id="top" className="min-h-screen bg-neutral-50">
      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              ← 最初に戻る
            </Link>
            <div className="flex gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
              >
                ログイン
              </Link>
              <Link
                href="/purchase"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                参加申請
              </Link>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
            LIFAI でできること
          </h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            AI×副業のサービスをまとめて体験できる場所です。
            <br />
            音楽・画像・記事・占い・ゲームなど、全機能のサンプルをここで確認できます。
          </p>
          <p className="mt-4 text-xs text-neutral-400">
            ↓ 気になるサービスを選んで確認してください
          </p>
        </div>
      </section>

      {/* ===== スティッキーナビ ===== */}
      <GalleryNav />

      {/* ===== サービスセクション（後続タスクで追加） ===== */}

      {/* ===== フッター CTA ===== */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
          <h2 className="text-xl font-bold text-neutral-900">
            LIFAIに参加して、体験してみよう
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            全機能はメンバー限定です。まずは参加申請から始めてください。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/purchase"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              参加申請（権利購入）
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              すでにIDをお持ちの方
            </Link>
            <Link
              href="#top"
              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
            >
              ページ上部へ ↑
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-neutral-500">
          © {new Date().getFullYear()} LIFAI
        </div>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功・`/gallery` が静的ページとして生成される

- [ ] **Step 3: コミット**

```bash
git add app/gallery/page.tsx
git commit -m "feat(gallery): add gallery page shell with hero and footer"
```

---

### Task 3: セクション 1〜4（音楽・BGM・画像・note）

**Files:**
- Modify: `app/gallery/page.tsx`

- [ ] **Step 1: `{/* ===== サービスセクション（後続タスクで追加） ===== */}` を以下の JSX で置き換える**

```tsx
      {/* ===== #music: 音楽生成 ===== */}
      <section id="music" className="mx-auto max-w-5xl px-4 pb-12 pt-4">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-indigo-600">音楽生成</p>
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-neutral-900">
                AIで楽曲を作り、配信・BGMで収益化
              </h2>
              <p className="mt-3 text-sm leading-7 text-neutral-700">
                楽器経験ゼロでも、テキストを入力するだけで本格的な楽曲が生成できます。
                作った楽曲は配信ストアへ登録するか、LIFAI経由でBGM提供として収益化できます。
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                <li>・テキスト入力だけで曲が完成</li>
                <li>・Spotify・Apple Music などへ配信可能</li>
                <li>・店舗BGMとして使われるほど収益が積み上がる</li>
                <li>・1曲から始められる</li>
              </ul>
              <Link
                href="/purchase"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                参加して使ってみる →
              </Link>
            </div>
            <div className="flex w-full shrink-0 items-center justify-center rounded-xl border bg-neutral-50 p-6 md:w-56">
              <div className="relative h-32 w-32">
                <Image
                  src="/lifai/icon/music.png"
                  alt="音楽生成サンプル"
                  fill
                  className="object-contain"
                  sizes="128px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ad-slot-1 */}
      <div className="mx-auto max-w-5xl px-4 pb-6" aria-hidden="true">
        <div className="h-0 w-full" />
      </div>

      {/* ===== #bgm: BGM生成 ===== */}
      <section id="bgm" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-teal-600">BGM生成</p>
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-neutral-900">
                用途別BGMをワンクリック生成
              </h2>
              <p className="mt-3 text-sm leading-7 text-neutral-700">
                「カフェ向けジャズ」「集中作業用ローファイ」など、用途を選ぶだけでBGMが生成できます。
                ループ再生に最適化された出力なので、そのままお店や動画で使えます。
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                <li>・カフェ・オフィス・リラックスなど多彩なジャンル</li>
                <li>・30秒〜数分の長さを指定可能</li>
                <li>・ループ再生に最適化された出力</li>
              </ul>
              <Link
                href="/purchase"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                参加して使ってみる →
              </Link>
            </div>
            <div className="w-full shrink-0 rounded-xl border bg-neutral-50 p-5 md:w-56">
              <p className="mb-3 text-xs font-bold text-neutral-500">BGMカテゴリ例</p>
              <div className="flex flex-wrap gap-2">
                {["カフェBGM", "作業用ローファイ", "リラックス", "アップテンポ", "ジャズ", "クラシック"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-neutral-700"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== #image: 画像生成 ===== */}
      <section id="image" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-violet-600">画像生成</p>
          <h2 className="text-xl font-bold text-neutral-900">
            AIで画像を自由に生成
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            テキストで説明するだけで、サムネイル・アイキャッチ・バナーなどが生成できます。
            SNS投稿や広告・ストック販売用の素材として活用できます。
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {(["/aiimage.png", null, null] as (string | null)[]).map((src, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-xl border bg-neutral-100"
              >
                {src ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={src}
                      alt={`AI生成画像サンプル${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    サンプル画像
                  </div>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>

      {/* ===== #note: note記事生成 ===== */}
      <section id="note" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-orange-600">note記事生成</p>
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-neutral-900">
                売れるnote記事をAIで自動生成
              </h2>
              <p className="mt-3 text-sm leading-7 text-neutral-700">
                テーマを入力するだけで構成・タイトル・本文を自動生成します。
                そのままnoteに投稿して収益化できます。
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                <li>・売れやすいタイトル候補を複数提案</li>
                <li>・有料・無料パート構成を自動設計</li>
                <li>・SNS投稿文も同時生成</li>
                <li>・3ステップで完成</li>
              </ul>
              <Link
                href="/purchase"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                参加して使ってみる →
              </Link>
            </div>
            <div className="w-full shrink-0 rounded-xl border bg-neutral-50 p-5 md:w-56">
              <p className="mb-2 text-xs font-bold text-neutral-500">生成サンプル</p>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-xs font-bold text-neutral-900">
                  副業で月5万円を達成した私がやった3つのこと
                </p>
                <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                  会社員でも副業で稼げるの？という疑問に答えます。実際にやってみた方法をステップごとに解説します...
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    おすすめ度 ★★★★★
                  </span>
                  <span className="text-[10px] text-neutral-400">¥500</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 後続セクション（次タスクで追加） ===== */}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add app/gallery/page.tsx
git commit -m "feat(gallery): add sections music, bgm, image, note"
```

---

### Task 4: セクション 5〜8（占い・Music Boost・ゲーム・ガチャ）

**Files:**
- Modify: `app/gallery/page.tsx`

- [ ] **Step 1: `{/* ===== 後続セクション（次タスクで追加） ===== */}` を以下の JSX で置き換える**

```tsx
      {/* ===== #fortune: 占い ===== */}
      <section id="fortune" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-amber-600">占い</p>
          <h2 className="text-xl font-bold text-neutral-900">毎日のAI性格診断＆運勢</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            性格タイプ診断のあと、毎日その日の運勢をAIが提供します。
            占いを見るだけでBPも獲得できるので、ログインのモチベーションにもなります。
          </p>
          <div className="mt-6 rounded-xl border bg-amber-50 p-6">
            <p className="mb-4 text-xs font-bold text-amber-700">サンプル占い結果</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-semibold text-neutral-500">今日のテーマ</span>
                <span className="font-semibold text-neutral-900">直感を大切にする日</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "仕事運", stars: "★★★★☆" },
                  { label: "恋愛運", stars: "★★★☆☆" },
                  { label: "金運", stars: "★★★★★" },
                ].map(({ label, stars }) => (
                  <div key={label} className="rounded-lg border bg-white p-3 text-center">
                    <p className="text-xs text-neutral-500">{label}</p>
                    <p className="mt-1 text-xs font-bold text-amber-500">{stars}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-xs text-neutral-600">
                <span>ラッキーカラー: <b>ゴールド</b></span>
                <span>ラッキーアイテム: <b>手帳</b></span>
              </div>
            </div>
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>

      {/* ad-slot-2 */}
      <div className="mx-auto max-w-5xl px-4 pb-6" aria-hidden="true">
        <div className="h-0 w-full" />
      </div>

      {/* ===== #music-boost: Music Boost ===== */}
      <section id="music-boost" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-pink-600">Music Boost</p>
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-neutral-900">
                アーティスト活動を後押しするブースト機能
              </h2>
              <p className="mt-3 text-sm leading-7 text-neutral-700">
                楽曲の宣伝・プロモーションをLIFAIがサポートします。
                ブーストプランを選ぶだけで配信数・露出が増え、アーティストとして認知されやすくなります。
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                <li>・月額定額のブーストプラン</li>
                <li>・アーティスト情報ページの作成</li>
                <li>・LIFAI内での優先表示</li>
                <li>・楽曲リリースのサポート</li>
              </ul>
              <Link
                href="/purchase"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                参加して使ってみる →
              </Link>
            </div>
            <div className="w-full shrink-0 rounded-xl border bg-pink-50 p-5 md:w-56">
              <p className="mb-3 text-xs font-bold text-pink-700">ブーストプラン例</p>
              <div className="space-y-2">
                {[
                  { name: "ライト", price: "月500BP〜" },
                  { name: "スタンダード", price: "月1,500BP〜" },
                  { name: "プレミアム", price: "月3,000BP〜" },
                ].map(({ name, price }) => (
                  <div key={name} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs">
                    <span className="font-semibold text-neutral-800">{name}</span>
                    <span className="text-neutral-500">{price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== #games: ミニゲーム ===== */}
      <section id="games" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-green-600">ミニゲーム</p>
          <h2 className="text-xl font-bold text-neutral-900">
            ポイントを稼ぐミニゲーム
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            タップゲームで高スコアを出してEPを獲得。バトルロイヤル形式のランブルで上位を目指すとBPも稼げます。
            遊びながらポイントを増やせるのがLIFAIのミニゲームの特徴です。
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-green-50 p-5">
              <p className="text-xs font-bold text-green-700">タップゲーム</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">ハイスコア</span>
                  <span className="font-bold text-neutral-900">1,248 pt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">ランキング</span>
                  <span className="font-bold text-neutral-900">3位 / 全体</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">獲得EP</span>
                  <span className="font-bold text-green-700">+120 EP</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-neutral-50 p-5">
              <p className="text-xs font-bold text-neutral-600">ランブル（バトル）</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">最終順位</span>
                  <span className="font-bold text-neutral-900">12位 / 128人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">バトル結果</span>
                  <span className="font-bold text-neutral-900">7勝 3敗</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">獲得BP</span>
                  <span className="font-bold text-indigo-700">+80 BP</span>
                </div>
              </div>
            </div>
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>

      {/* ad-slot-3 */}
      <div className="mx-auto max-w-5xl px-4 pb-6" aria-hidden="true">
        <div className="h-0 w-full" />
      </div>

      {/* ===== #gacha: ガチャ ===== */}
      <section id="gacha" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-purple-600">ガチャ</p>
          <h2 className="text-xl font-bold text-neutral-900">
            デイリーガチャでレアアイテムを獲得
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            毎日1回無料でガチャが引けます。レアアイテムはBPや特典と交換可能。
            BPを消費することで追加ガチャも引けます。
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              { rarity: "スーパーレア", item: "音楽生成チケット×3", color: "from-amber-400 to-orange-500", textColor: "text-white" },
              { rarity: "レア", item: "AIプロンプトパック", color: "from-violet-400 to-purple-600", textColor: "text-white" },
              { rarity: "ノーマル", item: "デイリーBP +50", color: "from-neutral-100 to-neutral-200", textColor: "text-neutral-700" },
            ].map(({ rarity, item, color, textColor }) => (
              <div
                key={rarity}
                className={`rounded-xl bg-gradient-to-br ${color} p-5 text-center`}
              >
                <p className={`text-[10px] font-bold ${textColor} opacity-80`}>{rarity}</p>
                <p className={`mt-2 text-sm font-bold ${textColor}`}>{item}</p>
              </div>
            ))}
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>

      {/* ===== 後続セクション（次タスクで追加） ===== */}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add app/gallery/page.tsx
git commit -m "feat(gallery): add sections fortune, music-boost, games, gacha"
```

---

### Task 5: セクション 9〜11（マーケット・ラジオ・LIFAネコ）＋最終確認

**Files:**
- Modify: `app/gallery/page.tsx`

- [ ] **Step 1: `{/* ===== 後続セクション（次タスクで追加） ===== */}` を以下の JSX で置き換える**

```tsx
      {/* ===== #market: マーケット ===== */}
      <section id="market" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-blue-600">マーケット</p>
          <h2 className="text-xl font-bold text-neutral-900">
            メンバー同士でテンプレや情報を売買
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            自分が作ったnoteテンプレやAIプロンプト集をBPで販売できます。
            他のメンバーの成果物を購入して、自分の副業に活かすことも可能です。
          </p>
          <div className="mt-6 space-y-3">
            {[
              { title: "副業で月5万円稼ぐnoteテンプレ集", price: "3,000 BP", seller: "メンバーA", tag: "note" },
              { title: "AIプロンプト集 vol.1（画像生成100選）", price: "1,200 BP", seller: "メンバーB", tag: "画像" },
              { title: "LP制作ワークフロー完全版", price: "2,500 BP", seller: "メンバーC", tag: "制作" },
            ].map(({ title, price, seller, tag }) => (
              <div key={title} className="flex items-center justify-between rounded-xl border bg-neutral-50 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{tag}</span>
                    <span className="text-[10px] text-neutral-400">{seller}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">{title}</p>
                </div>
                <p className="ml-4 shrink-0 text-sm font-bold text-indigo-700">{price}</p>
              </div>
            ))}
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>

      {/* ad-slot-4 */}
      <div className="mx-auto max-w-5xl px-4 pb-6" aria-hidden="true">
        <div className="h-0 w-full" />
      </div>

      {/* ===== #radio: ラジオ ===== */}
      <section id="radio" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-rose-600">ラジオ</p>
          <h2 className="text-xl font-bold text-neutral-900">LIFAI公式ラジオ</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            AI副業の最新情報や成功事例をラジオ形式で発信しています。
            移動中でも学べるコンテンツを定期配信中です。
          </p>
          <div className="mt-6 space-y-3">
            {[
              { ep: "ep.15", title: "2025年のAI副業トレンド完全解説", duration: "23:14" },
              { ep: "ep.14", title: "月10万円達成メンバーのリアルな話", duration: "18:42" },
              { ep: "ep.13", title: "初心者がやりがちな3つのミスと対策", duration: "15:30" },
            ].map(({ ep, title, duration }) => (
              <div key={ep} className="flex items-center gap-4 rounded-xl border bg-neutral-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  ▶
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-rose-600">{ep}</p>
                  <p className="text-sm font-semibold text-neutral-900">{title}</p>
                </div>
                <span className="shrink-0 text-xs text-neutral-400">{duration}</span>
              </div>
            ))}
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>

      {/* ===== #lifaneko: LIFAネコ + ギフト ===== */}
      <section id="lifaneko" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold text-cyan-600">LIFAネコ＋ギフト</p>
          <h2 className="text-xl font-bold text-neutral-900">LIFAネコ＆ギフト機能</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            AIキャラクター「LIFAネコ」がサロン内をガイドしてくれます。
            メンバー間でBP/EPを贈り合うギフト機能も楽しめます。
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="flex gap-4 rounded-xl border bg-cyan-50 p-5">
              <div className="relative h-16 w-16 shrink-0">
                <Image
                  src="/aibot/cat_normal.png"
                  alt="LIFAネコ"
                  fill
                  className="object-contain"
                  sizes="64px"
                />
              </div>
              <div className="relative flex-1 rounded-xl border bg-white p-3">
                <p className="text-xs leading-5 text-neutral-700">
                  今日も副業がんばろうにゃ！<br />
                  ログインボーナスを忘れずに！
                </p>
                <div className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 border-b border-l bg-white" />
              </div>
            </div>
            <div className="rounded-xl border bg-neutral-50 p-5">
              <p className="mb-3 text-xs font-bold text-neutral-600">ギフト機能</p>
              <p className="text-sm leading-6 text-neutral-700">
                BP・EPをメンバーに贈ることができます。感謝の気持ちをポイントで表現しましょう。
              </p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  BP を贈る
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  EP を贈る
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/purchase"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            参加して使ってみる →
          </Link>
        </div>
      </section>
```

- [ ] **Step 2: 最終ビルド確認**

```bash
npm run build
```

Expected: ビルド成功・`/gallery` が静的ページとして生成される

- [ ] **Step 3: 最終コミット**

```bash
git add app/gallery/page.tsx
git commit -m "feat(gallery): complete all service sections - gallery page done"
```
