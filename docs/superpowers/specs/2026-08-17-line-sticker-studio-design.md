# LINE Sticker Studio 設計書

- 日付: 2026-08-17
- 対象: LIFAI（Next.js 14 App Router）
- 状態: 承認済み・実装中

## 目的

LINEスタンプ（通常スタンプ 8/16/24/32/40個）を、キャラクターの同一性を保ったまま
一括生成し、LINE Creators Market にそのまま提出できるZIPまで書き出す機能。

既存の「AI生成 → BP消費」設計の上に乗せる。LIFAI の「キャラクターIP生成・再利用」の
最初の入口として位置づける（再利用機能自体は v2）。

## v1 スコープ

| STEP | 内容 | v1 |
|---|---|---|
| ① | キャラクター作成（文章から） | ○ |
| ② | Character LOCK | ○ |
| ③ | セリフ・表情の企画AI | ○ |
| ④ | スタンプ一括生成 | ○ |
| ⑤ | 個別再生成 / 文字編集 | ○ |
| ⑥ | LINE規格チェック | ○ |
| ⑦ | 審査リスクチェックAI | v2 |
| ⑧ | 提出用ZIP生成 | ○ |

v2 以降: 審査リスクAI、キャラIPの他機能再利用、アニメーション/絵文字/BIG等。

## 設計を決めた4つの制約

### 1. GAS は稼働中デプロイと repo が別物

`gas/Code.gs` を push しても稼働中GASは変わらず、手作業での貼り直しとデプロイ更新が要る。
よって **新規GASアクションは2個に抑える**。

- `sticker_get` — 一覧 or 単体取得
- `sticker_save` — 保存（upsert）

データは `sticker_projects` シート1枚に、プロジェクト全体を1つのJSON文字列として持つ。
既存の `music_boost_tracks_json` と同じ流儀。

```
sticker_projects
id | user_id | name | status | credits | updated_at | project_json
```

### 2. gpt-image-1 は同期APIでジョブIDが無い

音楽（Replicate）と違い、外部にポーリング可能なジョブIDが存在しない。
Vercel の maxDuration は最大300秒、1枚あたり30〜60秒なので **40枚を1リクエストでは処理できない**。

→ **クライアント駆動ループ**。1リクエスト＝1枚、ブラウザ側で並列3本。
1枚返るたびに `sticker_save` するため、途中離脱しても成果は失われない。

### 3. Vercel Lambda に日本語フォントが無い

サーバーで文字を焼き込むと豆腐（□）になる。`sharp` も `canvas` も未導入。

→ **文字合成・リサイズ・ZIP は全てブラウザの Canvas API と fflate で行う**。
副次効果として、文字変更が BP 0・即時になり、サーバー費もゼロ。

### 4. 画像AIに日本語を描かせると崩れる

→ 生成プロンプトに `no text, no letters, no words` を必ず入れ、
文字は必ず後段の Composer でレイヤとして重ねる。

## アーキテクチャ

```
app/sticker/page.tsx                  ウィザードUI

app/lib/sticker/                      純粋ロジック（jest対象・サーバー/クライアント共用）
  types.ts                            StickerProject ほか型定義
  line_spec.ts                        LINE規格の定数と検証（規格変更はここだけ直す）
  cost.ts                             BP表と計算
  character_prompt.ts                 CharacterProfile → 画像プロンプト
  manifest.ts                         LLM出力の検証・正規化

app/lib/sticker/client/               ブラウザ専用
  composer.ts                         キャラPNG＋テキスト → 合成PNG
  formatter.ts                        LINE規格へのリサイズ・余白・1MB圧縮
  zip_builder.ts                      fflate でZIP生成

app/api/sticker/
  plan/route.ts                       LLMで CharacterProfile ＋ Manifest 生成
  character/route.ts                  基準画像生成（high / transparent）
  start/route.ts                      BP一括先払い＋クレジット発行
  render/route.ts                     1リクエスト＝1枚生成
  project/route.ts                    sticker_get / sticker_save のプロキシ
```

## 既存コードへの変更

**破壊的変更はしない。引数追加のみ。**

`app/lib/image/image_client.ts`

```ts
generateImage(prompt: string, opts?: ImageOptions)
editImage({ imageUrl, instruction, referenceUrls?, ...opts })
```

`opts`（`size` / `quality` / `background` / `outputFormat`）は全て任意。
省略時は現在と完全に同じ挙動になるため、`/api/image/generate`・`/api/image/jacket`・
`/api/image/edit` の動作は変わらない。

その他の変更点:

- `app/top/page.tsx` の `apps` 配列に1件追加
- `vercel.json` に `app/api/sticker/**` の maxDuration を追加
- `data/notices.ts` にお知らせを1件追加
- `package.json` に `fflate` を追加

## Character LOCK

品質の大半をここが決める。

```
STEP1  /api/sticker/plan
       gpt-4o-mini → CharacterProfile JSON ＋ Sticker Manifest

STEP2  /api/sticker/character
       images.generate(quality:'high', background:'transparent')
       → master.png 1枚 ＋ 表情バリエーション2枚（medium）

STEP3  ユーザーが「このキャラで作成」を押す
       → character.locked = true / masterUrl を凍結
```

以降、全スタンプが `images.edit` の参照画像として masterUrl を受け取る。

```ts
images.edit({
  model: "gpt-image-1",
  image: [masterPng],                 // ← Character LOCK
  prompt: `${profileSummary}, ${item.pose}, ${item.expression},
           full body, centered, thick outline,
           no text, no letters, no words`,
  quality: "medium",
  background: "transparent",
})
```

同一性は100%にはならないため、15BP の個別再生成で吸収する。

## BP・課金

一括先払い＋生成クレジット制。

```
バッチ開始   get_balance → bp_lock(パック額) → bp_commit
             project_json.credits = 枚数

各枚生成     GAS呼び出しなし。credits-- して sticker_save

生成失敗     credits を戻すだけ（＝無料リトライ）

途中離脱     credits が残る → 後日再開で消化
```

GAS呼び出しは 1プロジェクトあたり4回で済む（枚数に依存しない）。

| 項目 | BP | 原価 |
|---|---|---|
| キャラクター生成 | 50 | 約 $0.25 |
| スタンプ 8個 | 120 | 約 $0.34 |
| スタンプ 16個 | 220 | 約 $0.67 |
| スタンプ 24個 | 320 | 約 $1.01 |
| スタンプ 32個 | 420 | 約 $1.34 |
| スタンプ 40個 | 500 | 約 $1.68 |
| 1枚再生成 | 15 | 約 $0.042 |
| 文字変更 | 0 | 0 |
| LINE変換＋ZIP | 0 | 0 |

BPパックは 500BP = $5（`app/lib/bp-config.ts`）のため 1BP ≒ $0.01 として換算。
キャラクター生成は当初 20BP 案だったが原価割れのため 50BP に修正した
（リトライ率が最も高い工程のため）。

## LINE規格

`app/lib/sticker/line_spec.ts` に集約する。仕様変更時はこの1ファイルのみ修正する。

- スタンプ画像: 370×320px 以内 / 実装では 370×320 固定キャンバス、内側 350×300 に収める
- メイン画像: 240×240px
- タブ画像: 96×74px
- PNG・背景透過・縦横は偶数px
- 1画像 1MB以内 / ZIP 60MB以内
- イラスト周囲に約10pxの余白
- タイトル 40文字以内 / 説明 160文字以内
- 個数: 8 / 16 / 24 / 32 / 40

出力ZIP:

```
main.png
tab.png
01.png … 40.png
metadata.json
```

## LINEへの自動申請はしない

Creators Market への提出はユーザー自身が行う。LIFAI は「提出可能なZIP＋タイトル＋説明文」
を用意するところまで。LINEのログイン情報を預からずに済み、仕様変更にも強い。

## テスト

`npm test`（jest / testEnvironment: node）。純粋ロジックを対象にする。

- `line_spec.test.ts` — 偶数化・contain計算・タイトル/説明の検証
- `cost.test.ts` — パック価格・クレジット計算
- `manifest.test.ts` — LLM出力の検証と正規化

Canvas / ZIP はブラウザAPI依存のため jest 対象外。

## 残るリスク

| リスク | 対策 |
|---|---|
| transparent 出力の縁の品質 | 実測。汚ければ Composer 側で閾値処理 |
| キャラ同一性が100%でない | 15BP の個別再生成で吸収。UIで再生成を目立たせる |
| LINE規格の変更 | `line_spec.ts` に集約済み |
| GAS手作業デプロイ | 2アクションのみ。`gas/sticker_actions.gs` に貼り付け用を用意 |
