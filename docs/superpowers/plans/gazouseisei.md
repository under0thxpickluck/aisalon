了解。
では**UI設計図を追加した完成版MD**として、そのままClaude Codeに投げられる形で**作り直し版**を出す。
既存のLIFAI構造、`AIBotWidget` 常設、App Router、GAS連携、`/api/song/*` の流れを前提に崩さない構成でまとめる。 

---

# `lifai_image_generation_system_v3.md`

---

## 0. 方針（最重要）

* ❌ 既存コード削除禁止
* ❌ 既存APIの破壊的変更禁止
* ❌ 既存GASシートの破壊禁止
* ✅ **追加実装のみ**
* ✅ **Next.js 14 App Router 構造に合わせる**
* ✅ **GAS + Sheets 連携前提**
* ✅ **BP消費型**
* ✅ **音楽生成との連動前提**
* ✅ **画像生成ミニアプリは会話型UIを中核にする**
* ✅ **画像編集も導入対象に含める**
* ✅ **生成前に必ずBP消費を明示する**

---

## 1. 目的

LIFAIに画像生成機能を追加し、以下の4本柱を成立させる。

1. **会話型画像生成**

   * AIと会話しながら、段階的に画像内容を固めていく
   * 生成前にBP消費量を提示
   * 会話量・指定量に応じてBP課金

2. **音楽ジャケット生成**

   * 曲生成完了後に、楽曲内容からジャケット画像を生成
   * **1枚あたり100BP固定**
   * 将来的に3候補生成も拡張可能

3. **画像編集**

   * 既存画像の一部変更・雰囲気変更・背景変更を可能にする
   * 例: 髪色変更、制服化、夜景化、泣き顔化

4. **履歴と収益導線**

   * ユーザーごとの生成履歴保存
   * BP課金と自然に接続
   * 高品質・編集・ジャケットで単価を上げる

---

## 2. LIFAI既存構造との整合

本実装は、LIFAIの以下の既存構造に合わせて追加する。

* Next.js 14 App Router 構成
* `app/api/*` によるAPI実装
* `app/layout.tsx` 配下での全体UI構成
* `AIBotWidget` の常時表示構成
* `WalletBadge` によるBP/EP残高導線
* `/api/wallet/balance` による残高確認
* `/api/song/start` におけるBP前提のジョブ課金思想
* GAS `get_balance` / `me` / 認証系 action の既存運用 

---

## 3. 追加ディレクトリ構成

```txt
app/
├── image/
│   └── page.tsx                       # 画像生成ミニアプリ本体
│
├── api/
│   └── image/
│       ├── chat/route.ts              # 会話を進める
│       ├── preview-cost/route.ts      # 生成前BP見積もり
│       ├── generate/route.ts          # 通常画像生成
│       ├── edit/route.ts              # 画像編集
│       ├── history/route.ts           # 履歴取得
│       └── jacket/route.ts            # 音楽ジャケット生成
│
├── lib/
│   └── image/
│       ├── prompt_builder.ts          # state→最終prompt変換
│       ├── chat_state.ts              # 会話状態管理
│       ├── cost_calculator.ts         # BP計算
│       ├── image_client.ts            # OpenAI Images接続
│       ├── image_guard.ts             # 入力検証と上限制御
│       └── image_types.ts             # 型定義
│
components/
├── image/
│   ├── ImageChatPanel.tsx             # 会話パネル
│   ├── ImageStateChips.tsx            # 現在の設定可視化
│   ├── ImageCostBox.tsx               # BP消費表示
│   ├── ImagePreviewCard.tsx           # 生成結果表示
│   ├── ImageHistoryGrid.tsx           # 履歴一覧
│   ├── ImageEditPanel.tsx             # 編集モードUI
│   ├── ImageStylePicker.tsx           # スタイル選択UI
│   └── ImageGenerateButton.tsx        # 生成ボタン
```

---

## 4. 環境変数

`.env.local` に追加する。

```env
OPENAI_API_KEY=xxxx
IMAGE_MIN_BP=30
IMAGE_MAX_BP=150
IMAGE_JACKET_BP=100
IMAGE_JACKET_3_BP=250
IMAGE_TIMEOUT_MS=60000
```

---

## 5. 機能仕様

---

### 5.1 通常画像生成（会話型）

#### 概要

ユーザーは1発で長いプロンプトを書くのではなく、AIと会話しながら画像の条件を決める。

#### 会話で固める項目例

* キャラクター属性
* 髪型
* 服装
* 表情
* 背景
* 時間帯
* 雰囲気
* 画風
* 構図
* 追加ディテール

#### 例

* ユーザー: 制服の女の子
* AI: 髪型はロング、ボブ、ポニーテールのどれにする？
* ユーザー: ロング
* AI: 表情は笑顔、泣きそう、無表情のどれにする？
* ユーザー: 泣きそう

#### 特徴

* ユーザーが迷っていても画像が作りやすい
* LIFAIの会話体験と一致
* 一発生成より失敗率が下がる

---

### 5.2 音楽ジャケット生成

#### 概要

曲生成後に、歌詞・テーマ・ジャンル・ムードからジャケット画像を生成する。

#### 課金

* **1枚 100BP固定**
* 将来的に3枚候補を出す場合は 250BP

#### 使用タイミング

* 曲完成後の結果画面
* 「ジャケットを生成する」ボタン押下時

#### ジャケットプロンプト入力元

* `theme`
* `genre`
* `mood`
* 曲タイトル
* 歌詞要約
* 雰囲気タグ

---

### 5.3 画像編集

#### 概要

アップロード済み画像または既存生成画像を対象に、追加指示で変化させる。

#### 編集例

* 髪色を黒から銀髪に
* 服を私服から制服に
* 背景を教室から夜景に
* 表情を笑顔から泣き顔に
* 全体をアニメ風から幻想風に

#### 課金

通常の会話型画像生成と同じ課金式に加えて、**編集補正 +30BP**

---

## 6. BP課金仕様

---

### 6.1 音楽ジャケット課金

| 内容        |    BP |
| --------- | ----: |
| ジャケット1枚生成 | 100BP |
| ジャケット3枚候補 | 250BP |

---

### 6.2 通常画像生成課金

OpenAI実トークンをそのままユーザー課金に使わず、**LIFAI内部課金式**でBPを算出する。

#### 課金式

```ts
base_bp = 20
turn_bp = 会話ターン数 * 5
text_bp = ceil(総文字数 / 120) * 5
style_bp = スタイル指定あり ? 10 : 0
hq_bp = 高品質指定あり ? 20 : 0
edit_bp = 編集モード ? 30 : 0

raw_total = base_bp + turn_bp + text_bp + style_bp + hq_bp + edit_bp
final_bp = clamp(raw_total, 30, 150)
```

#### 意味

* 軽い生成でも最低30BP
* 会話を深めるほど少しずつ増える
* 青天井にせず最大150BPで止める

---

### 6.3 ユーザー表示

生成前に必ず表示する。

例:

```txt
この画像を生成すると 65BP 消費します
```

または

```txt
高品質ONのため +20BP 加算されています
編集モードのため +30BP 加算されています
合計: 95BP
```

---

### 6.4 失敗時の扱い

* 生成前にBPを**仮ロック**
* 成功時に**確定**
* 失敗時に**返却**

---

## 7. 型定義

`app/lib/image/image_types.ts`

```ts
export type ImageChatState = {
  character?: string;
  hair?: string;
  outfit?: string;
  emotion?: string;
  scene?: string;
  timeOfDay?: string;
  atmosphere?: string;
  style?: string;
  composition?: string;
  detail?: string;
  turns: number;
  textLength: number;
  hq?: boolean;
  edit?: boolean;
};

export type ImageHistoryItem = {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  bp_used: number;
  type: "generate" | "edit" | "jacket";
  created_at: string;
};

export type ImagePreviewCost = {
  totalBp: number;
  breakdown: {
    base: number;
    turn: number;
    text: number;
    style: number;
    hq: number;
    edit: number;
  };
};
```

---

## 8. API設計

---

### 8.1 `POST /api/image/chat`

#### 用途

会話を進め、次に聞くべき項目と状態更新を返す。

#### リクエスト

```json
{
  "id": "user_login_id",
  "code": "user_secret",
  "message": "制服の女の子にしたい",
  "state": {
    "character": "",
    "hair": "",
    "outfit": "",
    "emotion": "",
    "scene": "",
    "style": "",
    "turns": 1,
    "textLength": 12
  }
}
```

#### レスポンス

```json
{
  "ok": true,
  "reply": "いいね。髪型はロング、ボブ、ポニーテールのどれにする？",
  "state": {
    "character": "girl",
    "outfit": "school uniform",
    "turns": 2,
    "textLength": 32
  },
  "suggestedNextField": "hair"
}
```

#### 処理

1. ユーザー認証
2. `message` と `state` を受け取る
3. GPTで不足要素を補完
4. 次の質問を返す

---

### 8.2 `POST /api/image/preview-cost`

#### 用途

現在の状態から、生成時のBP見積もりを返す。

#### リクエスト

```json
{
  "state": {
    "character": "girl",
    "hair": "long",
    "emotion": "sad",
    "scene": "night city",
    "style": "anime",
    "turns": 4,
    "textLength": 180,
    "hq": true,
    "edit": false
  }
}
```

#### レスポンス

```json
{
  "ok": true,
  "totalBp": 65,
  "breakdown": {
    "base": 20,
    "turn": 20,
    "text": 10,
    "style": 10,
    "hq": 20,
    "edit": 0
  }
}
```

---

### 8.3 `POST /api/image/generate`

#### 用途

通常画像生成を実行する。

#### リクエスト

```json
{
  "id": "user_login_id",
  "code": "user_secret",
  "state": {
    "character": "girl",
    "hair": "long",
    "emotion": "sad",
    "scene": "night city",
    "style": "anime",
    "turns": 4,
    "textLength": 180,
    "hq": true
  }
}
```

#### レスポンス

```json
{
  "ok": true,
  "imageUrl": "https://...",
  "bpUsed": 65
}
```

#### 処理フロー

1. 認証
2. BP見積もり
3. BP残高確認
4. 仮ロック
5. `prompt_builder.ts` で最終プロンプト生成
6. OpenAI Images API 呼び出し
7. 成功なら確定・履歴保存
8. 失敗なら返却

---

### 8.4 `POST /api/image/edit`

#### 用途

画像編集を実行する。

#### リクエスト

```json
{
  "id": "user_login_id",
  "code": "user_secret",
  "imageUrl": "https://...",
  "instruction": "髪色を銀髪にして、背景を夜景に変えて",
  "state": {
    "style": "anime",
    "turns": 2,
    "textLength": 60,
    "edit": true
  }
}
```

#### レスポンス

```json
{
  "ok": true,
  "imageUrl": "https://...",
  "bpUsed": 70
}
```

---

### 8.5 `GET /api/image/history?id=xxx&code=yyy`

#### 用途

ユーザーの生成履歴取得

#### レスポンス

```json
{
  "ok": true,
  "items": [
    {
      "id": "img_001",
      "user_id": "u123",
      "prompt": "anime girl, long hair, sad, night city...",
      "image_url": "https://...",
      "bp_used": 65,
      "type": "generate",
      "created_at": "2026-04-15T10:00:00+09:00"
    }
  ]
}
```

---

### 8.6 `POST /api/image/jacket`

#### 用途

音楽ジャケット生成専用

#### リクエスト

```json
{
  "id": "user_login_id",
  "code": "user_secret",
  "jobId": "song_20260415_ABC123",
  "theme": "切ない恋",
  "genre": "バラード",
  "mood": "emotional",
  "title": "君のいない夜"
}
```

#### レスポンス

```json
{
  "ok": true,
  "imageUrl": "https://...",
  "bpUsed": 100
}
```

#### 課金

固定100BP

---

## 9. OpenAI接続実装

`app/lib/image/image_client.ts`

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateImage(prompt: string) {
  const res = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  const item = res.data?.[0];
  if (!item?.url) {
    throw new Error("image_generation_failed");
  }

  return item.url;
}
```

編集APIは導入時点では別関数として分ける。

```ts
export async function editImage(params: {
  imageUrl: string;
  instruction: string;
}) {
  // 実装時は OpenAI Images edit を利用
  // まずは generate と切り分けた関数名だけ用意しておく
  throw new Error("not_implemented_yet");
}
```

---

## 10. プロンプト構築

`app/lib/image/prompt_builder.ts`

```ts
import type { ImageChatState } from "./image_types";

export function buildPrompt(state: ImageChatState): string {
  return [
    state.character || "girl",
    state.hair ? `${state.hair} hair` : "",
    state.outfit || "",
    state.emotion || "neutral expression",
    state.scene || "simple background",
    state.timeOfDay || "",
    state.atmosphere || "",
    state.style || "anime style",
    state.composition || "",
    state.detail || "",
    state.hq ? "high quality, detailed, polished illustration" : "clean illustration",
  ]
    .filter(Boolean)
    .join(", ");
}
```

---

## 11. コスト計算

`app/lib/image/cost_calculator.ts`

```ts
import type { ImageChatState, ImagePreviewCost } from "./image_types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function calcImageCost(state: ImageChatState): ImagePreviewCost {
  const base = 20;
  const turn = (state.turns || 0) * 5;
  const text = Math.ceil((state.textLength || 0) / 120) * 5;
  const style = state.style ? 10 : 0;
  const hq = state.hq ? 20 : 0;
  const edit = state.edit ? 30 : 0;

  const totalBp = clamp(base + turn + text + style + hq + edit, 30, 150);

  return {
    totalBp,
    breakdown: {
      base,
      turn,
      text,
      style,
      hq,
      edit,
    },
  };
}
```

---

## 12. UI設計図（追加・重要）

このセクションは**今回の追加要件**。
単にページを作るのではなく、LIFAIに自然に馴染む**“いい感じのUI”**を定義する。

---

### 12.1 UI全体コンセプト

#### キーワード

* ダークベース
* 近未来
* 上品
* 触りやすい
* 情報過多にしない
* 生成前の期待感が高まる
* 「会話で育てる」感覚を出す

#### トーン

* マーケットやトップ画面のダーク路線と整合
* 音楽生成UIとも並べて違和感がない
* “画像AIツール”ではなく“LIFAIのミニアプリ”として見せる

---

### 12.2 画像生成ミニアプリ `/image` ページ構成

#### レイアウト

**PC:** 左右2カラム
**SP:** 縦1カラム

```txt
┌────────────────────────────────────────────┐
│ Header                                     │
│ タイトル / BP残高 / 戻る                   │
├────────────────────────────────────────────┤
│ Left Column           │ Right Column       │
│ 会話パネル            │ 生成プレビュー      │
│ 状態チップ            │ 画像表示            │
│ スタイル選択          │ BPコスト表示        │
│ 入力欄                │ 生成ボタン          │
│                       │ 履歴サムネイル      │
└────────────────────────────────────────────┘
```

---

### 12.3 ページヘッダー設計

#### 表示要素

* タイトル: `AI画像生成`
* サブコピー: `会話しながら理想の1枚を作ろう`
* 右上:

  * `WalletBadge`
  * `戻る`
  * `履歴`

#### 見た目

* 背景: `#0B1220`
* 文字: `#EAF0FF`
* サブ文字: `#A8B3CF`
* 下部に薄い境界線
* 上部余白大きめ

---

### 12.4 左カラム: 会話パネル

#### コンポーネント

`ImageChatPanel.tsx`

#### UI構成

* 会話ログバブル
* AIメッセージ
* ユーザーメッセージ
* 下部入力欄
* 送信ボタン
* 「候補を提案して」ボタン

#### 見た目

* チャットバブル型
* AI側: 濃紺背景
* ユーザー側: 紫がかった濃色
* 角丸大きめ
* 余白広め
* 会話の下に小さく「この会話は画像内容に反映されます」

#### 仕様

* Enter送信
* Shift+Enter改行
* 入力中ローディング表示
* 送信中はボタンdisable

---

### 12.5 状態チップ表示

#### コンポーネント

`ImageStateChips.tsx`

#### 用途

現在確定している要素を見える化する。

#### 表示例

* `制服`
* `ロングヘア`
* `泣きそう`
* `夜の街`
* `アニメ風`

#### UI

* 横並びチップ
* 不足項目は薄い点線チップで `未設定`
* クリックで該当項目を再編集可能にしてもよい

#### 色

* 設定済み: 紫〜青グラデのチップ
* 未設定: 半透明グレー

---

### 12.6 スタイル選択UI

#### コンポーネント

`ImageStylePicker.tsx`

#### 配置

会話パネルの下、または右カラム上部でも可

#### スタイル候補例

* Anime
* Soft Anime
* Fantasy
* Elegant
* Dark
* Idol Jacket
* Cinematic

#### UI

* 2列または3列グリッド
* 選択中は光る枠
* 各タイルに簡単な説明
* スタイル選択時は `+10BP` の小表記

---

### 12.7 右カラム: プレビュー領域

#### コンポーネント

`ImagePreviewCard.tsx`

#### 構成

* まだ未生成:

  * 大きなプレースホルダー
  * 「ここに生成結果が表示されます」
* 生成後:

  * 正方形プレビュー
  * 保存ボタン
  * 再生成ボタン
  * 編集へ進むボタン

#### 見た目

* 角丸 24px 以上
* シャドウ柔らかめ
* 背景は濃色グラデ
* ローディング中は光るスケルトン

---

### 12.8 BPコストボックス

#### コンポーネント

`ImageCostBox.tsx`

#### 表示内容

* 合計BP
* 内訳
* 現在残高
* 残高不足時の警告

#### 例

```txt
消費予定: 65BP

内訳
基本料金 20BP
会話量 20BP
文字量 10BP
スタイル 10BP
高品質 5BP

現在残高: 120BP
```

#### UI

* 枠つきカード
* 残高足りると青系
* 足りないと赤系
* 下部に小さく

  * `生成失敗時はBP返却`
  * `生成前に最終確認されます`

---

### 12.9 生成ボタン

#### コンポーネント

`ImageGenerateButton.tsx`

#### ボタン文言

* 通常: `この内容で生成する`
* 残高不足: `BPが不足しています`
* 生成中: `生成中...`

#### UI

* 横幅いっぱい
* 紫〜青グラデ
* 押下感強め
* hoverで少し発光
* disabled時はくすませる

---

### 12.10 履歴UI

#### コンポーネント

`ImageHistoryGrid.tsx`

#### 表示形式

* サムネ3列グリッド
* hoverで詳細
* モーダルで拡大表示

#### 各カード情報

* サムネ
* 使用BP
* 種別

  * generate
  * edit
  * jacket
* 生成日

#### アクション

* 再編集
* 再生成
* 保存

---

### 12.11 編集モードUI

#### コンポーネント

`ImageEditPanel.tsx`

#### 画面構成

* 左: 元画像
* 右: 指示入力
* 下: 編集後プレビュー

#### 指示テンプレートボタン

* 髪色変更
* 服変更
* 背景変更
* 表情変更
* 雰囲気変更

#### 文言例

* `髪色を銀髪にする`
* `服を制服にする`
* `背景を夜景にする`

---

### 12.12 音楽ジャケット生成UI

#### 配置先

音楽生成結果画面の完成後セクション

#### 構成

* 曲タイトル
* 曲の雰囲気タグ
* ジャケット生成ボタン
* `1枚 100BP`
* 生成後は曲の横にジャケット表示

#### 見た目

* 音楽カードと一体化
* 画像があるとアルバムっぽく見える
* 生成前はレコードジャケット風プレースホルダー

#### ボタン文言

* `ジャケットを生成する（100BP）`

---

## 13. UI文言ガイド

日本語UIだが、LIFAIの世界観を壊さない文言にする。

### 推奨文言

* `会話しながら理想の1枚を作ろう`
* `この内容を画像に反映します`
* `生成前にBP消費量を確認できます`
* `画像生成に失敗した場合はBPは返却されます`
* `今の内容でかなり良い感じです。生成してみる？`

### 避けたい文言

* 機械的すぎるもの
* 開発者向けの単語丸出し
* 「トークン」「JSON」など内部用語の露出

---

## 14. スタイルガイド

### カラー

* 背景: `#0B1220`
* メイン文字: `#EAF0FF`
* サブ文字: `#A8B3CF`
* アクセント1: `#7C5CFF`
* アクセント2: `#3AA0FF`
* 警告: `#FF6B6B`
* 成功: `#49D17D`

### 角丸

* カード: 20〜24px
* ボタン: 16〜20px

### 余白

* カード内: 16〜24px
* セクション間: 24〜32px

### エフェクト

* うっすらグロー
* 過剰なアニメーションは不要
* ローディングだけ上品に動かす

---

## 15. GAS追加

新規シートを追加する。

### 15.1 `image_logs`

カラム:

```txt
id
user_id
prompt
image_url
bp_used
type
meta_json
created_at
```

`type`:

* `generate`
* `edit`
* `jacket`

---

### 15.2 追加GAS action

* `image_log`
* `image_history`
* `bp_lock`
* `bp_commit`
* `bp_refund`

#### 用途

* 仮ロック
* 成功確定
* 失敗返金
* 履歴保存
* 履歴取得

---

## 16. 音楽ジャケット連動仕様

### 対象

曲生成後の画面と `/api/song/*` フローの後続処理

### 追加案

* 曲完成時に「ジャケット生成」ボタン表示
* クリック時に `/api/image/jacket` 呼び出し
* 100BP消費
* 成功後、曲カードのサムネとして表示

### ジャケット用プロンプト例

```txt
album cover, emotional ballad, lonely night, anime style, elegant composition, beautiful typography-free illustration
```

### 注意

* ジャケットは文字を画像内に入れない前提でまず開始する
* タイトル文字入れは後段の画像合成で別対応にする方が安全

---

## 17. 導入順序

1. `image_types.ts`
2. `cost_calculator.ts`
3. `prompt_builder.ts`
4. `image_client.ts`
5. `/api/image/preview-cost`
6. `/api/image/generate`
7. `/api/image/history`
8. `/image/page.tsx`
9. 画像用UIコンポーネント群
10. GAS action追加
11. `/api/image/jacket`
12. 音楽画面へのジャケット導線追加
13. `/api/image/edit` 実装

---

## 18. 受け入れ条件

### 通常画像生成

* 会話しながら画像内容を固められる
* 生成前にBPが表示される
* 生成成功で画像表示
* 失敗でBP返却
* 履歴に残る

### 音楽ジャケット

* 曲完成後に100BPで生成できる
* 曲ごとに紐づけられる
* 履歴に `jacket` として保存される

### 編集

* 既存画像を読み込み、指示付きで編集できる
* 課金内訳に編集補正が反映される

### UI

* SP/PCで崩れない
* ダーク路線で既存LIFAIと違和感がない
* BP導線がわかりやすい

---

## 19. 最終評価

この設計は、LIFAIの既存仕様に対してかなり自然に入る。

* App Router前提で追加しやすい
* 既存のBP思想と合う
* `WalletBadge` や `/api/wallet/balance` と接続しやすい
* 音楽機能との連動価値が高い
* 会話型UIなのでLIFAIらしさが出る
* 収益導線が明確

単なる画像生成機能ではなく、
**LIFAIのミニアプリとして“会話で育てる画像体験”にすること**が重要。

---

## 20. Claude Code実装時の注意

* 既存コードは削除しない
* 追加ファイル中心で進める
* `/api/song/*` は最小変更
* UIコンポーネントは `components/image/` に分離
* GAS action名は既存命名に合わせる
* 失敗時のBP返却を必ず実装
* エラーメッセージはユーザー向けとログ向けを分ける
* 将来のスタイル追加を見越して `style_presets` 化しやすい構造にする

---

必要なら次に、**このMDをさらにClaude Code向けに「実装タスク分解版」にして、ファイルごとに何を書くかまで落とした版**を作れる。
