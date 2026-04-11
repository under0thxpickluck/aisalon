# LIFAI システム仕様書

> 作成日: 2026-03-08
> 対象ブランチ: main
> フレームワーク: Next.js 14 (App Router)

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [ディレクトリ構造](#2-ディレクトリ構造)
3. [環境変数](#3-環境変数)
4. [設定ファイル](#4-設定ファイル)
5. [ミドルウェア](#5-ミドルウェア)
6. [レイアウト](#6-レイアウト)
7. [ページ一覧](#7-ページ一覧)
8. [API ルート一覧](#8-api-ルート一覧)
9. [コンポーネント一覧](#9-コンポーネント一覧)
10. [ライブラリ・ユーティリティ](#10-ライブラリユーティリティ)
11. [状態管理・ストレージ](#11-状態管理ストレージ)
12. [認証フロー](#12-認証フロー)
13. [ユーザー申請フロー](#13-ユーザー申請フロー)
14. [決済フロー（NOWPayments）](#14-決済フローNOWPayments)
15. [音楽・曲生成フロー](#15-音楽曲生成フロー)
16. [GAS バックエンド連携](#16-GAS-バックエンド連携)
17. [マーケットプレイス](#17-マーケットプレイス)
18. [管理者機能](#18-管理者機能)
19. [セキュリティ設計](#19-セキュリティ設計)
20. [データフロー図](#20-データフロー図)

---

## 1. プロジェクト概要

**LIFAI** は日本のAI教育オンラインサロン向けのWebプラットフォームです。

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 14 (App Router) |
| バックエンド | Google Apps Script (GAS) + Sheets |
| 決済 | NOWPayments (USDT/TRC20) |
| 音楽生成 | Replicate (Minimax music-01) + OpenAI GPT-4o-mini |
| デプロイ | Vercel |
| 認証（ユーザー） | localStorage + sessionStorage |
| 認証（管理者） | HTTP Basic Auth (middleware) |

### 基本的なユーザーフロー

```
ホーム → プラン購入 → 申請フォーム → 審査待ち → 管理者承認 → ログイン → ダッシュボード
```

---

## 2. ディレクトリ構造

```
aisalon/
├── app/
│   ├── layout.tsx                  # グローバルレイアウト
│   ├── page.tsx                    # ホームページ (/)
│   ├── login/page.tsx              # ログイン
│   ├── top/page.tsx                # ダッシュボード (認証後)
│   ├── purchase/page.tsx           # Step 1: プラン選択
│   ├── apply/page.tsx              # Step 2: 申請フォーム
│   ├── confirm/page.tsx            # Step 3: 確認・送信
│   ├── pending/page.tsx            # 審査待ち画面
│   ├── reset/page.tsx              # パスワードリセット
│   ├── admin/page.tsx              # 管理者ダッシュボード
│   ├── market/page.tsx             # マーケットプレイス
│   ├── music/page.tsx              # 音楽生成 (旧)
│   ├── music2/page.tsx             # 音楽生成 (新)
│   ├── music-boost/page.tsx        # Music Boost（EP決済）
│   ├── 5000/page.tsx               # 特定プランLP
│   ├── lib/
│   │   └── auth.ts                 # 認証ヘルパー
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts      # ログイン
│       │   └── reset/route.ts      # パスワードリセット
│       ├── apply/
│       │   ├── create/route.ts     # 申請作成
│       │   └── status/route.ts     # 申請状況確認
│       ├── me/route.ts             # ログインユーザー情報
│       ├── nowpayments/
│       │   ├── create/route.ts     # インボイス作成
│       │   └── ipn/route.ts        # 決済Webhook
│       ├── admin/
│       │   ├── list/route.ts       # 申請一覧
│       │   ├── approve/route.ts    # 承認
│       │   ├── grant-bp/route.ts   # BP付与
│       │   ├── sell-requests/route.ts # 売却申請一覧
│       │   ├── members/route.ts    # 会員一覧（ページング・ソート）
│       │   └── dashboard/route.ts  # ダッシュボード統計
│       ├── market/
│       │   ├── create/route.ts     # 商品出品
│       │   ├── list/route.ts       # 商品一覧
│       │   └── orders/route.ts     # 購入履歴
│       ├── user/
│       │   ├── pending-bp/route.ts # 未受取BP確認
│       │   └── claim-bp/route.ts   # BP受取
│       ├── wallet/
│       │   └── balance/route.ts    # 残高確認
│       ├── music-boost/
│       │   ├── status/route.ts     # Music Boost状態取得
│       │   ├── subscribe/route.ts  # Music Boost契約（EP決済）
│       │   └── cancel/route.ts     # Music Boost解約
│       ├── music/
│       │   ├── generate/route.ts   # 音楽生成開始
│       │   ├── status/route.ts     # 音楽生成状況
│       │   └── _cache.ts           # 音楽生成キャッシュ
│       └── song/
│           ├── start/route.ts      # 曲作成開始
│           └── _jobStore.ts        # 曲作成ジョブストア
├── components/
│   ├── Field.tsx                   # テキスト入力
│   ├── Select.tsx                  # セレクトボックス
│   ├── StepHeader.tsx              # ステップ表示ヘッダー
│   ├── PlanPicker.tsx              # プラン選択UI
│   ├── WalletBadge.tsx             # BP/EP残高バッジ
│   ├── BPGrantModal.tsx            # BP受取モーダル
│   ├── storage.ts                  # sessionStorage操作
│   ├── useToast.ts                 # トーストhook
│   ├── Toast.tsx                   # トースト表示
│   └── AIBot/
│       ├── AIBotProvider.tsx       # AIBotコンテキスト
│       └── AIBotWidget.tsx         # AIBotウィジェット
├── middleware.ts                   # Basic Auth ガード
├── vercel.json                     # Vercelタイムアウト設定
└── package.json
```

---

## 3. 環境変数

`.env.local` で管理。全て必須（注記がある場合は任意）。

| 変数名 | 用途 |
|---|---|
| `GAS_WEBAPP_URL` | GAS WebApp デプロイURL |
| `GAS_API_KEY` | GAS APIキー（全リクエストに付加） |
| `GAS_ADMIN_KEY` | GAS 管理者専用キー |
| `ADMIN_USER` | Basic Auth ユーザー名 |
| `ADMIN_PASS` | Basic Auth パスワード |
| `NOWPAYMENTS_API_KEY` | NOWPayments API キー |
| `NOWPAYMENTS_IPN_SECRET` | IPN HMAC-SHA512 署名検証用シークレット |
| `NEXT_PUBLIC_SITE_URL` | 公開URL（IPN callback等に使用） |
| `OPENAI_API_KEY` | 歌詞生成（任意） |
| `REPLICATE_API_TOKEN` | 音楽生成（任意） |
| `MERGE_SERVER_URL` | 音声マージサーバURL（任意） |

---

## 4. 設定ファイル

### `package.json`

| パッケージ | バージョン | 用途 |
|---|---|---|
| next | 14.2.5 | App Router |
| react / react-dom | 18.3.1 | UI |
| next-pwa | 5.6.0 | PWA対応 |
| sonner | 2.0.7 | トースト通知 |
| tailwindcss | 3.4.10 | スタイリング |

スクリプト:
```bash
npm run dev    # 開発サーバー起動 (http://localhost:3000)
npm run build  # 本番ビルド
npm start      # 本番サーバー起動 (port 3000)
```

### `vercel.json`

```json
{
  "functions": {
    "app/api/music/**": { "maxDuration": 300 },
    "app/api/song/**":  { "maxDuration": 300 }
  }
}
```

音楽・曲生成は2〜3分かかるため、Vercel の実行時間を300秒（5分）に延長。

---

## 5. ミドルウェア

**ファイル:** `middleware.ts`

### 役割

`/admin/*` および `/api/admin/*` に対して HTTP Basic Auth を強制する。

### 処理フロー

1. リクエストパスが `/admin` または `/api/admin` で始まるかチェック
2. `Authorization` ヘッダーを確認
3. Base64 デコードして `user:pass` を検証
4. 環境変数 `ADMIN_USER` / `ADMIN_PASS` と比較
5. 不一致 → `401 Unauthorized` + `WWW-Authenticate: Basic realm="Admin"` ヘッダー返却
6. 一致 → リクエストを通過させる

---

## 6. レイアウト

**ファイル:** `app/layout.tsx`

### メタデータ設定

| 項目 | 値 |
|---|---|
| title | LIFAI |
| description | AI教育サロン |
| themeColor | `#0b1022` |
| OGP / Twitter Card | 設定済み |
| PWA アイコン | `/icon-192.png`, `/icon-512.png` |

### 主要要素

- `<AIBotProvider>` — AIBotコンテキストプロバイダー
- `<ToastHost>` — トースト表示ホスト
- `<AIBotWidget>` — チャットウィジェット（全ページに表示）
- フォント: 日本語対応フォント設定

---

## 7. ページ一覧

### `app/page.tsx` — ホームページ (`/`)

**用途:** プレセール情報の表示・ユーザー導線

| 要素 | 内容 |
|---|---|
| カウントダウン | `endAtISO = "2026-05-01T23:59:59+09:00"` |
| 調達バー | `raised = 4852` / `goal = 10000` USDT |
| CTA | 権利購入 / ログイン / ビジョン確認 |
| フッター | 利用規約 / 紹介プログラム / プライバシーポリシー / 特定商取引法 / LINE問い合わせ |
| PWA案内 | ホーム画面追加を促す |

---

### `app/login/page.tsx` — ログイン (`/login`)

**用途:** ユーザー認証

**入力項目:**
- ログインID
- パスワード（ワンタイムコード）

**フロー:**
1. `POST /api/auth/login` に `{ id, code }` 送信
2. 成功時:
   - `setAuth()` → localStorage に `{ status, id, token, updatedAt }` 保存
   - `setAuthSecret()` → sessionStorage にパスワード保存
   - `/top` へリダイレクト
3. pending 返却時: `/pending` へリダイレクト

---

### `app/top/page.tsx` — ダッシュボード (`/top`)

**用途:** ログイン後のメインダッシュボード

**主要コンポーネント:**

| コンポーネント | 説明 |
|---|---|
| `PresaleHeader` | プレセール進捗バー |
| `BalanceBadge` | BP/EP残高 (`/api/wallet/balance` 呼び出し) |
| `ReferralCard` | 紹介コード表示 (`/api/me` 呼び出し) |
| `AppIconCard` | 機能タイル（下記参照） |

**機能タイル一覧:**

| タイル | カラー | 状態 |
|---|---|---|
| 音楽生成 NEW | violet | 有効 |
| 音楽生成 (旧) | indigo | 有効 |
| マーケット | emerald | 有効 |
| note記事生成 | — | 準備中 |
| ワークフロー生成 | — | 準備中 |
| アプリ作成 | — | 準備中 |
| 毎日占い | amber | 外部リンク |
| コラム | indigo | NEW |
| 権利購入 | rose | 有効 |

**未受取BP通知:**
1. `/api/user/pending-bp` で確認
2. BP がある場合 → `BPGrantModal` 表示
3. 受取後 → `/api/user/claim-bp` で確定

---

### `app/purchase/page.tsx` — プラン選択 (`/purchase`, Step 1)

**用途:** 購入プランの選択・決済開始

**プラン定義:**

| ID | 実価格 | 表示価格（15%OFF） | タイトル | バッジ |
|---|---|---|---|---|
| `30` | 34 USDT | 40 USDT | Starter | — |
| `50` | 57 USDT | 67 USDT | Builder | 人気 |
| `100` | 114 USDT | 134 USDT | Automation | おすすめ |
| `500` | 567 USDT | 667 USDT | Core | — |
| `1000` | 1,134 USDT | 1,334 USDT | Infra | — |

**フロー:**
1. プラン選択 → `saveDraft()` でsessionStorageに保存
2. `applyId` 自動生成: `lifai_{Date.now()}`
3. `POST /api/apply/create` → GASに仮申請行を作成
4. `POST /api/nowpayments/create` → インボイスURL取得
5. NOWPaymentsポータルへ外部リダイレクト
6. 支払い完了チェック → "次へ" ボタン有効化

---

### `app/apply/page.tsx` — 申請フォーム (`/apply`, Step 2)

**用途:** 申請者の個人情報入力

**必須入力項目:**

| フィールド | 説明 |
|---|---|
| email | メールアドレス |
| name | 氏名 |
| nameKana | 氏名（カナ） |
| discordId | Discord ID |
| ageBand | 年代 |
| prefecture | 都道府県 |
| city | 市区町村 |
| job | 職業 |

**任意入力項目:**

| フィールド | 説明 |
|---|---|
| refName | 紹介者名 |
| refId | 紹介者ID |

**バリデーション:**
- メール形式チェック
- 全必須項目の空文字NG

**自動保存:** `addval_apply_draft_v1`（sessionStorage）に変更時自動保存

---

### `app/confirm/page.tsx` — 確認・送信 (`/confirm`, Step 3)

**用途:** 入力内容の最終確認・申請送信

**フロー:**
1. Step 2 の入力内容をsessionStorageから読み込み表示
2. `GET /api/apply/status?applyId=...` で支払い状況確認
3. "支払い完了しました" チェックボックス（ローカル状態）
4. 送信: `POST /api/apply`
5. 成功時: `/pending` へリダイレクト + Draft クリア

---

### `app/music-boost/page.tsx` — Music Boost (`/music-boost`)

**用途:** EP を消費して楽曲の配信優先度を高める月額ブーストサービス

**認証:** ページ独自のパスワード認証（`sessionStorage` に `music_boost_authed=1`）

**機能:**

| 機能 | 詳細 |
|---|---|
| EP残高表示 | `GET /api/wallet/balance` から取得 |
| ブースト状況 | `GET /api/music-boost/status?userId=...` |
| プラン選択 | 10プラン（Starter〜Legend）、枠数チェックあり |
| EP決済確認モーダル | プラン・費用・有効期限・免責事項を表示 |
| EP決済ボタン | EP残高不足時は無効化 |
| クレジットカードボタン | 準備中（常にdisabled） |
| 解約 | `POST /api/music-boost/cancel` |
| チュートリアル | `localStorage: musicboost_tutorial_seen`（初回のみ） |

**プラン一覧（PLANS）:**

| id | label | percent | price（USD） | slots |
|---|---|---|---|---|
| starter | Starter | 2% | $9 | 10 |
| light | Light | 5% | $29 | 25 |
| basic | Basic | 10% | $59 | 50 |
| growth | Growth | 15% | $99 | 75 |
| pro | Pro | 20% | $149 | 100 |
| advanced | Advanced | 25% | $199 | 125 |
| premium | Premium | 30% | $299 | 150 |
| elite | Elite | 35% | $499 | 175 |
| master | Master | 40% | $699 | 200 |
| legend | Legend | 45% | $1000 | 225 |

**EP換算:** `price_usd × 100 EP`（例: $9 → 900 EP）

**自動更新:** GAS 時間ベーストリガー（毎日深夜0時）が期限切れブーストを自動更新。EP不足の場合は失効 + メール通知。

---

### `app/admin/page.tsx` — 管理者ダッシュボード (`/admin`)

**用途:** 申請一覧の表示・承認・BP付与・会員一覧・Music Boost管理

**アクセス:** HTTP Basic Auth 必須

**機能:**
- 申請一覧: `GET /api/admin/list`
- 申請承認: `POST /api/admin/approve`
- 売却申請一覧: `GET /api/admin/sell-requests`
- BP付与: `POST /api/admin/grant-bp`
- ダッシュボード統計: `GET /api/admin/dashboard`
- 会員一覧（ページング・サーバーサイドソート）: `GET /api/admin/members`
- 会員一覧のソート可能列: `bp_balance` / `ep_balance` / `login_streak` / `total_login_count` / `last_login_at`
- 会員一覧の Music Boost 列: 契約中プランと有効期限を表示

---

### `app/market/page.tsx` — マーケットプレイス (`/market`)

**用途:** デジタルアイテムの売買プラットフォーム

**スタイル:**
- ダークテーマ: 背景 `#0B1220` / 文字 `#EAF0FF`
- Radial glow 背景効果

**機能:**

| 機能 | 詳細 |
|---|---|
| 商品検索 | 500ms debounce |
| フィルター | item_type / currency |
| ページング | PAGE_SIZE = 12 |
| 商品出品 | `POST /api/market/create` |
| チュートリアル | `TutorialModal`（localStorage確認・初回のみ表示） |

**ItemCard 表示情報:**
- 商品タイプバッジ
- 通貨バッジ
- 価格
- 在庫数

---

## 8. API ルート一覧

### 認証

#### `POST /api/auth/login`

**ファイル:** `app/api/auth/login/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ id: string, code: string }` |
| GAS action | `login` |
| 成功レスポンス | `{ ok: true, status, id, token, plan, ... }` |
| 失敗レスポンス | `{ ok: false, reason: "pending" \| "invalid" }` |

---

#### `POST /api/auth/reset`

**ファイル:** `app/api/auth/reset/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ token: string, password: string }` |
| GAS action | `reset_password` |
| 成功レスポンス | `{ ok: true }` |
| 失敗レスポンス | `{ ok: false, error: string }` |

---

### 申請

#### `POST /api/apply/create`

**ファイル:** `app/api/apply/create/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ plan: string, applyId: string, ...フォームデータ }` |
| GAS action | `apply_create` (初回) / `apply` (フォーム送信時) |
| 成功レスポンス | `{ ok: true }` |

---

#### `GET /api/apply/status`

**ファイル:** `app/api/apply/status/route.ts`

| 項目 | 内容 |
|---|---|
| クエリパラメータ | `applyId: string` |
| GAS action | `admin_list` |
| 成功レスポンス | `{ ok: true, status: "pending" \| "paid" \| "approved" }` |

---

### ユーザー情報

#### `POST /api/me`

**ファイル:** `app/api/me/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ id: string, code: string }` |
| GAS action | `me` |
| タイムアウト | 15秒 |
| 成功レスポンス | `{ ok: true, me: { login_id, email, status, plan, my_ref_code, ref_path, referrer_login_id, ... } }` |
| 失敗レスポンス | `{ ok: false, reason: "pending" \| "invalid", error: string }` |

---

### 決済（NOWPayments）

#### `POST /api/nowpayments/create`

**ファイル:** `app/api/nowpayments/create/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ amount: number, plan: string, applyId: string }` |
| 外部API | `POST https://api.nowpayments.io/v1/invoice` |
| 成功レスポンス | `{ ok: true, invoice_url: string }` |

**NOWPayments リクエストペイロード:**

```json
{
  "price_amount": "<金額>",
  "price_currency": "usd",
  "pay_currency": "usdttrc20",
  "order_id": "lifai_{applyId}",
  "ipn_callback_url": "{NEXT_PUBLIC_SITE_URL}/api/nowpayments/ipn",
  "success_url": "/apply?applyId={applyId}&plan={plan}",
  "cancel_url": "/purchase"
}
```

---

#### `POST /api/nowpayments/ipn`

**ファイル:** `app/api/nowpayments/ipn/route.ts`

**用途:** NOWPayments からの決済完了Webhookを受け取り、GASを更新する

| 項目 | 内容 |
|---|---|
| 署名検証 | `x-nowpayments-sig` ヘッダーの HMAC-SHA512 検証 |
| テストモード | `x-test-ipn: 1` ヘッダーで署名チェック回避 |
| GAS action | `payment_update` |

**GASに送信するペイロード:**

```json
{
  "applyId": "string",
  "orderId": "string",
  "paymentStatus": "string",
  "isPaid": "boolean",
  "invoiceId": "string",
  "actuallyPaid": "number",
  "payAmount": "number",
  "payCurrency": "string",
  "priceAmount": "number",
  "priceCurrency": "string",
  "raw": "object",
  "isTest": "boolean"
}
```

---

### 管理者 (Basic Auth 必須)

#### `GET /api/admin/list`

**ファイル:** `app/api/admin/list/route.ts`

| 項目 | 内容 |
|---|---|
| GAS action | `admin_list` |
| 成功レスポンス | `{ ok: true, items: ApplyRow[] }` |

---

#### `POST /api/admin/approve`

**ファイル:** `app/api/admin/approve/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ rowIndex: number }` |
| GAS action | `admin_approve&rowIndex={rowIndex}` |
| 成功レスポンス | `{ ok: true, loginId, tempPassword }` または `{ ok: true, oneTimeCode }` |

---

#### `POST /api/admin/grant-bp`

**ファイル:** `app/api/admin/grant-bp/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ request_id: string, user_id: string, bp_amount: number }` |
| GAS action | `grant_bp_for_sell` |
| 用途 | 売却申請に対してBP付与 |

---

#### `GET /api/admin/sell-requests`

**ファイル:** `app/api/admin/sell-requests/route.ts`

| 項目 | 内容 |
|---|---|
| GAS action | `get_sell_requests` |
| 成功レスポンス | `{ ok: true, items: SellRequest[] }` |

---

#### `GET /api/admin/members`

**ファイル:** `app/api/admin/members/route.ts`

| 項目 | 内容 |
|---|---|
| クエリパラメータ | `page`, `pageSize`, `sortKey`, `sortOrder` |
| GAS action | `admin_get_members` |
| 成功レスポンス | `{ ok: true, members: MemberRow[], total, page, pageSize }` |

**MemberRow 型:**

```typescript
{
  login_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  created_at: string;
  bp_balance: number;
  ep_balance: number;
  login_streak: number;
  total_login_count: number;
  subscription_plan: string;
  last_login_at: string;
  music_boost_plan?: string | null;       // アクティブな Music Boost プランID
  music_boost_expires_at?: string | null; // Music Boost 有効期限
}
```

**ソートキー（`ALLOWED_SORT_KEYS`）:** `created_at` / `ep_balance` / `bp_balance` / `login_streak` / `total_login_count` / `last_login_at`

---

### Music Boost

#### `GET /api/music-boost/status`

**ファイル:** `app/api/music-boost/status/route.ts`

| 項目 | 内容 |
|---|---|
| クエリパラメータ | `userId: string` |
| GAS action | `music_boost_status` |
| 成功レスポンス | `{ ok: true, current_boost, total_slots, used_slots, available_slots, plans }` |

---

#### `POST /api/music-boost/subscribe`

**ファイル:** `app/api/music-boost/subscribe/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ userId, planId, paymentMethod?: "ep" }` |
| GAS action | `music_boost_subscribe` |
| 成功レスポンス | `{ ok: true, boost_id, plan_id, percent, price_usd, slots_used, started_at, expires_at, ep_cost? }` |
| エラー | `no_slots_available` / `insufficient_ep` / `ep_deduct_failed` |

**EP換算:** `paymentMethod="ep"` の場合、`price_usd × 100 EP` を差し引く。

---

#### `POST /api/music-boost/cancel`

**ファイル:** `app/api/music-boost/cancel/route.ts`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ userId: string }` |
| GAS action | `music_boost_cancel` |
| 成功レスポンス | `{ ok: true, canceled_at }` |

---

### マーケット

#### `POST /api/market/create`

**ファイル:** `app/api/market/create/route.ts`

| 項目 | 内容 |
|---|---|
| 認証 | `{ id, code }` (ユーザー認証) |
| リクエスト | `{ title, desc, item_type, asset_count, currency, price, delivery_mode, delivery_ref, stock_total }` |
| GAS action | `market_create` |

---

### 音楽生成

#### `POST /api/music/generate`

**ファイル:** `app/api/music/generate/route.ts`
**maxDuration:** 300秒

| 項目 | 内容 |
|---|---|
| リクエスト | `{ prompt: string, mode: "standard"\|"pro", bpm?: number, waveform?: string, vocal?: boolean }` |
| 成功レスポンス | `{ ok: true, predictionId: string, lyrics: string }` |

**処理フロー:**
1. 歌詞生成（OpenAI GPT-4o-mini、オプション）
2. プロンプト構築（`mode` により異なるフォーマット）
3. Replicate Minimax music-01 で3セクション並列生成
   - Verse / Chorus / Bridge
4. メモリキャッシュ保存（TTL 4時間）

**特記事項:**
- 日本語→英語キーワード変換マッピング（例: さわやか→refreshing）
- STANDARDモード: 女性ボーカル自動付加
- ヒューマナイズキーワード自動追加

---

#### `GET /api/music/status`

**ファイル:** `app/api/music/status/route.ts`
**maxDuration:** 300秒

| 項目 | 内容 |
|---|---|
| クエリパラメータ | `id: string`（predictionId） |
| 成功レスポンス | `{ ok: true, status, stage, progress, outputUrl, lyrics }` |

**マルチセクション進捗管理:**

| stage | 説明 | progress |
|---|---|---|
| `verse` | Verse生成中 | 0.0〜0.33 |
| `chorus` | Chorus生成中 | 0.33〜0.66 |
| `bridge` | Bridge生成中 | 0.66〜0.9 |
| `merging` | マージ中 | 0.9〜1.0 |
| `done` | 完成 | 1.0 |

**ポーリング:** フロント側 `MAX_TICKS = 150`（2秒×150 = 5分）

---

### 曲作成（新仕様）

#### `POST /api/song/start`

**ファイル:** `app/api/song/start/route.ts`
**maxDuration:** 300秒

| 項目 | 内容 |
|---|---|
| 認証 | `{ id, code }` (ユーザー認証) |
| リクエスト | `{ theme: string, genre: string, mood: string }` |
| 必要BP | 最低 10BP |
| 成功レスポンス | `{ ok: true, jobId, status: "lyrics_generating", bpLocked: 10 }` |

**処理フロー:**
1. ユーザー認証
2. BP残高確認（10BP以上必要）
3. JobID生成: `song_{YYYYMMDD}_{RANDOM}`
4. ジョブ作成（TTL 4時間）
5. 歌詞生成をバックグラウンドで非同期実行（fire-and-forget）

---

## 9. コンポーネント一覧

### `components/Field.tsx`

テキスト入力コンポーネント

**Props:**

```typescript
{
  label: string;
  required?: boolean;
  type?: string;          // デフォルト: "text"
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;          // 補足説明
  error?: string;         // エラーメッセージ（赤表示）
  maxLength?: number;
}
```

---

### `components/Select.tsx`

セレクトボックスコンポーネント

**Props:**

```typescript
{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}
```

---

### `components/StepHeader.tsx`

申請ステップ表示ヘッダー

**Props:**

```typescript
{
  step: number;       // 現在のステップ番号
  total?: number;     // 総ステップ数（デフォルト: 3）
  title: string;
  subtitle?: string;
}
```

**機能:** ステップ番号 + プログレスバー + タイトル表示

---

### `components/PlanPicker.tsx`

プラン選択グリッドUI

**Props:**

```typescript
{
  value?: Plan;                 // 選択中プランID
  onChange: (p: Plan) => void;
}
```

**レイアウト:** 2列グリッド（モバイル対応）、選択時ハイライト表示

---

### `components/WalletBadge.tsx`

BP/EP残高表示バッジ

- `login_id` を localStorage から取得
- `GET /api/wallet/balance` を呼び出し
- BP・EP残高を表示

---

### `components/BPGrantModal.tsx`

未受取BP受取モーダル

**Props:**

```typescript
{
  amount: number;       // 受取BP量
  onClose: () => void;
}
```

---

### `components/Toast.tsx` / `components/useToast.ts`

トースト通知システム

**`useToast()` hook:**

```typescript
const { items, remove } = useToast();
```

**`toast(message)` 関数:** CustomEvent を dispatch してトーストを表示

**仕様:**
- 固定位置: 画面上部中央
- z-index: 9999
- TTL: 2.2秒で自動消滅
- 背景: 黒/60%透明度 + blur

---

### `components/AIBot/AIBotProvider.tsx`

AIBotコンテキストプロバイダー

- `useAIBot()` フックを提供
- 全ページで利用可能

---

### `components/AIBot/AIBotWidget.tsx`

AIチャットウィジェット

- 全ページに表示（`app/layout.tsx` でインジェクション）

---

## 10. ライブラリ・ユーティリティ

### `app/lib/auth.ts`

**AuthState 型:**

```typescript
type AuthState = {
  status: "approved" | "pending";
  id: string;
  token?: string;
  plan?: string;
  updatedAt: number;
}
```

**提供関数:**

| 関数 | 説明 |
|---|---|
| `getAuth()` | localStorage `addval_auth_v1` から読み込み |
| `setAuth(next)` | localStorage に保存（`updatedAt` 自動追加） |
| `setAuthSecret(secret)` | sessionStorage `addval_auth_secret_v1` にパスワード保存 |
| `getAuthSecret()` | sessionStorage からパスワード取得 |
| `clearAuthSecret()` | sessionStorage のパスワードのみ削除 |
| `clearAuth()` | localStorage・sessionStorage 両方削除 |

---

### `components/storage.ts`

申請フォームのDraft管理

**Draft 型:**

```typescript
type Plan = "30" | "50" | "100" | "500" | "1000";

type Draft = {
  version?: number;
  plan?: Plan;
  email?: string;
  name?: string;
  nameKana?: string;
  discordId?: string;
  refName?: string;
  refId?: string;
  ageBand?: string;
  prefecture?: string;
  city?: string;
  job?: string;
  applyId?: string;
  updatedAt?: number;
}
```

**提供関数:**

| 関数 | 説明 |
|---|---|
| `loadDraft()` | sessionStorage からDraftを読み込み（バージョンチェックあり） |
| `saveDraft(next)` | 既存Draftにマージして保存（`updatedAt` 自動追加） |
| `clearDraft()` | Draftを削除 |
| `updateDraftField(field, value)` | 単一フィールドのみ更新 |
| `hasDraft()` | Draftが存在するか確認 |
| `getRawDraft()` | デバッグ用: 生データを返す |

---

### `app/api/music/_cache.ts`

音楽生成キャッシュ（メモリ上のインメモリキャッシュ）

**JobState 型:**

```typescript
type JobState = {
  verseId: string;
  chorusId: string;
  bridgeId: string;
  stage: "verse" | "chorus" | "bridge" | "merging" | "done" | "failed";
  lyrics: string;
  verseUrl?: string;
  chorusUrl?: string;
  bridgeUrl?: string;
  outputUrl?: string;
}
```

**提供関数:**

| 関数 | TTL | 説明 |
|---|---|---|
| `cacheLyrics(predictionId, lyrics)` | 2時間 | 歌詞をキャッシュ |
| `getCachedLyrics(predictionId)` | — | キャッシュから歌詞取得 |
| `cacheJob(jobId, job)` | 4時間 | ジョブ状態をキャッシュ |
| `getJob(jobId)` | — | ジョブ状態取得 |
| `updateJob(jobId, update)` | — | ジョブ状態を部分更新 |

---

### `app/api/song/_jobStore.ts`

曲作成ジョブストア（グローバル変数によるメモリ管理）

**SongJob 型:**

```typescript
type SongStatus =
  | "lyrics_generating"
  | "lyrics_done"
  | "structure_generating"
  | "structure_done"
  | "audio_generating"
  | "done"
  | "failed";

type SongJob = {
  jobId: string;
  userId: string;
  status: SongStatus;
  bpLocked: number;
  bpFinal: number | null;
  prompt: { theme: string; genre: string; mood: string };
  lyricsData?: {
    title: string;
    lyrics: string;
    editedByUser: boolean;
    version: number;
  };
  structureData?: {
    bpm: number;
    key: string;
    sections: object[];
    hookSummary: string;
    title: string;
  };
  audioUrl: string | null;
  downloadUrl: string | null;
  rightsLog: {
    lyricsApproved: boolean;
    structureApproved: boolean;
    humanEditedLyrics: boolean;
  };
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
```

**提供関数:**

| 関数 | 説明 |
|---|---|
| `createJob(params)` | 新規ジョブ作成（TTL 4時間） |
| `getJob(jobId)` | ジョブ取得 |
| `updateJob(jobId, update)` | ジョブ部分更新（`updatedAt` 自動更新） |
| `listUserJobs(userId)` | ユーザーの全ジョブ一覧 |

**実装詳細:** グローバル変数 `__jobMap__` を使用（Next.js ホットリロード対策）

---

## 11. 状態管理・ストレージ

### localStorage

| キー | 型 | 用途 | 永続性 |
|---|---|---|---|
| `addval_auth_v1` | AuthState | ログイン状態 | ブラウザ再起動後も保持 |
| `login_id` | string | WalletBadge用ユーザーID | ブラウザ再起動後も保持 |
| `TUTORIAL_KEY` | boolean | マーケットチュートリアル表示済み | ブラウザ再起動後も保持 |

### sessionStorage

| キー | 型 | 用途 | 永続性 |
|---|---|---|---|
| `addval_auth_secret_v1` | string | ログインパスワード | ブラウザ終了時に消滅 |
| `addval_apply_draft_v1` | Draft | 申請フォームの入力途中データ | ブラウザ終了時に消滅 |

### メモリキャッシュ（サーバーサイド）

| キャッシュ | TTL | 用途 |
|---|---|---|
| 歌詞キャッシュ | 2時間 | 音楽生成の歌詞 |
| 音楽ジョブ | 4時間 | Replicate 予測ジョブ状態 |
| 曲作成ジョブ | 4時間 | 曲作成全体のジョブ状態 |

---

## 12. 認証フロー

### ユーザー認証（クライアントサイド）

```
[ログインページ]
   │
   ├─ POST /api/auth/login { id, code }
   │      │
   │      └─ GAS action=login → HMAC-SHA256検証
   │
   ├─ 成功 → localStorage addval_auth_v1 に保存
   │          sessionStorage addval_auth_secret_v1 に保存
   │          → /top へリダイレクト
   │
   └─ 失敗 → { reason: "pending" } → /pending へリダイレクト
```

**パスワード照合:** GAS側で `HMAC-SHA256(SECRET_KEY, loginId + ":" + password)` のハッシュと比較

**初回パスワード:** リセットトークン（UUID+ランダム16文字、72時間有効・1回限り）をメール送信

---

### 管理者認証（サーバーサイド）

```
リクエスト → middleware.ts
   │
   ├─ パス /admin/* または /api/admin/* ?
   │
   ├─ YES → Authorization ヘッダー確認
   │         Base64デコード → user:pass 検証
   │         ADMIN_USER / ADMIN_PASS と比較
   │
   ├─ 一致 → 通過
   └─ 不一致 → 401 Unauthorized
```

---

## 13. ユーザー申請フロー

```
[Step 0] ホーム (/)
   └─ "権利購入" ボタン

[Step 1] プラン選択 (/purchase)
   ├─ プランを選択
   ├─ applyId 生成: lifai_{Date.now()}
   ├─ POST /api/apply/create → GAS: apply_create（仮申請行作成）
   ├─ POST /api/nowpayments/create → インボイスURL取得
   └─ NOWPayments ポータルへリダイレクト（USDT支払い）

[支払い] NOWPayments
   └─ 支払い完了 → POST /api/nowpayments/ipn（Webhook）
                      └─ GAS: payment_update
                               └─ 条件満たせば自動承認
                                  (expected_paid の -2% まで許容)

[Step 2] 申請フォーム (/apply)
   ├─ 個人情報入力（email, name, nameKana, discordId, etc.）
   └─ sessionStorage に自動保存

[Step 3] 確認・送信 (/confirm)
   ├─ 入力内容確認
   ├─ GET /api/apply/status → 支払い状況確認
   ├─ POST /api/apply → GAS: apply（フォームデータ保存）
   └─ /pending へリダイレクト

[審査] 管理者 (/admin)
   ├─ GET /api/admin/list → 申請一覧確認
   └─ POST /api/admin/approve → GAS: admin_approve
                                  └─ ログイン情報生成
                                  └─ リセットメール送信

[ログイン] (/login)
   ├─ メール受信 → パスワード設定 (/reset?token=...)
   └─ ログイン → /top
```

---

## 14. 決済フロー（NOWPayments）

```
フロント → POST /api/nowpayments/create
              │
              └─ NOWPayments API: POST /v1/invoice
                    │
                    └─ { invoice_url }
                         │
                         └─ フロント → invoice_url へリダイレクト

NOWPayments → 支払い完了 → POST /api/nowpayments/ipn
                                │
                                ├─ HMAC-SHA512 署名検証
                                │   (x-nowpayments-sig ヘッダー)
                                │
                                └─ GAS: payment_update
                                         │
                                         └─ 自動承認判定
                                            (TOLERANCE_PCT = 2%)
```

**テスト方法:**
```bash
curl -X POST /api/nowpayments/ipn \
  -H "x-test-ipn: 1" \
  -H "Content-Type: application/json" \
  -d '{ ...IPNデータ... }'
```

---

## 15. 音楽・曲生成フロー

### 音楽生成フロー（旧: `/api/music/generate`）

```
POST /api/music/generate { prompt, mode, bpm, waveform, vocal }
   │
   ├─ [オプション] OpenAI GPT-4o-mini で歌詞生成
   ├─ プロンプト構築（日本語→英語変換）
   ├─ Replicate minimax/music-01 で3セクション並列生成
   │   ├─ Verse  予測開始
   │   ├─ Chorus 予測開始
   │   └─ Bridge 予測開始
   │
   └─ { ok: true, predictionId: "music_{timestamp}", lyrics }

GET /api/music/status?id={predictionId}  (ポーリング)
   │
   ├─ stage: verse   → Verse  完了待ち
   ├─ stage: chorus  → Chorus 完了待ち
   ├─ stage: bridge  → Bridge 完了待ち
   ├─ stage: merging → MERGE_SERVER_URL に POST してマージ
   └─ stage: done    → { outputUrl, lyrics, progress: 1.0 }
```

### 曲作成フロー（新: `/api/song/start`）

```
POST /api/song/start { id, code, theme, genre, mood }
   │
   ├─ ユーザー認証
   ├─ BP残高確認 (>=10BP 必要)
   ├─ JobID生成: song_{YYYYMMDD}_{RANDOM}
   ├─ Job作成 (status: "lyrics_generating", bpLocked: 10)
   └─ バックグラウンド: OpenAI 歌詞生成（fire-and-forget）

→ { ok: true, jobId, status: "lyrics_generating", bpLocked: 10 }
```

---

## 16. GAS バックエンド連携

### GAS WebApp への共通リクエスト形式

```
GET/POST {GAS_WEBAPP_URL}?key={GAS_API_KEY}&action={action}&...params
```

### GAS Action 一覧

| action | HTTP | 呼び元 | 内容 |
|---|---|---|---|
| `apply_create` | POST | `/api/apply/create` | 購入時に申請行を仮作成 |
| `payment_update` | POST | `/api/nowpayments/ipn` | IPN受信→支払い更新→自動承認 |
| `apply` | POST | `/api/apply/create` | フォーム送信時に行を更新 |
| `admin_list` | GET | `/api/admin/list` | 全申請一覧を返す |
| `admin_approve` | POST | `/api/admin/approve` | 手動承認→リセットメール送信 |
| `login` | POST | `/api/auth/login` | HMAC-SHA256でパスワード照合 |
| `me` | POST | `/api/me` | ログイン済みユーザーの紹介情報 |
| `get_balance` | GET | `/api/wallet/balance` | BP/EP残高を返す |
| `reset_password` | POST | `/api/auth/reset` | トークン検証→パスワードハッシュ保存 |
| `reset_resend` | — | 管理者直呼び | リセットメール再送 |
| `ref_tree_build` | — | 管理者メニュー | 紹介ツリーシートを再生成 |
| `market_create` | POST | `/api/market/create` | 商品出品 |
| `get_sell_requests` | GET | `/api/admin/sell-requests` | 売却申請一覧 |
| `grant_bp_for_sell` | POST | `/api/admin/grant-bp` | 売却申請へBP付与 |
| `pending_bp` | GET | `/api/user/pending-bp` | 未受取BP確認 |
| `claim_bp` | POST | `/api/user/claim-bp` | BP受取確定 |
| `admin_get_members` | POST | `/api/admin/members` | 承認済み会員一覧（ページング・ソート・Music Boost結合） |
| `music_boost_status` | GET | `/api/music-boost/status` | ユーザーの現在ブースト状況 |
| `music_boost_subscribe` | POST | `/api/music-boost/subscribe` | Music Boost 新規契約・プラン変更（EP差引） |
| `music_boost_cancel` | POST | `/api/music-boost/cancel` | Music Boost 解約 |
| `music_boost_admin_list` | — | 管理者直呼び | 全ブースト一覧 |

### GAS 自動実行

| 関数名 | トリガー | 内容 |
|---|---|---|
| `musicBoostAutoRenew_` | 毎日深夜0時（時間ベース） | 期限切れ Music Boost を自動更新。EP不足時は `expired` に変更 + メール通知 |

### GAS Sheets 構造

| シート名 | 用途 |
|---|---|
| `applies` | メインデータ（全ユーザー・申請・支払い情報） |
| `ref_tree` | 紹介ツリー表示用（`ref_tree_build` で全消し→再生成） |
| `ref_events` | 紹介紐づけの監査ログ |
| `wallet_ledger` | 紹介配当などの金融取引履歴 |
| `music_boost` | Music Boost 契約履歴（id, user_id, plan_id, percent, price_usd, slots_used, status, started_at, expires_at, canceled_at, updated_at） |

**`music_boost.status` の値:** `active` / `canceled` / `expired`（EP不足自動更新失敗 or 期限到来）

### GAS 既知の仕様・注意事項

| 項目 | 内容 |
|---|---|
| プラン金額のハードコード | `planToGrant_()` 内で `34/57/114/567/1134` (USDT) とBP付与量が対応。Next.js側のPLANS配列と手動で一致させる必要あり |
| リセットメールURLのハードコード | `sendResetMail_()` の送信URLが `https://lifai.vercel.app/reset?token=...` に固定 |
| `login` actionのステータス | `approved` 以外は全て `{ reason: "pending" }` を返す（`pending_payment` / `pending_error` / `paid` も区別なし） |
| 自動承認の許容誤差 | `payment_update` での自動承認は `expected_paid` の -2% まで許容（`TOLERANCE_PCT = 2`） |
| 重複関数 | `getValuesSafe_()` と `getSheetValuesSafe_()` が同一処理で2つ存在（`getValuesSafe_()` を使うこと） |

---

## 17. マーケットプレイス

### API エンドポイント

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/market/list` | GET | 商品一覧（ページング・フィルタ対応） |
| `/api/market/create` | POST | 商品出品（要認証） |
| `/api/market/orders` | GET | 購入履歴（要認証） |

### 商品一覧クエリパラメータ

```
GET /api/market/list?page=1&limit=50&item_type=...&currency=...&q=...
```

| パラメータ | 説明 |
|---|---|
| `page` | ページ番号（デフォルト: 1） |
| `limit` | 1ページの件数（デフォルト: 50, UI: 12） |
| `item_type` | 商品タイプフィルター |
| `currency` | 通貨フィルター |
| `q` | 検索キーワード（500ms debounce） |

---

## 18. 管理者機能

**アクセス:** Basic Auth (`ADMIN_USER` / `ADMIN_PASS`)

### 申請管理

1. `GET /api/admin/list` で申請一覧取得
2. 各申請の詳細確認（支払い状況・フォーム内容）
3. `POST /api/admin/approve { rowIndex }` で承認
4. GASがログイン情報を生成し、リセットメールを送信

### BP管理

1. `GET /api/admin/sell-requests` で売却申請一覧取得
2. `POST /api/admin/grant-bp { request_id, user_id, bp_amount }` でBP付与

### 会員一覧

1. `GET /api/admin/members?page=0&pageSize=20&sortKey=created_at&sortOrder=desc` で取得
2. 1ページ20件・サーバーサイドソート対応
3. ソート可能列: BP残高 / EP残高 / 連続ログイン / 累計ログイン / 最終ログイン
4. Music Boost 列: 契約中プランIDと有効期限を表示（`music_boost` シートとJOIN）

### Music Boost 管理

- `music_boost_admin_list` GAS action で全ブースト一覧を確認可能
- 自動更新は毎日深夜0時の GAS トリガーで実行（`musicBoostAutoRenew_`）

---

## 19. セキュリティ設計

### パスワード管理

- **保存:** `HMAC-SHA256(SECRET_KEY, loginId + ":" + password)` のハッシュ
- **SECRET_KEY:** GAS ScriptProperties で管理（デフォルト: `"LIFAITOMAKEMONEY"`）
- **クライアント保存:** パスワードは `sessionStorage` のみ（ブラウザ終了時消滅）

### 署名検証

| 検証対象 | アルゴリズム | ヘッダー |
|---|---|---|
| NOWPayments IPN | HMAC-SHA512 | `x-nowpayments-sig` |

### 認証ガード

| 対象パス | 認証方式 |
|---|---|
| `/admin/*` | HTTP Basic Auth (middleware) |
| `/api/admin/*` | HTTP Basic Auth (middleware) |
| `/api/market/create` | ユーザー認証（id + code） |
| `/api/song/start` | ユーザー認証（id + code） |

### テスト・デバッグ用

| エンドポイント | 用途 |
|---|---|
| `GET /api/debug/env` | 環境変数の確認 |
| `POST /api/nowpayments/ipn` + `x-test-ipn: 1` | IPN署名チェック回避 |

---

## 20. データフロー図

```
┌─────────────────────────────────────────────────────────┐
│                       ユーザー                           │
└─────────────────────────────────────────────────────────┘
         │                              │
    ブラウザ操作                    決済ポータル
         │                              │
┌────────▼────────────────────────────────────────────────┐
│                   Next.js (Vercel)                      │
│                                                         │
│  Pages                    API Routes                    │
│  ├── /                    ├── /api/auth/login           │
│  ├── /purchase            ├── /api/auth/reset           │
│  ├── /apply               ├── /api/apply/create         │
│  ├── /confirm             ├── /api/apply/status         │
│  ├── /login               ├── /api/me                   │
│  ├── /top                 ├── /api/nowpayments/create   │
│  ├── /admin               ├── /api/nowpayments/ipn ←── NOWPayments IPN
│  └── /market              ├── /api/admin/*              │
│                           ├── /api/market/*             │
│                           ├── /api/music/*              │
│                           └── /api/song/*               │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────┼────────────────┐
         │            │                │
   ┌─────▼─────┐ ┌────▼─────┐ ┌───────▼───────┐
   │    GAS    │ │NOWPayments│ │  Replicate /  │
   │ (Sheets)  │ │   API     │ │   OpenAI      │
   └───────────┘ └──────────┘ └───────────────┘
```

---

*この仕様書は `C:\Users\unitu\aisalon` プロジェクトの全ファイルを解析して自動生成されました。*
