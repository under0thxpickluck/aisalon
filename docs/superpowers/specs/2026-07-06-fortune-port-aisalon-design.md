# 占い(団子ハブ + AIカード占い)aisalon移植 設計仕様書

**日付:** 2026-07-06
**対象リポジトリ:** aisalon（`~/aisalon`）のみ
**実装ブランチ:** `fortune-card`（`main` から分岐）
**移植元:** LIFAIOV `fortune-card` ブランチ（占い機能フィーチャー完成済み。commit 64f0dcb 時点）

## 目的

LIFAIOV で完成した占い機能（`/fortune` を「団子占い / AIカード占い」の選択ハブ化し、その中に没入型「AIカード占い（月影の占術）」を新設）を、aisalon に**忠実移植**する。両サロンで占いの UX を統一する。

## 方針（確定事項）

- **忠実移植**: 機能・テーマ（月影の占術）・22枚カード・フローは LIFAIOV と完全同一。aisalon 固有の配線（自前の団子ページ・入口導線）だけ差し替える。
- **課金**: LIFAIOV と同じ no-op スタブ（`lib/fortune/billing.ts`、全モード無料 = MVP）。将来 standard→BP / premium→EP の差し替えは単一シームのまま据え置き。
- **構造非破壊**: aisalon の既存団子占い（診断・今日の運勢・BP付与導線・localStorage キー・`/fortune/config/*.json` 参照）を一切壊さない。ページは移設のみ。
- **未公開**: `fortune-card` ブランチで実装。**LIFAIOV 本番検証が済むまで main マージ・デプロイはしない**。

## アーキテクチャ

```
/fortune         → ハブ（団子 or カード占い を選択）      ← 新規（LIFAIOVからコピー）
 ├ /fortune/dango → aisalon 自前の団子占い（verbatim 移設・非破壊）
 └ /fortune/cards → AIカード占い（月影の占術）             ← 新規（コピー）
```

カード占いは `FortuneApp`（useReducer ステートマシン: intro→question→事前3問→mode→deck→loading→result）＋演出コンポーネント群（`components/tarot/`）＋サーバー `app/api/tarot/route.ts`（OpenAI `gpt-4o-mini`、キー未設定でもフォールバック結果で画面を壊さない）＋`data/tarot-cards.json`（22枚）。

## コンポーネント構成

### A. LIFAIOV からコピーする 19ファイル（サロン非依存・検証済みで無改変）

移植元 LIFAIOV `fortune-card` から**内容を1文字も変えずに**コピーする。いずれも `LIFAIOV`/`aisalon` 等のサロン固有名やサロン固有 import を含まないことを確認済み。

- `lib/fortune/types.ts` / `theme.ts` / `billing.ts` / `cards.ts`
- `data/tarot-cards.json`（22枚）
- `app/api/tarot/route.ts`
- `app/fortune/cards/page.tsx`
- `components/tarot/`（12ファイル）: `StarBackground.tsx` `FortuneTeller.tsx` `TarotCard.tsx` `CardDeck.tsx` `FortuneIntro.tsx` `QuestionInput.tsx` `PreQuestionForm.tsx` `ModeSelector.tsx` `LoadingScene.tsx` `SelectedCards.tsx` `FortuneResult.tsx` `FortuneApp.tsx`

依存: `framer-motion ^12` / `openai ^6` は aisalon に導入済み。追加インストール不要。

### B. aisalon 固有の作成・変更

1. **`app/fortune/dango/page.tsx` を新規作成** = aisalon 自前の現行 `app/fortune/page.tsx`（団子占い）を verbatim コピー移設。
   - aisalon 団子ページの import は `react` / `next/link` / `@/components/LoadingCat`（全て絶対・alias）で、`/fortune` への内部ナビ無し、config 参照は絶対 public パス → サブディレクトリ移設で壊れない。
2. **`app/fortune/page.tsx` をハブ（`FortuneHub`）に全置換**（LIFAIOV と同一のハブUI。団子🍡 / カード占い🔮 を選択、`StarBackground` 演出、`TAROT_THEME` 配色）。

### C. 入口ラベル改名（`/fortune` ルートへ向かう導線を「占い」に統一）

| ファイル:行 | 現在 | 変更後 |
|---|---|---|
| `components/AppSidebar.tsx:42` | label "団子占い" | 「占い」 |
| `app/top/page.tsx:406` | label "団子占い" / desc "毎日の運勢 +10BP" | 「占い」/ "団子占い・カード占い" |
| `app/5000/page.tsx:712` | title "団子占い" / desc "毎日の運勢チェックでBPを +10獲得" | 「占い」/ "団子占い・AIカード占い"（※タイル導線機構を実装時に確認） |
| `app/chat/page.tsx:22` | label "団子占い" | 「占い」 |
| `app/api/cat-recommendation/route.ts:52` | label "団子占い" | 「占い」 |
| `components/LifaiCat.tsx:444` | "🔮 占いを見る +10BP" | "🔮 占いを見る"（+10BP は団子固有のため除去） |

**そのまま維持**:
- `app/api/cat-recommendation/route.ts:43` label "占いを見る"（ハブでも自然）
- aisalon 団子ページ自身の見出し（移設先へそのまま移動）

### D. 意図的に触らないもの（構造保護）

- **`components/GalleryNav.tsx:11`** の `{ id: "fortune", label: "占い" }` は**ギャラリーページ内のスクロール連動アンカー**（IntersectionObserver によるセクション観測）であり、`/fortune` ルートとは無関係。触ると別機能を壊すため除外。

## データフロー

1. ユーザーが入口（サイドバー等）→ `/fortune`（ハブ）。
2. ハブで「団子占い」→ `/fortune/dango`（従来どおり動作）、「カード占い」→ `/fortune/cards`。
3. カード占い: intro→question→事前3問→mode→deck（シャッフル・3枚選択）→loading。
4. loading 中に `chargeForMode`（スタブ=即 ok）→ `POST /api/tarot`（question + 3回答 + 3枚を送信）。
5. OpenAI が7フィールド JSON（summary/past/present/future/action/warning/finalMessage）を返す。キー未設定・失敗時はカード意味ベースのフォールバック結果。
6. result 表示（札の表返し演出＋7項目）→「もう一度占う」で intro へ。

## エラーハンドリング

- OpenAI キー未設定 / 応答不正 / 通信失敗 → いずれもフォールバック結果を返し画面を壊さない（`app/api/tarot/route.ts` に実装済み）。
- 団子占いのエラー挙動は移設で不変。

## 検証（テストは追加しない）

aisalon は LIFAI 系の方針でユニットテスト/lint 未設定のため、検証ゲートは**プロダクションビルド成功**とする。

- `npm run build` が PASS。
- `/fortune`（ハブ）・`/fortune/dango`（団子）・`/fortune/cards`（カード）の**3ルートが生成**される。
- 手動確認（任意・`npm run dev`）: 入口が「占い」で `/fortune` に遷移 → ハブで両占いを選択 → 団子が従来どおり（診断・今日の運勢・BP付与導線が非破壊）→ カード占いが没入フローで動作。

## MVP 除外（LIFAIOV と同じ・構造だけ用意）

画像保存 / SNS共有 / 履歴 / 実BP・EP消費 / 専用スプレッド / 音声 / Live2D / 背景変更 / 季節 / コレクション。`FortuneResult` にコメントで差込口のみ明記（コピーで引き継ぐ）。

## 段取り・リスク

- ブランチ `fortune-card`（`main` 分岐）。実装中は**団子占いの既存挙動を壊さないこと**を各ステップの `npm run build` で担保。
- `OPENAI_API_KEY` 未設定でもフォールバックで壊れないが、公開前に aisalon Vercel env へ設定。
- **LIFAIOV 本番検証が済むまで aisalon をデプロイしない**（順序: LIFAIOV公開検証 → aisalon移植公開）。
- 移植元 LIFAIOV `fortune-card` はまだ main 未マージ。コピー元として参照するだけなので問題なし。
