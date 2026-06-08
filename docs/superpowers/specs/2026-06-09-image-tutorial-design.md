# 画像生成チュートリアル設計書

**日付:** 2026-06-09  
**対象ページ:** `/image` (app/image/page.tsx)

## 概要

AI画像生成ページに「？ 使い方」ヘルプボタンを追加し、初心者がチャット入力で画像を生成する方法を学べる3ステップのモーダルチュートリアルを実装する。

## コンポーネント構成

### 新規ファイル
- `components/image/ImageTutorialModal.tsx`

### 変更ファイル
- `app/image/page.tsx` — `showTutorial` stateとヘッダーボタンのみ追加

## UI設計

### ヘッダー変更
ヘッダー右端のBP表示の左に「？ 使い方」ボタンを追加:
```
[AI 画像生成 / 会話しながらイメージを固めて画像を生成]    [? 使い方]  [100 BP]
```

### モーダル構成（3ステップ）

| ステップ | タイトル | 内容 |
|---|---|---|
| 1 | チャットで伝えよう | 「どんな画像が欲しいか」をチャットに自然な言葉で入力する方法を説明。キャラクター・背景・雰囲気などを書くと良いことを伝える |
| 2 | 具体的な入力例 | 良い例・悪い例を並べて表示。例：「夕暮れの海辺に立つ黒髪の女性、アニメ風」vs「女の人」 |
| 3 | 生成ボタンを押そう | チャットでイメージが固まったら右側の生成ボタンを押す流れを説明。BPが消費されることを補足 |

**ナビゲーション:**
- ページドットインジケーター（●○○ 形式）
- 「◀ 前へ」「次へ ▶」ボタン
- 最終ステップは「閉じる」ボタン
- 右上の × ボタンでも閉じられる

## データフロー

```
page.tsx
  showTutorial: boolean (useState)
  
  「？ 使い方」ボタン → setShowTutorial(true)
  
  <ImageTutorialModal
    open={showTutorial}
    onClose={() => setShowTutorial(false)}
  />

ImageTutorialModal.tsx (内部)
  currentStep: number (useState, 0-indexed)
  onClose呼び出し時にcurrentStepをリセット
```

## Props定義

```typescript
// ImageTutorialModal
interface Props {
  open: boolean;
  onClose: () => void;
}
```

## 制約・注意点

- LocalStorage不使用（毎回ステップ1から開始）
- モーダル外クリックでも閉じる
- page.tsx への変更は最小限（showTutorial stateとボタン追加のみ）
- 既存コンポーネントへの変更なし
