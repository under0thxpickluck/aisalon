# ダーク/ライトモード切り替え Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LIFAI Arcade（mini-games 3ページ）と Music Boost にダーク/ライト切り替えトグルを追加する。デフォルトはダーク。設定は localStorage `lifai_theme_v1` に保存し全ページで共有。

**Architecture:** `useTheme` hook で localStorage 読み書き。`ThemeToggle` コンポーネント（props で isDark/onToggle を受け取る）を各ページの右上 fixed に配置。各ページは `th` テーマオブジェクトで dark/light クラスを一元管理し、className をそのオブジェクト経由に置き換える。既存ロジック・レイアウト・アニメーションは変更しない。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS

---

## ファイル構成

| 操作 | ファイル | 内容 |
|------|----------|------|
| 新規 | `app/lib/useTheme.ts` | localStorage 読み書き hook |
| 新規 | `components/ThemeToggle.tsx` | トグルボタン（props受け取り型） |
| 修正 | `app/mini-games/page.tsx` | useTheme + ThemeToggle + th オブジェクト適用 |
| 修正 | `app/music-boost/page.tsx` | 同上 |
| 修正 | `app/mini-games/tap/page.tsx` | 同上 |
| 修正 | `app/mini-games/rumble/page.tsx` | 同上 |

---

## Task 1: `useTheme` hook を作成する

**Files:**
- Create: `app/lib/useTheme.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
"use client";
import { useEffect, useState } from "react";

const THEME_KEY = "lifai_theme_v1";

export function useTheme() {
  const [isDark, setIsDark] = useState(true); // デフォルト: dark

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light") setIsDark(false);
  }, []);

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }

  return { isDark, toggleTheme };
}
```

- [ ] **Step 2: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

エラーなし（既存エラーは無視）。

- [ ] **Step 3: コミットする**

```bash
git add app/lib/useTheme.ts
git commit -m "feat(theme): useTheme hook 追加（localStorage 読み書き）"
```

---

## Task 2: `ThemeToggle` コンポーネントを作成する

**Files:**
- Create: `components/ThemeToggle.tsx`

- [ ] **Step 1: ファイルを作成する**

```typescript
type Props = { isDark: boolean; onToggle: () => void };

export function ThemeToggle({ isDark, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      className={`fixed top-4 right-4 z-30 w-9 h-9 rounded-full flex items-center justify-center text-base transition shadow-md ${
        isDark
          ? "bg-white/10 hover:bg-white/20 text-white"
          : "bg-white border border-gray-200 hover:bg-gray-100 text-gray-700"
      }`}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
```

- [ ] **Step 2: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミットする**

```bash
git add components/ThemeToggle.tsx
git commit -m "feat(theme): ThemeToggle コンポーネント追加"
```

---

## Task 3: `app/mini-games/page.tsx` にテーマ対応を追加する

**Files:**
- Modify: `app/mini-games/page.tsx`

最もシンプルなページ（52行）。

- [ ] **Step 1: import と hook 呼び出しを追加する**

変更前:
```typescript
"use client";
import Link from "next/link";

export default function MiniGamesPage() {
```

変更後:
```typescript
"use client";
import Link from "next/link";
import { useTheme } from "../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function MiniGamesPage() {
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:      isDark ? "bg-[#0a0a0a] text-white"              : "bg-gray-50 text-gray-900",
    card:      isDark ? "bg-white/5 border border-purple-500/30" : "bg-white border border-gray-200",
    cardHover: isDark ? "hover:bg-white/10"                      : "hover:bg-gray-50",
    muted:     isDark ? "text-white/40"                          : "text-gray-400",
    badge:     isDark ? "bg-purple-500/20 text-purple-400"       : "bg-purple-100 text-purple-600",
    back:      isDark ? "text-white/30 text-sm"                  : "text-gray-400 text-sm",
  };
```

- [ ] **Step 2: JSX のクラスをテーマオブジェクトで置き換え、ThemeToggle を追加する**

変更前:
```typescript
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🎮</span>
        <div>
          <h1 className="text-2xl font-bold">LIFAI Arcade</h1>
          <p className="text-white/40 text-sm">ミニゲームで報酬をゲット</p>
        </div>
      </div>

      {/* ゲーム一覧 */}
      <div className="grid grid-cols-1 gap-4">
        {/* ランブル */}
        <Link href="/mini-games/rumble" className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 hover:bg-white/10 transition block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h2 className="font-bold">Rumble Arena</h2>
                <p className="text-white/40 text-xs">週次ランキングで報酬獲得</p>
              </div>
            </div>
            <span className="bg-purple-500/20 text-purple-400 text-xs px-3 py-1 rounded-full">PLAY</span>
          </div>
        </Link>

        {/* タップゲーム */}
        <Link href="/mini-games/tap" className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 hover:bg-white/10 transition block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛏️</span>
              <div>
                <h2 className="font-bold">Tap Mining</h2>
                <p className="text-white/40 text-xs">毎日500タップでBP獲得</p>
              </div>
            </div>
            <span className="bg-purple-500/20 text-purple-400 text-xs px-3 py-1 rounded-full">PLAY</span>
          </div>
        </Link>
      </div>

      <Link href="/top" className="block text-center text-white/30 text-sm mt-10">
        ← ホームに戻る
      </Link>
    </div>
  );
```

変更後:
```typescript
  return (
    <div className={`min-h-screen ${th.page} px-4 py-10 max-w-2xl mx-auto`}>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🎮</span>
        <div>
          <h1 className="text-2xl font-bold">LIFAI Arcade</h1>
          <p className={`${th.muted} text-sm`}>ミニゲームで報酬をゲット</p>
        </div>
      </div>

      {/* ゲーム一覧 */}
      <div className="grid grid-cols-1 gap-4">
        {/* ランブル */}
        <Link href="/mini-games/rumble" className={`${th.card} rounded-2xl p-6 ${th.cardHover} transition block`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h2 className="font-bold">Rumble Arena</h2>
                <p className={`${th.muted} text-xs`}>週次ランキングで報酬獲得</p>
              </div>
            </div>
            <span className={`${th.badge} text-xs px-3 py-1 rounded-full`}>PLAY</span>
          </div>
        </Link>

        {/* タップゲーム */}
        <Link href="/mini-games/tap" className={`${th.card} rounded-2xl p-6 ${th.cardHover} transition block`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛏️</span>
              <div>
                <h2 className="font-bold">Tap Mining</h2>
                <p className={`${th.muted} text-xs`}>毎日500タップでBP獲得</p>
              </div>
            </div>
            <span className={`${th.badge} text-xs px-3 py-1 rounded-full`}>PLAY</span>
          </div>
        </Link>
      </div>

      <Link href="/top" className={`block text-center ${th.back} mt-10`}>
        ← ホームに戻る
      </Link>
    </div>
  );
```

- [ ] **Step 3: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: コミットする**

```bash
git add app/mini-games/page.tsx
git commit -m "feat(theme): LIFAI Arcade トップにダーク/ライト切り替え追加"
```

---

## Task 4: `app/music-boost/page.tsx` にテーマ対応を追加する

**Files:**
- Modify: `app/music-boost/page.tsx`

- [ ] **Step 1: import と hook 呼び出しを追加する**

ファイル先頭の import 行:

変更前:
```typescript
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
```

変更後:
```typescript
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";
```

- [ ] **Step 2: `MusicBoostPage` 関数の先頭に hook と `th` オブジェクトを追加する**

`const [userId, setUserId]` の直前に追加:

```typescript
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:       isDark ? "bg-[#0a0a0a] text-white"          : "bg-gray-50 text-gray-900",
    card:       isDark ? "bg-white/5"                        : "bg-white shadow-sm",
    cardBorder: isDark ? "border-white/10"                   : "border-gray-200",
    muted:      isDark ? "text-white/60"                     : "text-gray-500",
    faint:      isDark ? "text-white/40"                     : "text-gray-400",
    ghost:      isDark ? "text-white/20"                     : "text-gray-300",
    modal:      isDark ? "bg-[#18181b] border-white/10"      : "bg-white border-gray-200",
    progressBg: isDark ? "bg-white/10"                       : "bg-gray-200",
    inputBg:    isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900",
    back:       isDark ? "text-white/40"                     : "text-gray-400",
    helpBtn:    isDark ? "border-white/20 bg-white/5 text-white/50 hover:border-purple-400 hover:bg-purple-500/20 hover:text-purple-300" : "border-gray-300 bg-white text-gray-400 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-500",
    planCard:   (isCurrent: boolean, isSelected: boolean) =>
      isDark
        ? isCurrent  ? "border-purple-500 bg-purple-500/10"
          : isSelected ? "border-white/30 bg-white/10"
          : "border-white/10 bg-white/5 hover:bg-white/8"
        : isCurrent  ? "border-purple-500 bg-purple-50"
          : isSelected ? "border-gray-400 bg-gray-100"
          : "border-gray-200 bg-white hover:bg-gray-50",
    planSubText: isDark ? "text-white/40" : "text-gray-400",
    planPrice:   isDark ? "text-white/60" : "text-gray-500",
    disabledBtn: isDark ? "bg-white/10 text-white/30" : "bg-gray-100 text-gray-400",
    creditBtn:   isDark ? "bg-white/5 text-white/20 border-white/10" : "bg-gray-100 text-gray-400 border-gray-200",
  };
```

- [ ] **Step 3: 認証前画面（`if (!authed) return`）のクラスを置き換える**

変更前:
```typescript
  if (!authed) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm">
        <h2 className="text-lg font-bold text-center mb-6">🔒 Music Boost</h2>
        <input
          type="password"
          value={pwInput}
          onChange={e => { setPwInput(e.target.value); setPwError(false); }}
          onKeyDown={e => {
            if (e.key === "Enter") {
              if (pwInput === ADMIN_PASSWORD) { sessionStorage.setItem("music_boost_authed", "1"); setAuthed(true); }
              else setPwError(true);
            }
          }}
          placeholder="パスワードを入力"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-3 outline-none"
        />
```

変更後:
```typescript
  if (!authed) return (
    <div className={`min-h-screen ${th.page} flex items-center justify-center px-4`}>
      <div className={`${th.card} border ${th.cardBorder} rounded-2xl p-8 w-full max-w-sm`}>
        <h2 className="text-lg font-bold text-center mb-6">🔒 Music Boost</h2>
        <input
          type="password"
          value={pwInput}
          onChange={e => { setPwInput(e.target.value); setPwError(false); }}
          onKeyDown={e => {
            if (e.key === "Enter") {
              if (pwInput === ADMIN_PASSWORD) { sessionStorage.setItem("music_boost_authed", "1"); setAuthed(true); }
              else setPwError(true);
            }
          }}
          placeholder="パスワードを入力"
          className={`w-full ${th.inputBg} rounded-xl px-4 py-3 text-sm mb-3 outline-none`}
        />
```

- [ ] **Step 4: メイン return のルートラッパーと ThemeToggle を変更する**

変更前:
```typescript
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/top" className="text-white/40 text-sm">← Back</Link>
        <h1 className="font-bold text-lg">🚀 Music Boost</h1>
        <button
          type="button"
          onClick={() => setTutorialStep(0)}
          title="使い方を見る"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs font-bold text-white/50 hover:border-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition"
        >
          ?
        </button>
      </div>
```

変更後:
```typescript
  return (
    <div className={`min-h-screen ${th.page} px-4 py-8 max-w-lg mx-auto`}>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/top" className={`${th.back} text-sm`}>← Back</Link>
        <h1 className="font-bold text-lg">🚀 Music Boost</h1>
        <button
          type="button"
          onClick={() => setTutorialStep(0)}
          title="使い方を見る"
          className={`flex h-7 w-7 items-center justify-center rounded-full border ${th.helpBtn} text-xs font-bold transition`}
        >
          ?
        </button>
      </div>
```

- [ ] **Step 5: 説明セクション、枠状況、プラン一覧の各カードクラスを置き換える**

**説明セクション**（`<p>音楽ブーストは...` を含む div）:

変更前:
```typescript
      <div className="bg-white/5 rounded-xl p-4 mb-6 text-sm text-white/60">
```
変更後:
```typescript
      <div className={`${th.card} border ${th.cardBorder} rounded-xl p-4 mb-6 text-sm ${th.muted}`}>
```

変更前（説明セクション内の ghost テキスト）:
```typescript
        <p className="mt-1 text-white/30 text-xs">本機能は共有枠を使用するため、空きがない場合は新規契約・変更ができません。</p>
```
変更後:
```typescript
        <p className={`mt-1 ${th.ghost} text-xs`}>本機能は共有枠を使用するため、空きがない場合は新規契約・変更ができません。</p>
```

**枠状況セクション**:

変更前:
```typescript
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/60">全体枠</span>
```
変更後:
```typescript
        <div className={`${th.card} border ${th.cardBorder} rounded-xl p-4 mb-6`}>
          <div className="flex justify-between text-sm mb-2">
            <span className={th.muted}>全体枠</span>
```

変更前（プログレスバー背景）:
```typescript
          <div className="w-full bg-white/10 rounded-full h-2">
```
変更後:
```typescript
          <div className={`w-full ${th.progressBg} rounded-full h-2`}>
```

変更前（残枠テキスト）:
```typescript
          <p className="text-xs text-white/40 mt-1">残り {status.available_slots.toLocaleString()} 枠</p>
```
変更後:
```typescript
          <p className={`text-xs ${th.faint} mt-1`}>残り {status.available_slots.toLocaleString()} 枠</p>
```

**プラン一覧ラベル**:

変更前:
```typescript
      <h2 className="font-bold text-sm text-white/60 mb-3">
```
変更後:
```typescript
      <h2 className={`font-bold text-sm ${th.muted} mb-3`}>
```

**プランカード**（`PLANS.map` 内）:

変更前:
```typescript
              className={`rounded-xl p-4 border cursor-pointer transition ${
                isCurrent ? "border-purple-500 bg-purple-500/10" :
                selected === plan.id ? "border-white/30 bg-white/10" :
                "border-white/10 bg-white/5 hover:bg-white/8"
              }`}>
```
変更後:
```typescript
              className={`rounded-xl p-4 border cursor-pointer transition ${th.planCard(isCurrent, selected === plan.id)}`}>
```

変更前（プラン枠数テキスト）:
```typescript
                    <p className="text-xs text-white/40">{plan.slots}枠使用</p>
```
変更後:
```typescript
                    <p className={`text-xs ${th.planSubText}`}>{plan.slots}枠使用</p>
```

変更前（プラン月額テキスト）:
```typescript
                  <p className="text-sm text-white/60">${plan.price}/月</p>
```
変更後:
```typescript
                  <p className={`text-sm ${th.planPrice}`}>${plan.price}/月</p>
```

変更前（EP不足/枠不足ボタン disabled スタイル）:
```typescript
                        className={`w-full py-2 rounded-lg text-sm font-bold transition ${
                          !canAfford
                            ? "bg-white/10 text-white/30 cursor-not-allowed"
                            : !hasEnoughEp
                            ? "bg-white/10 text-red-400/70 cursor-not-allowed"
                            : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"
                        }`}>
```
変更後:
```typescript
                        className={`w-full py-2 rounded-lg text-sm font-bold transition ${
                          !canAfford
                            ? `${th.disabledBtn} cursor-not-allowed`
                            : !hasEnoughEp
                            ? `${th.disabledBtn} text-red-400/70 cursor-not-allowed`
                            : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"
                        }`}>
```

変更前（クレジットカードボタン）:
```typescript
                    className="w-full py-2 rounded-lg text-sm font-bold bg-white/5 text-white/20 cursor-not-allowed border border-white/10 flex items-center justify-center gap-2">
```
変更後:
```typescript
                    className={`w-full py-2 rounded-lg text-sm font-bold ${th.creditBtn} cursor-not-allowed border flex items-center justify-center gap-2`}>
```

**注意書き**:

変更前:
```typescript
      <div className="mt-8 text-xs text-white/20 space-y-1">
```
変更後:
```typescript
      <div className={`mt-8 text-xs ${th.ghost} space-y-1`}>
```

**EP決済確認モーダル**:

変更前:
```typescript
          <div
            className="relative w-full max-w-sm rounded-2xl bg-[#18181b] border border-white/10 p-7 shadow-2xl"
```
変更後:
```typescript
          <div
            className={`relative w-full max-w-sm rounded-2xl ${th.modal} p-7 shadow-2xl`}
```

- [ ] **Step 6: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: コミットする**

```bash
git add app/music-boost/page.tsx
git commit -m "feat(theme): Music Boost にダーク/ライト切り替え追加"
```

---

## Task 5: `app/mini-games/tap/page.tsx` にテーマ対応を追加する

**Files:**
- Modify: `app/mini-games/tap/page.tsx`

- [ ] **Step 1: import と hook 呼び出しを追加する**

変更前:
```typescript
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
```

変更後:
```typescript
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";
```

- [ ] **Step 2: `TapMiningPage` 関数先頭に hook と `th` オブジェクトを追加する**

`const [userId, setUserId] = useState("");` の直前に追加:

```typescript
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:       isDark ? "bg-[#0a0a0a] text-white"          : "bg-gray-50 text-gray-900",
    modal:      isDark ? "bg-[#1a1a2e] border-white/10"      : "bg-white border-gray-200",
    card:       isDark ? "bg-white/5"                        : "bg-white shadow-sm",
    cardBorder: isDark ? "border-white/10"                   : "border-gray-200",
    muted:      isDark ? "text-white/70"                     : "text-gray-500",
    faint:      isDark ? "text-white/40"                     : "text-gray-400",
    ghost:      isDark ? "text-white/20"                     : "text-gray-300",
    divider:    isDark ? "border-white/5"                    : "border-gray-100",
    logRow:     (rare: boolean) =>
      isDark
        ? `flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0 ${rare ? "text-yellow-400" : "text-white/60"}`
        : `flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0 ${rare ? "text-yellow-500" : "text-gray-500"}`,
    logTime:    isDark ? "text-white/30 w-16"                : "text-gray-300 w-16",
    back:       isDark ? "text-white/40"                     : "text-gray-400",
    helpBtn:    isDark ? "text-white/40 bg-white/5"          : "text-gray-400 bg-white border border-gray-200",
    statCard:   isDark ? "bg-white/5 rounded-xl p-3 text-center" : "bg-white border border-gray-200 rounded-xl p-3 text-center",
    statLabel:  isDark ? "text-xs text-white/40"             : "text-xs text-gray-400",
    recordCard: isDark ? "bg-white/5 border border-white/10 rounded-xl p-4 mb-4" : "bg-white border border-gray-200 rounded-xl p-4 mb-4",
    recordLabel:isDark ? "text-white/40"                     : "text-gray-400",
    recordHead: isDark ? "text-sm font-bold text-white/60 mb-3" : "text-sm font-bold text-gray-500 mb-3",
    totalText:  isDark ? "text-center text-xs text-white/20" : "text-center text-xs text-gray-300",
    logHead:    isDark ? "text-xs font-bold text-white/40 mb-2" : "text-xs font-bold text-gray-400 mb-2",
    limitCard:  isDark ? "bg-white/5 rounded-xl p-4 text-center text-sm text-white/50 mb-4" : "bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-400 mb-4",
    sidebar:    isDark ? "bg-[#0f0f1a] border-l border-white/5 rounded-xl p-4" : "bg-white border border-gray-200 rounded-xl p-4",
  };
```

- [ ] **Step 3: ルートdivのクラスとThemeToggleを追加する**

変更前:
```typescript
  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white${rareEffect ? " animate-pulse" : ""}`}>
    {/* グリッド外：fixed要素（モーダル・ticker） */}
```

変更後:
```typescript
  return (
    <div className={`min-h-screen ${th.page}${rareEffect ? " animate-pulse" : ""}`}>
    {/* グリッド外：fixed要素（モーダル・ticker） */}
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
```

- [ ] **Step 4: ルール説明モーダルのクラスを置き換える**

変更前:
```typescript
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">⛏️ Tap Miningとは？</h2>
            <div className="text-sm text-white/70 space-y-3">
              <div>
                <p className="font-bold text-white mb-1">■ 基本ルール</p>
```

変更後:
```typescript
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
            <h2 className="text-lg font-black mb-4 text-center">⛏️ Tap Miningとは？</h2>
            <div className={`text-sm ${th.muted} space-y-3`}>
              <div>
                <p className="font-bold mb-1">■ 基本ルール</p>
```

- [ ] **Step 5: ヘッダーのクラスを置き換える**

変更前:
```typescript
        <Link href="/mini-games" className="text-white/40 text-sm">← Arcade</Link>
        <h1 className="font-bold text-lg">⛏️ Tap Mining</h1>
        <button onClick={() => setShowHelp(true)} className="text-white/40 text-lg w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">?</button>
```

変更後:
```typescript
        <Link href="/mini-games" className={`${th.back} text-sm`}>← Arcade</Link>
        <h1 className="font-bold text-lg">⛏️ Tap Mining</h1>
        <button onClick={() => setShowHelp(true)} className={`${th.helpBtn} text-lg w-8 h-8 rounded-full flex items-center justify-center`}>?</button>
```

- [ ] **Step 6: ステータスバー・記録カードのクラスを置き換える**

変更前（ステータスカード×2）:
```typescript
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">今日のBP</p>
```

変更後:
```typescript
        <div className={th.statCard}>
          <p className={th.statLabel}>今日のBP</p>
```

同様に 2つ目のステータスカード（今日のEP）も同じパターンで置き換える。

変更前（上限メッセージカード）:
```typescript
        <div className="bg-white/5 rounded-xl p-4 text-center text-sm text-white/50 mb-4">
```
変更後:
```typescript
        <div className={th.limitCard}>
```

変更前（今日の記録カード）:
```typescript
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-bold text-white/60 mb-3">📊 今日の記録</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">タップ数</span>
```

変更後:
```typescript
        <div className={th.recordCard}>
          <h3 className={th.recordHead}>📊 今日の記録</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className={th.recordLabel}>タップ数</span>
```

変更前（最大コンボ・獲得BPのラベル）:
```typescript
              <span className="text-white/40">最大コンボ</span>
```
変更後:
```typescript
              <span className={th.recordLabel}>最大コンボ</span>
```

変更前（獲得EPのラベル）:
```typescript
              <span className="text-white/40">獲得BP</span>
```
変更後:
```typescript
              <span className={th.recordLabel}>獲得BP</span>
```

変更前（累計記録テキスト）:
```typescript
        <div className="text-center text-xs text-white/20">
```
変更後:
```typescript
        <div className={th.totalText}>
```

- [ ] **Step 7: モバイル用マイニングログのクラスを置き換える**

変更前:
```typescript
        <div className="lg:hidden mt-4 bg-white/5 border border-white/10 rounded-xl p-3">
          <h3 className="text-xs font-bold text-white/40 mb-2">⛏️ マイニングログ</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {miningLogs.map(log => (
              <div key={log.id} className={`flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0 ${log.rare ? "text-yellow-400" : "text-white/60"}`}>
                <span className="text-white/30 w-16">{log.time}</span>
```

変更後:
```typescript
        <div className={`lg:hidden mt-4 ${th.card} border ${th.cardBorder} rounded-xl p-3`}>
          <h3 className={th.logHead}>⛏️ マイニングログ</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {miningLogs.map(log => (
              <div key={log.id} className={th.logRow(log.rare)}>
                <span className={th.logTime}>{log.time}</span>
```

- [ ] **Step 8: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: コミットする**

```bash
git add app/mini-games/tap/page.tsx
git commit -m "feat(theme): Tap Mining にダーク/ライト切り替え追加"
```

---

## Task 6: `app/mini-games/rumble/page.tsx` にテーマ対応を追加する

**Files:**
- Modify: `app/mini-games/rumble/page.tsx`

最も大きいページ。モーダルが多いが `th` オブジェクトで一元管理するため、パターンが統一される。

- [ ] **Step 1: import と hook 呼び出しを追加する**

変更前:
```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
```

変更後:
```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";
```

- [ ] **Step 2: `RumblePage` 関数先頭に hook と `th` オブジェクトを追加する**

`const [userId, setUserId] = useState("");` の直前に追加:

```typescript
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:        isDark ? "bg-[#0a0a0a] text-white"          : "bg-gray-50 text-gray-900",
    modal:       isDark ? "bg-[#1a1a2e] border-white/10"      : "bg-white border-gray-200",
    modalDark:   isDark ? "bg-[#0d0d1a] border-purple-500/30" : "bg-white border-purple-200",
    card:        isDark ? "bg-white/5"                        : "bg-white shadow-sm",
    cardBorder:  isDark ? "border-white/10"                   : "border-gray-200",
    muted:       isDark ? "text-white/70"                     : "text-gray-500",
    faint:       isDark ? "text-white/40"                     : "text-gray-400",
    ghost:       isDark ? "text-white/20"                     : "text-gray-300",
    divider:     isDark ? "border-white/10"                   : "border-gray-200",
    dividerFaint:isDark ? "border-white/5"                    : "border-gray-100",
    progressBg:  isDark ? "bg-white/10"                       : "bg-gray-200",
    tab:         (active: boolean) =>
      isDark
        ? active ? "border-b-2 border-purple-400 text-white font-bold" : "text-white/40 hover:text-white/70"
        : active ? "border-b-2 border-purple-500 text-gray-900 font-bold" : "text-gray-400 hover:text-gray-600",
    statCard:    isDark ? "bg-white/5 rounded-xl p-3 text-center" : "bg-white border border-gray-200 rounded-xl p-3 text-center",
    statLabel:   isDark ? "text-xs text-white/40"             : "text-xs text-gray-400",
    rankRow:     (isSelf: boolean) =>
      isDark
        ? `flex items-center gap-3 py-2 px-3 rounded-xl text-sm ${isSelf ? "bg-purple-500/20 border border-purple-500/30" : ""}`
        : `flex items-center gap-3 py-2 px-3 rounded-xl text-sm ${isSelf ? "bg-purple-50 border border-purple-200" : ""}`,
    equipCard:   isDark ? "border border-white/10 rounded-xl p-3" : "border border-gray-200 rounded-xl p-3 bg-white",
    closeBtn:    isDark ? "bg-white/10 hover:bg-white/20 text-white/50" : "bg-gray-100 hover:bg-gray-200 text-gray-500",
    back:        isDark ? "text-white/40"                     : "text-gray-400",
    msgArea:     (ok: boolean) =>
      ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400",
  };
```

- [ ] **Step 3: ルートdivのクラスとThemeToggleを追加する**

変更前:
```typescript
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-md mx-auto">
      {/* Rumbleルール説明モーダル */}
```

変更後:
```typescript
  return (
    <div className={`min-h-screen ${th.page} px-4 py-8 max-w-md mx-auto`}>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      {/* Rumbleルール説明モーダル */}
```

- [ ] **Step 4: 3つの説明モーダル（Rumble・装備・ランキング）のクラスを置き換える**

各モーダルに共通するパターン:

変更前（3箇所すべて同じパターン）:
```typescript
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
```
変更後:
```typescript
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
```

各モーダル内の `text-white/70` で包まれる説明テキストdiv:

変更前（3箇所）:
```typescript
            <div className="text-sm text-white/70 space-y-3">
```
変更後:
```typescript
            <div className={`text-sm ${th.muted} space-y-3`}>
```

- [ ] **Step 5: バトルログモーダルのクラスを置き換える**

変更前:
```typescript
            <div className="bg-[#0d0d1a] border border-purple-500/30 rounded-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: "80vh" }}>
              {/* モーダルヘッダー */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
```
変更後:
```typescript
            <div className={`${th.modalDark} rounded-2xl w-full max-w-sm flex flex-col`} style={{ maxHeight: "80vh" }}>
              {/* モーダルヘッダー */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${th.divider} shrink-0`}>
```

バトルログモーダル内の閉じるボタン:

変更前:
```typescript
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-xs hover:bg-white/20 transition"
```
変更後:
```typescript
                  className={`w-7 h-7 rounded-full ${th.closeBtn} flex items-center justify-center text-xs transition`}
```

- [ ] **Step 6: タブ部分のクラスを置き換える**

`TAB_LIST.map` 内のタブボタン。現在のクラスパターンを確認した上で以下のように置き換える:

変更前（タブボタン — active/inactive の条件クラス部分）:
```typescript
              className={`py-2 px-1 text-sm transition ${tab === t ? "border-b-2 border-purple-400 text-white font-bold" : "text-white/40 hover:text-white/70"}`}
```
変更後:
```typescript
              className={`py-2 px-1 text-sm transition ${th.tab(tab === t)}`}
```

- [ ] **Step 7: バトルタブ・ランキングタブ・装備タブのカードクラスを置き換える**

このページは大きいため、以下のパターンを機械的に置き換える:

| 変更前 | 変更後 |
|--------|--------|
| `className="bg-white/5 rounded-xl p-...` | `className={`${th.card} rounded-xl p-...`}` |
| `border border-white/10` | `border ${th.cardBorder}` |
| `text-white/60` | `${th.muted}` |
| `text-white/40` | `${th.faint}` |
| `bg-white/10 rounded-full` (プログレスバー背景) | `${th.progressBg} rounded-full` |

具体的に置き換えるカードのクラス文字列（`className=` で検索して対応）:

1. バトルタブ内の週間RPカード: `bg-white/5 rounded-xl p-4 text-center mb-4`
2. 参加ボタン周辺のメッセージカード: `bg-white/5 rounded-xl p-4 text-center`
3. ランキングリスト行の自分ハイライト: `bg-purple-500/20 border border-purple-500/30` → `th.rankRow(entry.is_self || entry.user_id === userId)` で管理
4. 装備カード: `border border-white/10 rounded-xl p-3` → `${th.equipCard}`
5. かけら数テキスト: `text-white/60` や `text-white/40` → `${th.muted}` / `${th.faint}`
6. 強化モーダル内のカード: `bg-[#1a1a2e] border border-white/10` → `${th.modal}`
7. 強化詳細カード: `bg-white/5 rounded-xl p-3 text-center` → `${th.statCard}`
8. 分解確認モーダル: `bg-[#1a1a2e] border border-white/10` → `${th.modal}`
9. バトル参加後のメッセージエリア（勝敗）: `text-white/70` → `${th.muted}`

- [ ] **Step 8: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

エラーが出た場合: `th.tab` や `th.rankRow` などの関数型プロパティの呼び出し方が間違っていないか確認する。

- [ ] **Step 9: コミットする**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(theme): Rumble Arena にダーク/ライト切り替え追加"
```

---

## 設計上の重要ポイント

| 項目 | 方針 |
|------|------|
| テーマ共有 | localStorage `lifai_theme_v1` で全ページ共有 |
| `ThemeToggle` は props 受け取り型 | `useTheme` を各ページで1回だけ呼んで props で渡す（二重呼び出しによる非同期問題を避ける） |
| アクセント色（紫グラデーション等）は変更なし | ブランドカラーはダーク/ライト問わず維持 |
| アニメーション・エフェクトは変更なし | `rareEffect` 等のゲームロジックに関わるクラスはそのまま |
| モーダル背景（`bg-black/70`）はそのまま | オーバーレイは透過黒のままでダーク/ライト問わず機能する |
