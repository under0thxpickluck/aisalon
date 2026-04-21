# ダーク/ライトモード切り替え Design Spec

**対象ページ:** LIFAI Arcade（mini-games）・Music Boost  
**デフォルト:** ダークモード  
**永続化:** localStorage `lifai_theme_v1`

---

## アーキテクチャ

### アプローチ: `isDark` state + 条件クラス

各ページで `useTheme` hookを使い、`isDark` boolean に応じてTailwindクラスを切り替える。CSS変数やTailwindのdark戦略は使わない。

### 新規ファイル

| ファイル | 役割 |
|----------|------|
| `app/lib/useTheme.ts` | localStorage読み書き hook |
| `components/ThemeToggle.tsx` | 切り替えボタン |

### 修正ファイル

| ファイル | 変更内容 |
|----------|----------|
| `app/mini-games/page.tsx` | useTheme + ThemeToggle 組み込み、条件クラス適用 |
| `app/mini-games/rumble/page.tsx` | 同上 |
| `app/mini-games/tap/page.tsx` | 同上 |
| `app/music-boost/page.tsx` | 同上 |

---

## useTheme Hook

```typescript
// app/lib/useTheme.ts
const THEME_KEY = "lifai_theme_v1";

export function useTheme() {
  const [isDark, setIsDark] = useState(true); // default: dark
  // 初回マウント時にlocalStorageから読む
  // toggleTheme() でlocalStorageに書いてstateを更新
  return { isDark, toggleTheme };
}
```

---

## ThemeToggle コンポーネント

- 位置: `fixed top-4 right-4 z-50`
- ダーク時: ☀️ ボタン（「ライトモードに切り替え」）
- ライト時: 🌙 ボタン（「ダークモードに切り替え」）
- スタイル: 小さい丸ボタン、テーマに合わせた背景色

---

## ライトモード配色

| 要素 | ダーク | ライト |
|------|--------|--------|
| ページ背景 | `bg-[#0a0a0a]` | `bg-gray-50` |
| テキスト | `text-white` | `text-gray-900` |
| カード背景 | `bg-white/5` | `bg-white` |
| カードボーダー | `border-purple-500/30` | `border-gray-200` |
| テキスト弱 | `text-white/40` | `text-gray-400` |
| アクセント（紫） | そのまま | そのまま |

---

## 各ページの変更方針

- ページ最外のwrapper divのクラスを `isDark ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900"` に変更
- カード・ボーダー・弱テキストなど主要要素に条件クラスを適用
- `ThemeToggle` を最外divの直下（他コンテンツの上）に配置
- 既存のロジック・レイアウト・アニメーションは一切変更しない
