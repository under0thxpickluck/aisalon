# ライト/ダークモード切り替え実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全ページにライト/ダーク切り替えを追加する。ダークがデフォルト、手動トグルのみ、`localStorage` に保存。

**Architecture:** `ThemeContext` を `layout.tsx` でラップし `<html>` タグに `dark` クラスを付与/除去。Tailwind `darkMode: 'class'` で全コンポーネント・ページが `dark:` プレフィックスクラスで対応。`ThemeToggle` はグローバルに1か所のみ。

**Tech Stack:** Next.js 14 App Router, Tailwind CSS (darkMode: 'class'), React Context, localStorage

## Global Constraints

- 既存クラスを削除しない — `dark:` バリアントを末尾に追加するだけ
- 既存の JSX 構造・ロジックを変更しない
- localStorage キー: `lifai_theme_v1`（既存のまま）
- `dark` クラスが `<html>` に付いている = ダークモード（デフォルト）
- `dark` クラスがない = ライトモード

---

### Task 1: コアインフラ

**Files:**
- Modify: `tailwind.config.ts`
- Create: `app/lib/ThemeContext.tsx`
- Modify: `app/lib/useTheme.ts`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `ThemeProvider` (React component), `useTheme()` hook — returns `{ isDark: boolean; toggleTheme: () => void }`

- [ ] **Step 1: tailwind.config.ts に `darkMode: 'class'` を追加**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
```

- [ ] **Step 2: ThemeContext.tsx を新規作成**

```tsx
// app/lib/ThemeContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const THEME_KEY = "lifai_theme_v1";

type ThemeCtx = { isDark: boolean; toggleTheme: () => void };

const ThemeContext = createContext<ThemeCtx>({ isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const dark = stored !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 3: useTheme.ts を ThemeContext の re-export に変更**

```ts
// app/lib/useTheme.ts
"use client";
export { useTheme } from "./ThemeContext";
```

- [ ] **Step 4a: GlobalThemeToggleWrapper.tsx を新規作成**

`layout.tsx` は Server Component なので、Client Component である `ThemeToggle` を `useTheme()` と組み合わせるためのラッパーを別ファイルに作る:

```tsx
// app/components/GlobalThemeToggleWrapper.tsx
"use client";
import { useTheme } from "@/app/lib/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export function GlobalThemeToggleWrapper() {
  const { isDark, toggleTheme } = useTheme();
  return <ThemeToggle isDark={isDark} onToggle={toggleTheme} />;
}
```

- [ ] **Step 4b: layout.tsx に ThemeProvider と GlobalThemeToggleWrapper を追加**

```tsx
// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { ToastHost } from "@/components/Toast";
import { LifaiCatProvider } from "@/components/LifaiCat";
import LifaiCatGlobal from "@/components/LifaiCatGlobal";
import { ThemeProvider } from "@/app/lib/ThemeContext";
import { GlobalThemeToggleWrapper } from "@/app/components/GlobalThemeToggleWrapper";

export const metadata: Metadata = {
  title: {
    default: "LIFAI | AI副業コミュニティ",
    template: "%s | LIFAI",
  },
  description: "AI × LIFE × 副業。学びを収益に変えるオンラインサロン。",
  applicationName: "LIFAI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aisalon-sigma.vercel.app"),
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LIFAI",
    title: "LIFAI | AI副業コミュニティ",
    description: "AI × LIFE × 副業。学びを収益に変えるオンラインサロン。",
    images: [
      {
        url: "/ogp2.png",
        width: 1200,
        height: 630,
        alt: "LIFAI",
      },
    ],
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "LIFAI | AI副業コミュニティ",
    description: "AI × LIFE × 副業。学びを収益に変えるオンラインサロン。",
    images: ["/ogp.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1022",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3054861636143808"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeProvider>
          <LifaiCatProvider>
            <ToastHost />
            <GlobalThemeToggleWrapper />
            {children}
            <LifaiCatGlobal />
          </LifaiCatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: globals.css のボディスタイルをライト/ダーク対応に変更**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  height: 100%;
}
body {
  margin: 0;
  background: #f8fafc;
  color: #0f172a;
}
html.dark body {
  background: #070A12;
  color: #ffffff;
}
.lifai-grid {
  background-image:
    linear-gradient(to right, rgba(24,24,27,0.14) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(24,24,27,0.14) 1px, transparent 1px);
  background-size: 56px 56px;
}
```

- [ ] **Step 6: 動作確認**

開発サーバーを起動して `http://localhost:3000` を開き、右上のトグルボタンでライト/ダーク切り替えが動作することを確認する（bodyの背景色が切り替わる）。

```bash
npm run dev
```

- [ ] **Step 7: commit**

```bash
git add tailwind.config.ts app/lib/ThemeContext.tsx app/lib/useTheme.ts app/layout.tsx app/globals.css app/components/GlobalThemeToggleWrapper.tsx
git commit -m "feat: ThemeContext・グローバルThemeToggle・Tailwind darkMode設定を追加"
```

---

### Task 2: フォームコンポーネント (Field, Select, PlanPicker)

**Files:**
- Modify: `components/Field.tsx`
- Modify: `components/Select.tsx`
- Modify: `components/PlanPicker.tsx`

**Interfaces:**
- Consumes: Tailwind `dark:` variants (from Task 1)
- Produces: フォームコンポーネントのライト/ダーク対応

- [ ] **Step 1: Field.tsx に dark: バリアントを追加**

ラベル行を変更（`text-slate-900` → `text-slate-900 dark:text-slate-100`）:
```tsx
<label htmlFor={id} className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
```

コンテナ div のクラスを変更（`border-slate-300` と `bg-white` に dark: を追加）:
```tsx
<div
  className={[
    "mt-2 rounded-2xl border bg-white dark:bg-gray-900 px-4 py-3 shadow-sm",
    hasError
      ? "border-rose-400 ring-2 ring-rose-100"
      : "border-slate-300 dark:border-gray-600 focus-within:border-slate-900 dark:focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200 dark:focus-within:ring-slate-700",
  ].join(" ")}
>
```

input のクラスを変更:
```tsx
<input
  id={id}
  type={type}
  value={value}
  onChange={(e) => onChange(e.target.value)}
  placeholder={placeholder}
  maxLength={maxLength}
  className="w-full bg-transparent text-[15px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
  autoComplete="off"
/>
```

hint テキストを変更:
```tsx
{hint ? <div className="mt-2 text-[12px] font-semibold text-slate-600 dark:text-slate-400">{hint}</div> : null}
```

- [ ] **Step 2: Select.tsx に dark: バリアントを追加**

ラベルを変更:
```tsx
<label htmlFor={id} className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
```

コンテナを変更:
```tsx
<div
  className={[
    "mt-2 rounded-2xl border bg-white dark:bg-gray-900 px-4 py-3 shadow-sm",
    hasError
      ? "border-rose-400 ring-2 ring-rose-100"
      : "border-slate-300 dark:border-gray-600 focus-within:border-slate-900 dark:focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200 dark:focus-within:ring-slate-700",
  ].join(" ")}
>
```

select タグを変更:
```tsx
<select
  id={id}
  value={value}
  onChange={(e) => onChange(e.target.value)}
  className="w-full bg-transparent text-[15px] font-semibold text-slate-900 dark:text-white outline-none"
>
```

- [ ] **Step 3: PlanPicker.tsx に dark: バリアントを追加**

アクティブ時のクラスを変更（`text-violet-700` に dark: を追加）:
```tsx
<div className={active ? "text-xs font-semibold text-violet-700 dark:text-violet-400" : "text-xs font-semibold text-violet-200"}>
```

（ボタン本体はすでにダーク対応済みのクラスを使っているためそのままでよい）

- [ ] **Step 4: commit**

```bash
git add components/Field.tsx components/Select.tsx components/PlanPicker.tsx
git commit -m "feat: Field・Select・PlanPicker に dark: バリアントを追加"
```

---

### Task 3: レイアウト・ナビコンポーネント (AppSidebar, GalleryNav, WorkCard)

**Files:**
- Modify: `components/AppSidebar.tsx`
- Modify: `components/GalleryNav.tsx`
- Modify: `components/WorkCard.tsx`

**Interfaces:**
- Consumes: Tailwind `dark:` variants (from Task 1)

- [ ] **Step 1: AppSidebar.tsx に dark: バリアントを追加**

aside タグを変更:
```tsx
<aside className="w-52 flex-shrink-0 flex flex-col gap-4">
```
（aside 自体は変更なし、内部カードを変更）

残高カードを変更:
```tsx
<div className="rounded-[18px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">残高</p>
  {balanceLoading ? (
    <p className="text-[11px] text-slate-400 dark:text-slate-500">読み込み中…</p>
  ) : (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">BP</span>
        <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
          {bp ?? "–"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">EP</span>
        <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
          {ep ?? "–"}
        </span>
      </div>
    </div>
  )}
</div>
```

ナビカードを変更:
```tsx
<div className="rounded-[18px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2 px-1">メニュー</p>
  <nav className="flex flex-col gap-0.5">
    {navItems.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className={[
          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
          activePage === item.href
            ? "bg-indigo-600 text-white"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800",
        ].join(" ")}
      >
        <span>{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    ))}
  </nav>
</div>
```

- [ ] **Step 2: GalleryNav.tsx に dark: バリアントを追加**

nav タグを変更:
```tsx
<nav className="sticky top-0 z-30 border-b border-neutral-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
```

ナビアイテムのクラスを変更:
```tsx
className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
  activeId === id
    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-gray-800"
}`}
```

- [ ] **Step 3: WorkCard.tsx に dark: バリアントを追加**

外側コンテナを変更:
```tsx
<div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
```

audio プレビューエリアを変更:
```tsx
<div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 dark:bg-gray-800 px-4 py-6">
  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-2xl">
```

画像プレビューを変更:
```tsx
<div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-gray-800">
```

テキストプレビューを変更:
```tsx
<div className="bg-neutral-50 dark:bg-gray-800 px-5 py-4">
  <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
```

コンテンツエリアのテキストを変更:
```tsx
<h3 className="mt-2 text-base font-bold leading-snug text-neutral-900 dark:text-white">
<p className="mt-2 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400 line-clamp-3">
```

生成条件ボックスを変更:
```tsx
<div className="mt-3 rounded-lg bg-neutral-50 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 px-3 py-2">
  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
  <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2">
```

用途タグを変更:
```tsx
<span className="rounded-full bg-neutral-100 dark:bg-gray-800 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
```

CTAボタンを変更:
```tsx
<Link
  href={`/works/${work.slug}`}
  className="flex-1 rounded-xl border border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition hover:bg-neutral-50 dark:hover:bg-gray-700"
>
```

- [ ] **Step 4: commit**

```bash
git add components/AppSidebar.tsx components/GalleryNav.tsx components/WorkCard.tsx
git commit -m "feat: AppSidebar・GalleryNav・WorkCard に dark: バリアントを追加"
```

---

### Task 4: ダーク系コンポーネント (StepHeader, WalletBadge, CopyField, GameTile)

**Files:**
- Modify: `components/StepHeader.tsx`
- Modify: `components/WalletBadge.tsx`
- Modify: `components/CopyField.tsx`
- Modify: `components/GameTile.tsx`

これらは元々ダーク背景を前提としたコンポーネント。ライトモード時に対応するため `dark:` を追加し、ライト側のデフォルトスタイルを追加する。

- [ ] **Step 1: StepHeader.tsx のライトモード対応**

```tsx
"use client";

export function StepHeader({
  step,
  total = 3,
  title,
  subtitle,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
}) {
  const pct = Math.max(0, Math.min(100, (step / total) * 100));

  return (
    <div className="mb-4">
      <div className="text-xs font-bold tracking-widest text-violet-600 dark:text-violet-200/90">
        STEP {step} / {total}
      </div>

      <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-300/80">{subtitle}</div> : null}

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: WalletBadge.tsx のライトモード対応**

```tsx
return (
  <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white">
    <div className="font-semibold">BP: {bp}</div>
    <div className="opacity-70">/</div>
    <div className="font-semibold">EP: {ep}</div>
    {err ? <div className="ml-2 text-xs opacity-60">({err})</div> : null}
  </div>
);
```

- [ ] **Step 3: CopyField.tsx のライトモード対応**

```tsx
return (
  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
      <button
        type="button"
        onClick={onCopy}
        className="relative z-10 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-xs font-extrabold text-white hover:opacity-95 active:scale-[0.99]"
      >
        コピー
      </button>
    </div>
    <div className="mt-3 select-all break-all rounded-xl bg-black/10 dark:bg-black/25 px-3 py-2 text-xs text-slate-700 dark:text-slate-100">
      {value}
    </div>
  </div>
);
```

- [ ] **Step 4: GameTile.tsx のライトモード対応**

`base` 変数を変更:
```tsx
const base =
  "group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl transition";
```

タイトルテキストを変更:
```tsx
<div className="text-base font-extrabold text-slate-900 dark:text-white">{title}</div>
{subtitle ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-300/80">{subtitle}</div> : null}
```

- [ ] **Step 5: commit**

```bash
git add components/StepHeader.tsx components/WalletBadge.tsx components/CopyField.tsx components/GameTile.tsx
git commit -m "feat: StepHeader・WalletBadge・CopyField・GameTile にライトモード対応を追加"
```

---

### Task 5: モーダルコンポーネント (GachaModal, BPGrantModal, LoginBonusModal, StakingModal, GiftEPTutorial, MusicSellApprovedModal)

**Files:**
- Modify: `components/GachaModal.tsx`
- Modify: `components/BPGrantModal.tsx`
- Modify: `components/LoginBonusModal.tsx`
- Modify: `components/StakingModal.tsx`
- Modify: `components/GiftEPTutorial.tsx`
- Modify: `components/MusicSellApprovedModal.tsx`

これらのモーダルはすべて `position: fixed` / `inset: 0` のオーバーレイ。ライトモード時もオーバーレイは半透明黒でよい。内部パネルのみライトモード対応する。

各ファイルを開き、以下のパターンで変更する:

**モーダル内パネルの共通パターン:**
- `bg-[#1a1a2e]` / `bg-[#111827]` / `bg-gray-900` / `bg-zinc-900` など暗い背景色 → 前にライト用 `bg-white` を追加し、元の色を `dark:bg-[...]` にする
- `text-white` → `text-slate-900 dark:text-white`
- `text-zinc-100` / `text-slate-100` → `text-slate-900 dark:text-zinc-100`
- `text-zinc-400` / `text-slate-300` → `text-slate-600 dark:text-zinc-400`
- `border-white/10` → `border-slate-200 dark:border-white/10`
- `bg-zinc-800` → `bg-slate-100 dark:bg-zinc-800`

**具体的な作業手順:**

1. 各ファイルを Read で開く
2. モーダルの内部パネル（固定のinset divの中）のすべての `bg-` クラスにライト用クラスを前置し、元のクラスを `dark:` プレフィックス付きに変更する
3. テキストカラーも同様に変換する

- [ ] **Step 1: 各モーダルファイルを順番に修正する**

`components/GachaModal.tsx` を Read して、モーダルの内部コンテナクラスを特定し、ライト/ダーク対応に変換する。

`components/BPGrantModal.tsx` を Read して同様に変換する。

`components/LoginBonusModal.tsx` を Read して同様に変換する。

`components/StakingModal.tsx` を Read して同様に変換する。

`components/GiftEPTutorial.tsx` を Read して同様に変換する。

`components/MusicSellApprovedModal.tsx` を Read して同様に変換する。

- [ ] **Step 2: commit**

```bash
git add components/GachaModal.tsx components/BPGrantModal.tsx components/LoginBonusModal.tsx components/StakingModal.tsx components/GiftEPTutorial.tsx components/MusicSellApprovedModal.tsx
git commit -m "feat: モーダルコンポーネントにライトモード対応を追加"
```

---

### Task 6: ホームページ・ランディングページ (app/page.tsx, start, vision, rule, privacy, tokushoho, referral)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/start/page.tsx`
- Modify: `app/vision/page.tsx`
- Modify: `app/rule/page.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `app/tokushoho/page.tsx`
- Modify: `app/referral/page.tsx`

これらはライト優先ページ（白背景・slate-900テキスト）。ダークモード時に暗い背景に切り替える。

**app/page.tsx の変更:**

main タグを変更:
```tsx
<main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-[#070A12] dark:via-[#0b1022] dark:to-[#070A12] text-slate-900 dark:text-white">
```

ロゴ画像のボーダーを変更:
```tsx
className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm object-contain"
```

ログインボタンを変更:
```tsx
className="md:hidden rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-gray-700 transition dark:text-white"
```

visionリンクを変更:
```tsx
className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-gray-800 hover:border-slate-300 transition"
```

PCログインボタンを変更:
```tsx
className="hidden md:inline-flex rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-gray-700 transition dark:text-white"
```

メインメッセージのテキストを変更:
```tsx
<p className="mt-6 text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
```

権利購入CTAの白背景ボタンを変更:
```tsx
className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-4 text-base font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition"
```

「始め方」カードを変更:
```tsx
<div className="relative mt-16 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm overflow-hidden">
```

テキストを変更:
```tsx
<div className="space-y-3 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
```

「承認待ち」カードを変更:
```tsx
<div className="mt-6 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
  <div className="text-lg font-bold mb-2 dark:text-white">承認待ちの場合</div>
  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
```

フッターカードを変更:
```tsx
<div className="mt-10 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
```

フッターリンクを変更:
```tsx
<Link href="/invest" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline-offset-4 hover:underline">
```

**他のページ (start, vision, rule, privacy, tokushoho, referral):**

各ファイルを Read して開き、以下の置換パターンを適用する:
- `bg-white` → `bg-white dark:bg-gray-900`
- `bg-slate-50` → `bg-slate-50 dark:bg-gray-800`
- `bg-gradient-to-b from-white` → `bg-gradient-to-b from-white dark:from-[#070A12]`
- `text-slate-900` → `text-slate-900 dark:text-white`
- `text-slate-700` → `text-slate-700 dark:text-slate-300`
- `text-slate-600` → `text-slate-600 dark:text-slate-400`
- `text-slate-500` → `text-slate-500 dark:text-slate-400`
- `border-slate-200` → `border-slate-200 dark:border-gray-700`
- `border-slate-300` → `border-slate-300 dark:border-gray-600`

- [ ] **Step 1: app/page.tsx を上記変更で修正する**

- [ ] **Step 2: app/start/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 3: app/vision/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 4: app/rule/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 5: app/privacy/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 6: app/tokushoho/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 7: app/referral/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 8: commit**

```bash
git add app/page.tsx app/start/page.tsx app/vision/page.tsx app/rule/page.tsx app/privacy/page.tsx app/tokushoho/page.tsx app/referral/page.tsx
git commit -m "feat: ホームページ・ランディングページにライトモード対応を追加"
```

---

### Task 7: 認証ページ (login, reset, pending)

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/reset/page.tsx`
- Modify: `app/pending/page.tsx`

**app/login/page.tsx の変更:**

main タグを変更:
```tsx
<main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white to-slate-50 dark:from-[#070A12] dark:to-[#0b1022] text-slate-900 dark:text-white">
```

メインカードを変更:
```tsx
<div className="mt-8 rounded-[28px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
```

タイトルとサブテキストを変更:
```tsx
<div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
```

input フィールドを変更:
```tsx
className="w-full rounded-2xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:text-white dark:placeholder:text-slate-500"
```

「パスワードを忘れた方」テキストを変更:
```tsx
<div className="flex justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
```

パスワード再設定フォームを変更:
```tsx
<div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-4 py-4 grid gap-3">
  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">パスワードの再設定</div>
  <p className="text-xs text-slate-500 dark:text-slate-400">
```

フォーム内 input を変更:
```tsx
className="w-full rounded-2xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:text-white"
```

戻るリンクを変更:
```tsx
<Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
```

フッターの copyright を変更:
```tsx
<div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">© LIFAI</div>
```

**app/reset/page.tsx と app/pending/page.tsx:**

各ファイルを Read して、login ページと同じパターンを適用する:
- `bg-white` → `bg-white dark:bg-gray-900`
- `bg-slate-50` / `bg-gradient-to-b from-white` → dark: バリアントを追加
- `text-slate-900` → `text-slate-900 dark:text-white`
- `text-slate-600` / `text-slate-500` → dark: バリアントを追加
- `border-slate-200` / `border-slate-300` → dark: バリアントを追加
- input フィールド → `bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600`

- [ ] **Step 1: app/login/page.tsx を上記変更で修正する**

- [ ] **Step 2: app/reset/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 3: app/pending/page.tsx を Read して同じパターンで修正する**

- [ ] **Step 4: commit**

```bash
git add app/login/page.tsx app/reset/page.tsx app/pending/page.tsx
git commit -m "feat: 認証ページにライトモード対応を追加"
```

---

### Task 8: 購入・申請フロー (purchase, apply, confirm, apply-sell, purchase/jam)

**Files:**
- Modify: `app/purchase/page.tsx`
- Modify: `app/apply/page.tsx`
- Modify: `app/confirm/page.tsx`
- Modify: `app/apply-sell/page.tsx`
- Modify: `app/purchase/jam/page.tsx`

これらのページは購入・申請フロー。各ページを Read して主要なラッパー・カードのスタイルを変換する。

**apply/confirm ページはダーク背景を使っている可能性が高い（StepHeader のテキストが白のため）。その場合:**
- ダーク背景はそのままを `dark:` プレフィックスにして維持
- ライトモード時は白/スレートのグラデーションに変更

**purchase ページ (PlanCard が白背景):**

外側コンテナを変更:
```tsx
// PlanCard の button タグ
className={[
  "relative w-full rounded-2xl border p-5 text-left transition",
  "bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
  selected ? "border-indigo-500 ring-2 ring-indigo-200 shadow-[0_18px_45px_rgba(99,102,241,.22)]" : "border-slate-200 dark:border-gray-700",
  isBest && !selected ? "border-indigo-200 dark:border-indigo-700 shadow-[0_18px_55px_rgba(99,102,241,.18)]" : "",
].join(" ")}
```

プラン名とタイトルを変更:
```tsx
<div className="text-sm font-extrabold text-slate-900 dark:text-white">
<div className="text-xl font-extrabold text-slate-900 dark:text-white">
```

各ページを Read → パターンを確認 → dark: バリアントを追加する。

- [ ] **Step 1: app/purchase/page.tsx を Read して修正する**

- [ ] **Step 2: app/apply/page.tsx を Read して修正する**

apply ページのメイン背景を確認し、dark/light 両対応にする:
- ダーク背景ページなら: 既存の `bg-[#...]` を `dark:bg-[#...]` にして、ライト用 `bg-gray-50` を前に追加
- ライト背景ページなら: `dark:` バリアントを追加

- [ ] **Step 3: app/confirm/page.tsx を Read して修正する**（Step 2 と同じアプローチ）

- [ ] **Step 4: app/apply-sell/page.tsx を Read して修正する**

- [ ] **Step 5: app/purchase/jam/page.tsx を Read して修正する**

- [ ] **Step 6: commit**

```bash
git add app/purchase/page.tsx app/apply/page.tsx app/confirm/page.tsx app/apply-sell/page.tsx app/purchase/jam/page.tsx
git commit -m "feat: 購入・申請フローにライトモード対応を追加"
```

---

### Task 9: ダッシュボード・メンバーページ (top, membership, invest, referral-app)

**Files:**
- Modify: `app/top/page.tsx`
- Modify: `app/membership/page.tsx`
- Modify: `app/invest/page.tsx`
- Modify: `app/referral-app/page.tsx`

top ページはライト系カード（bg-white, border-slate-200）を多く使っている。

**top ページの主な変換パターン:**

各カード・内部コンポーネントに適用:
- `bg-white` → `bg-white dark:bg-gray-900`
- `bg-slate-50` → `bg-slate-50 dark:bg-gray-800`
- `border-slate-200` → `border-slate-200 dark:border-gray-700`
- `border-slate-100` → `border-slate-100 dark:border-gray-700`
- `text-slate-900` → `text-slate-900 dark:text-white`
- `text-slate-700` → `text-slate-700 dark:text-slate-300`
- `text-slate-600` → `text-slate-600 dark:text-slate-400`
- `text-slate-500` → `text-slate-500 dark:text-slate-400`
- `text-slate-400` → `text-slate-400 dark:text-slate-500`
- `hover:bg-slate-50` → `hover:bg-slate-50 dark:hover:bg-gray-800`
- `hover:bg-slate-100` → `hover:bg-slate-100 dark:hover:bg-gray-700`
- `divide-slate-100` → `divide-slate-100 dark:divide-gray-700`

各ページを Read して上記パターンを適用する。

- [ ] **Step 1: app/top/page.tsx を Read して修正する（長いファイルは分割して読む）**

- [ ] **Step 2: app/membership/page.tsx を Read して修正する**

- [ ] **Step 3: app/invest/page.tsx を Read して修正する**

- [ ] **Step 4: app/referral-app/page.tsx を Read して修正する**

- [ ] **Step 5: commit**

```bash
git add app/top/page.tsx app/membership/page.tsx app/invest/page.tsx app/referral-app/page.tsx
git commit -m "feat: ダッシュボード・メンバーページにライトモード対応を追加"
```

---

### Task 10: 音楽ページ (music, music/standard, music/pro, music2, music-release-guide, note-generator)

**Files:**
- Modify: `app/music/page.tsx`
- Modify: `app/music/standard/page.tsx`
- Modify: `app/music/pro/page.tsx`
- Modify: `app/music2/page.tsx`
- Modify: `app/music-release-guide/page.tsx`
- Modify: `app/note-generator/page.tsx`

各ファイルを Read して主要な背景・テキストカラーを特定し、以下のパターンで dark: バリアントを追加する:

**ダーク背景のページ (bg-[#0a0a0a] など):**
```tsx
// 変更前
<div className="min-h-screen bg-[#0a0a0a] text-white">
// 変更後
<div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
```

**カードのダーク背景 (bg-zinc-900 など):**
```tsx
// 変更前
<div className="rounded-2xl bg-zinc-900 p-4">
// 変更後
<div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-transparent p-4">
```

- [ ] **Step 1: app/music/page.tsx を Read して修正する**

- [ ] **Step 2: app/music/standard/page.tsx を Read して修正する**

- [ ] **Step 3: app/music/pro/page.tsx を Read して修正する**

- [ ] **Step 4: app/music2/page.tsx を Read して修正する**

- [ ] **Step 5: app/music-release-guide/page.tsx を Read して修正する**

- [ ] **Step 6: app/note-generator/page.tsx を Read して修正する**

- [ ] **Step 7: commit**

```bash
git add app/music/page.tsx app/music/standard/page.tsx app/music/pro/page.tsx app/music2/page.tsx app/music-release-guide/page.tsx app/note-generator/page.tsx
git commit -m "feat: 音楽・ノートページにライトモード対応を追加"
```

---

### Task 11: ゲーム・メディア・コンテンツページ (gallery, image, fortune, chat, column/*, works/*)

**Files:**
- Modify: `app/gallery/page.tsx`
- Modify: `app/image/page.tsx`
- Modify: `app/fortune/page.tsx`
- Modify: `app/chat/page.tsx`
- Modify: `app/column/page.tsx`
- Modify: `app/column/[id]/page.tsx`
- Modify: `app/column/posts/2026-01-31-design-win/page.tsx`
- Modify: `app/works/[slug]/page.tsx`

各ファイルを Read して、Task 6〜10 と同じパターン（ライト背景には `dark:` 追加、ダーク背景には `bg-white` を前置して元を `dark:` に変更）を適用する。

- [ ] **Step 1: app/gallery/page.tsx を Read して修正する**

- [ ] **Step 2: app/image/page.tsx を Read して修正する**

- [ ] **Step 3: app/fortune/page.tsx を Read して修正する**

- [ ] **Step 4: app/chat/page.tsx を Read して修正する**

- [ ] **Step 5: app/column/page.tsx を Read して修正する**

- [ ] **Step 6: app/column/[id]/page.tsx を Read して修正する**

- [ ] **Step 7: app/column/posts/2026-01-31-design-win/page.tsx を Read して修正する**

- [ ] **Step 8: app/works/[slug]/page.tsx を Read して修正する**

- [ ] **Step 9: commit**

```bash
git add app/gallery/page.tsx app/image/page.tsx app/fortune/page.tsx app/chat/page.tsx app/column/page.tsx "app/column/[id]/page.tsx" app/column/posts/2026-01-31-design-win/page.tsx "app/works/[slug]/page.tsx"
git commit -m "feat: ギャラリー・画像・占い・コラム・作品ページにライトモード対応を追加"
```

---

### Task 12: マーケット・ギフトページ (market/*, gift/*)

**Files:**
- Modify: `app/market/page.tsx`
- Modify: `app/market/create/page.tsx`
- Modify: `app/market/[item_id]/page.tsx`
- Modify: `app/market/orders/page.tsx`
- Modify: `app/gift/page.tsx`
- Modify: `app/gift/send/page.tsx`
- Modify: `app/gift/use/page.tsx`
- Modify: `app/gift/history/page.tsx`

各ファイルを Read して Task 6〜10 と同じパターンを適用する。

- [ ] **Step 1〜8: 各ファイルを Read して修正する（1ファイルずつ）**

- [ ] **Step 9: commit**

```bash
git add app/market/page.tsx app/market/create/page.tsx "app/market/[item_id]/page.tsx" app/market/orders/page.tsx app/gift/page.tsx app/gift/send/page.tsx app/gift/use/page.tsx app/gift/history/page.tsx
git commit -m "feat: マーケット・ギフトページにライトモード対応を追加"
```

---

### Task 13: なら酒エージェンシーフロー (narasu-agency/*)

**Files:**
- Modify: `app/narasu-agency/page.tsx`
- Modify: `app/narasu-agency/terms/page.tsx`
- Modify: `app/narasu-agency/form/page.tsx`
- Modify: `app/narasu-agency/confirm/page.tsx`
- Modify: `app/narasu-agency/complete/page.tsx`

各ファイルを Read して Task 6〜10 と同じパターンを適用する。

- [ ] **Step 1〜5: 各ファイルを Read して修正する（1ファイルずつ）**

- [ ] **Step 6: commit**

```bash
git add app/narasu-agency/page.tsx app/narasu-agency/terms/page.tsx app/narasu-agency/form/page.tsx app/narasu-agency/confirm/page.tsx app/narasu-agency/complete/page.tsx
git commit -m "feat: なら酒エージェンシーページにライトモード対応を追加"
```

---

### Task 14: 5000シリーズページ (5000/*)

**Files:**
- Modify: `app/5000/page.tsx`
- Modify: `app/5000/apply/page.tsx`
- Modify: `app/5000/confirm/page.tsx`
- Modify: `app/5000/login/page.tsx`
- Modify: `app/5000/admin/page.tsx`
- Modify: `app/5000/purchase-status/page.tsx`

各ファイルを Read して Task 6〜10 と同じパターンを適用する。

- [ ] **Step 1〜6: 各ファイルを Read して修正する（1ファイルずつ）**

- [ ] **Step 7: commit**

```bash
git add app/5000/page.tsx app/5000/apply/page.tsx app/5000/confirm/page.tsx app/5000/login/page.tsx app/5000/admin/page.tsx app/5000/purchase-status/page.tsx
git commit -m "feat: 5000シリーズページにライトモード対応を追加"
```

---

### Task 15: 管理者・その他ページ (admin, membership, mini-games 接続確認)

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/finance/page.tsx`

mini-games 系ページ（`app/mini-games/*`, `app/music-boost/page.tsx`）は既存の `useTheme()` を使っており、Task 1 で useTheme.ts を ThemeContext の re-export に変更したため自動的に Context を参照するようになる。スタイル変更は不要。

- [ ] **Step 1: app/admin/page.tsx を Read して修正する**

- [ ] **Step 2: app/admin/finance/page.tsx を Read して修正する**

- [ ] **Step 3: mini-games 系ページの動作確認**

`app/mini-games/page.tsx` を開いて `import { useTheme } from "../lib/useTheme"` が ThemeContext を正しく参照していることを確認する（コード変更は不要）。

- [ ] **Step 4: commit**

```bash
git add app/admin/page.tsx app/admin/finance/page.tsx
git commit -m "feat: 管理者ページにライトモード対応を追加"
```

---

### Task 16: 最終動作確認

- [ ] **Step 1: 開発サーバーを起動**

```bash
npm run dev
```

- [ ] **Step 2: 主要ページをライト/ダーク両モードで確認**

以下のページをブラウザで開き、トグルを押してライト→ダーク→ライトと切り替える:
1. `/` (ホームページ) — ライト系
2. `/login` — ライト系
3. `/top` — ライト系カード
4. `/mini-games` — ダーク系（既存 useTheme）
5. `/music2` — 任意
6. `/gallery` — GalleryNav のスタイル確認

各ページで:
- トグルを押すとライト/ダーク切り替わること
- ページ移動後もテーマが保持されること（localStorage に保存されているため）
- トグルボタンが右上に固定表示されていること

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

エラーがなければ完了。

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "feat: 全ページにライト/ダークモード切り替え機能を追加"
```
