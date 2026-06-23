# ライト/ダークモード切り替え設計

## 概要

全ページにライト/ダークモードの手動切り替え機能を追加する。  
ダークモードがデフォルト。手動トグルのみ（システム設定参照なし）。  
設定は `localStorage`（キー: `lifai_theme_v1`）に保存し、ページをまたいで維持する。

## 基本方針

- **既存コードは削除・変更しない。`dark:` バリアントを追加するだけ。**
- Tailwind の `darkMode: 'class'` を使用する。
- `<html>` タグに `dark` クラスが付いているとき = ダークモード。
- `ThemeToggle` は `layout.tsx` でグローバルに1か所だけレンダリング（全ページ共通）。
- ミニゲーム系の既存 `useTheme()` 呼び出しは後方互換のまま動く。

## アーキテクチャ

```
layout.tsx
└── ThemeProvider (app/lib/ThemeContext.tsx)
    ├── <html class="dark"> ← 付与/除去
    ├── ThemeToggle (固定、右上)
    └── {children} (全ページ)
```

## セクション1: コアインフラ

### tailwind.config.ts
`darkMode: 'class'` を追加する。これにより `dark:bg-*` 等のバリアントが有効になる。

### app/lib/ThemeContext.tsx（新規作成）
React Context でアプリ全体のテーマ状態を管理する。

- `isDark: boolean` と `toggleTheme: () => void` を提供
- マウント時に `localStorage.getItem("lifai_theme_v1")` を読む
- デフォルト: ダーク（`"light"` が保存されていない限り）
- `document.documentElement.classList.toggle("dark", isDark)` で `<html>` にクラスを付与

### app/lib/useTheme.ts
ThemeContext の `useTheme` を再エクスポートするだけに変更。  
既存ページの `import { useTheme } from "../lib/useTheme"` は変更不要。

### app/layout.tsx
- `ThemeProvider` で `<body>` 全体をラップ
- `<ThemeToggle>` をグローバルにレンダリング（`fixed top-4 right-4 z-50`）

### app/globals.css
bodyのデフォルトをライトにし、`html.dark body` でダークを設定する。

```css
body {
  background: #f8fafc;
  color: #0f172a;
}
html.dark body {
  background: #070A12;
  color: #ffffff;
}
```

## セクション2: 共有コンポーネント

各コンポーネントに `dark:` バリアントを**追加**する。既存クラスは保持。

### components/AppSidebar.tsx
- カード背景: `bg-white dark:bg-gray-900`
- ボーダー: `border-slate-200 dark:border-slate-700`
- テキスト: `text-slate-900 dark:text-white`
- ミュート: `text-slate-400 dark:text-slate-500`

### components/Field.tsx
- ラベル: `text-slate-700 dark:text-slate-300`
- インプット: `bg-white dark:bg-gray-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white`

### components/Select.tsx
- Field.tsx と同様のパターン

### components/StepHeader.tsx
- 背景・テキストに `dark:` バリアントを追加

### components/WalletBadge.tsx, RadioCard.tsx, MissionCard.tsx, WorkCard.tsx 等
- 同様に `dark:` バリアントを追加

## セクション3: ページ

### ミニゲーム系（変更最小）
`useTheme()` が自動的にContextを参照するようになるため、スタイル変更不要。

- `app/mini-games/page.tsx`
- `app/mini-games/tap/page.tsx`
- `app/mini-games/rumble/page.tsx`
- `app/music-boost/page.tsx`

### その他全ページ（dark: バリアント追加）

各ページのメインコンテナ・カード・テキストに `dark:` バリアントを追加する。

**パターン例:**
```tsx
// 変更前（ライト系ページ）
<main className="min-h-screen bg-white text-slate-900">

// 変更後（既存クラスはそのまま、dark: を追加）
<main className="min-h-screen bg-white dark:bg-[#070A12] text-slate-900 dark:text-white">
```

```tsx
// 変更前（ダーク系ページ）
<div className="min-h-screen bg-[#0a0a0a] text-white">

// 変更後
<div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
```

対象ページ（全58ページ）:
- app/page.tsx（ホームページ）
- app/login/page.tsx
- app/top/page.tsx
- app/purchase/page.tsx
- app/apply/page.tsx
- app/confirm/page.tsx
- app/start/page.tsx
- app/vision/page.tsx
- app/rule/page.tsx
- app/privacy/page.tsx
- app/tokushoho/page.tsx
- app/pending/page.tsx
- app/reset/page.tsx
- app/invest/page.tsx
- app/referral/page.tsx
- app/referral-app/page.tsx
- app/gallery/page.tsx
- app/image/page.tsx
- app/chat/page.tsx
- app/fortune/page.tsx
- app/music/page.tsx
- app/music/standard/page.tsx
- app/music/pro/page.tsx
- app/music2/page.tsx
- app/music-release-guide/page.tsx
- app/note-generator/page.tsx
- app/market/page.tsx
- app/market/create/page.tsx
- app/market/[item_id]/page.tsx
- app/market/orders/page.tsx
- app/gift/page.tsx
- app/gift/send/page.tsx
- app/gift/use/page.tsx
- app/gift/history/page.tsx
- app/apply-sell/page.tsx
- app/membership/page.tsx
- app/narasu-agency/page.tsx
- app/narasu-agency/terms/page.tsx
- app/narasu-agency/form/page.tsx
- app/narasu-agency/confirm/page.tsx
- app/narasu-agency/complete/page.tsx
- app/column/page.tsx
- app/column/[id]/page.tsx
- app/column/posts/2026-01-31-design-win/page.tsx
- app/works/[slug]/page.tsx
- app/purchase/jam/page.tsx
- app/5000/page.tsx
- app/5000/apply/page.tsx
- app/5000/confirm/page.tsx
- app/5000/login/page.tsx
- app/5000/admin/page.tsx
- app/5000/purchase-status/page.tsx
- app/admin/page.tsx
- app/admin/finance/page.tsx

## 絶対に守るルール（実装時）

1. **既存クラスを削除しない** — `dark:` バリアントを末尾に追加するだけ
2. **構造・JSX・ロジックを変更しない** — スタイル属性のみ変更
3. **1ページずつ確認しながら進める**
4. ページ固有の特殊なスタイル（グラデーション・ガラス効果等）は慎重に対応する
5. `ThemeToggle` はすでに `layout.tsx` にあるため、各ページに追加しない

## ファイル変更サマリー

| ファイル | 変更種別 |
|---|---|
| `tailwind.config.ts` | 編集（darkMode追加） |
| `app/lib/ThemeContext.tsx` | 新規作成 |
| `app/lib/useTheme.ts` | 編集（re-export化） |
| `app/layout.tsx` | 編集（ThemeProvider + ThemeToggle追加） |
| `app/globals.css` | 編集（dark/lightボディスタイル） |
| `components/ThemeToggle.tsx` | 変更なし |
| `components/AppSidebar.tsx` | 編集（dark: バリアント追加） |
| `components/Field.tsx` | 編集（dark: バリアント追加） |
| `components/Select.tsx` | 編集（dark: バリアント追加） |
| その他コンポーネント | 編集（dark: バリアント追加） |
| 全58ページ | 編集（dark: バリアント追加） |
