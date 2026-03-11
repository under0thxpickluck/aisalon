# LIFAI アーキテクチャ設計書

> 作成日: 2026-03-08

---

## 目次

1. [システム全体図](#1-システム全体図)
2. [技術スタック](#2-技術スタック)
3. [レイヤー構成](#3-レイヤー構成)
4. [フロントエンド設計](#4-フロントエンド設計)
5. [バックエンド設計（GAS）](#5-バックエンド設計gas)
6. [データストア設計](#6-データストア設計)
7. [認証アーキテクチャ](#7-認証アーキテクチャ)
8. [決済アーキテクチャ](#8-決済アーキテクチャ)
9. [音楽・曲生成アーキテクチャ](#9-音楽曲生成アーキテクチャ)
10. [AIBot アーキテクチャ](#10-aibot-アーキテクチャ)
11. [状態管理設計](#11-状態管理設計)
12. [セキュリティアーキテクチャ](#12-セキュリティアーキテクチャ)
13. [パフォーマンス設計](#13-パフォーマンス設計)
14. [デプロイ構成](#14-デプロイ構成)
15. [既知の技術的負債](#15-既知の技術的負債)

---

## 1. システム全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                          ユーザー (ブラウザ)                     │
│                    Next.js SSR/CSR (Vercel)                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
┌──────▼──────┐      ┌─────────▼────────┐    ┌────────▼────────┐
│  GAS WebApp  │      │   NOWPayments    │    │   Replicate /   │
│ (Sheets DB) │      │  (USDT 決済)     │    │   OpenAI API    │
└─────────────┘      └──────────────────┘    └─────────────────┘
  Google Sheets         暗号通貨ゲートウェイ     AI生成モデル
  - applies             IPN Webhook              - musicgen
  - ref_tree            署名: HMAC-SHA512        - GPT-4o-mini
  - ref_events
  - wallet_ledger

              ┌──────────────────────────┐
              │   MERGE_SERVER_URL       │
              │  (音声マージ 自前鯖)      │
              └──────────────────────────┘
```

---

## 2. 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| Next.js | 14.2.5 | フレームワーク（App Router） |
| React | 18.3.1 | UIライブラリ |
| TypeScript | — | 型安全（strict: false） |
| Tailwind CSS | 3.4.10 | スタイリング |
| next-pwa | 5.6.0 | PWA対応（Service Worker） |
| sonner | 2.0.7 | トースト通知 |

### バックエンド

| 技術 | 用途 |
|---|---|
| Next.js API Routes | サーバーレスAPIプロキシ |
| Google Apps Script | ビジネスロジック + DB |
| Google Sheets | データストア |

### 外部サービス

| サービス | 用途 |
|---|---|
| NOWPayments | USDT/TRC20 決済 |
| Replicate (Minimax music-01) | 音楽生成 |
| OpenAI GPT-4o-mini | 歌詞・構成生成 |
| Vercel | ホスティング・CDN |
| Gmail (GAS経由) | パスワードリセットメール |

---

## 3. レイヤー構成

```
┌─────────────────────────────────┐
│         プレゼンテーション層     │  app/*/page.tsx
│  (ページ / React コンポーネント) │  components/
├─────────────────────────────────┤
│           API プロキシ層         │  app/api/*/route.ts
│    (Next.js Route Handlers)     │  middleware.ts
├─────────────────────────────────┤
│         ビジネスロジック層       │  GAS (Code.gs)
│    (GAS WebApp / Google Sheets) │  planToGrant_()
├─────────────────────────────────┤
│           データ層               │  Google Sheets
│         (永続ストレージ)         │  applies / ref_tree
│                                 │  ref_events / wallet_ledger
└─────────────────────────────────┘
```

**設計方針:** Next.js は「薄いプロキシ」に徹し、ビジネスロジックは GAS 側に集約。Next.js 側にビジネスロジックを置かない。

---

## 4. フロントエンド設計

### ルーティング（App Router）

```
app/
├── page.tsx              → /              (ホーム・LP)
├── purchase/page.tsx     → /purchase      (プラン選択)
├── apply/page.tsx        → /apply         (申請フォーム)
├── confirm/page.tsx      → /confirm       (確認送信)
├── pending/page.tsx      → /pending       (審査待ち)
├── reset/page.tsx        → /reset         (PW リセット)
├── login/page.tsx        → /login         (ログイン)
├── top/page.tsx          → /top           (ダッシュボード)
├── admin/page.tsx        → /admin         (管理画面)
├── market/page.tsx       → /market        (マーケット)
├── music/page.tsx        → /music         (音楽生成・旧)
├── music2/page.tsx       → /music2        (音楽生成・新)
└── 5000/page.tsx         → /5000          (特定プランLP)
```

### コンポーネント設計

```
components/
├── 【UI 基礎】
│   ├── Field.tsx          テキスト入力（label/error/hint）
│   ├── Select.tsx         セレクトボックス
│   ├── StepHeader.tsx     ステップ進捗ヘッダー
│   └── PlanPicker.tsx     プラン選択グリッド
│
├── 【ドメイン固有】
│   ├── WalletBadge.tsx    BP/EP 残高表示
│   └── BPGrantModal.tsx   未受取BP受取モーダル
│
├── 【通知】
│   ├── Toast.tsx          トースト UI (ToastHost)
│   └── useToast.ts        トースト Hook
│
├── 【状態管理】
│   └── storage.ts         sessionStorage Draft 管理
│
└── 【AIBot】
    ├── AIBotProvider.tsx  コンテキスト + ルールエンジン
    └── AIBotWidget.tsx    チャット UI ウィジェット
```

### ページ間データフロー

```
/purchase (プラン選択)
  → sessionStorage: addval_apply_draft_v1 { plan, applyId }

/apply (申請フォーム)
  → sessionStorage: addval_apply_draft_v1 { email, name, ... }

/confirm (確認)
  → sessionStorage から読み込み
  → POST /api/apply → クリア

/login (ログイン)
  → localStorage: addval_auth_v1 { status, id, token, plan }
  → sessionStorage: addval_auth_secret_v1 (パスワード)

/top (ダッシュボード)
  → localStorage: addval_auth_v1 から認証情報読み込み
  → sessionStorage: addval_auth_secret_v1 からパスワード読み込み
  → /api/me, /api/wallet/balance 呼び出し
```

---

## 5. バックエンド設計（GAS）

### GAS WebApp エンドポイント

全リクエストは以下の形式で GAS に送信される：

```
GET  {GAS_WEBAPP_URL}?key={GAS_API_KEY}&action={action}&...
POST {GAS_WEBAPP_URL}?key={GAS_API_KEY}&action={action}
     Body: JSON
```

### GAS 関数マッピング

```
doGet(e)  → action 振り分け（GET系）
doPost(e) → action 振り分け（POST系）
  │
  ├── apply_create    → applyCreate_()
  ├── payment_update  → paymentUpdate_()
  ├── apply           → applyUpdate_()
  ├── admin_list      → adminList_()
  ├── admin_approve   → adminApprove_()
  ├── login           → login_()
  ├── me              → me_()
  ├── get_balance     → getBalance_()
  ├── reset_password  → resetPassword_()
  ├── ref_tree_build  → refTreeBuild_()
  ├── market_create   → marketCreate_()
  ├── get_sell_requests → getSellRequests_()
  ├── grant_bp_for_sell → grantBpForSell_()
  ├── get_pending_bp  → getPendingBp_()
  └── claim_bp        → claimBp_()
```

### プラン金額ハードコード

```javascript
// GAS planToGrant_() 内
const PLAN_MAP = {
  34:    { bp: 300,   plan: "30"   },
  57:    { bp: 600,   plan: "50"   },
  114:   { bp: 1200,  plan: "100"  },
  567:   { bp: 6000,  plan: "500"  },
  1134:  { bp: 12000, plan: "1000" },
};
```

⚠️ Next.js 側の PLANS 配列と手動で一致させる必要がある（二重管理）

---

## 6. データストア設計

### Google Sheets スキーマ

#### `applies` シート（メインDB）

| 列 | フィールド | 型 | 説明 |
|---|---|---|---|
| A | apply_id | string | `lifai_{timestamp}` |
| B | status | enum | `pending_payment` / `paid` / `approved` |
| C | plan | string | `30` / `50` / `100` / `500` / `1000` |
| D | email | string | 申請者メール |
| E | name | string | 氏名 |
| F | name_kana | string | 氏名カナ |
| G | discord_id | string | Discord ID |
| H | age_band | string | 年代 |
| I | prefecture | string | 都道府県 |
| J | city | string | 市区町村 |
| K | job | string | 職業 |
| L | ref_name | string | 紹介者名 |
| M | ref_id | string | 紹介者 ID |
| N | login_id | string | 生成されたログイン ID |
| O | password_hash | string | HMAC-SHA256 ハッシュ |
| P | reset_token | string | UUID + ランダム16文字 |
| Q | reset_token_expires | datetime | 72時間後 |
| R | bp | number | BP残高 |
| S | ep | number | EP残高 |
| T | my_ref_code | string | `R-{apply_id}` |
| U | referrer_login_id | string | 紹介者のログイン ID |
| V | ref_path | string | 紹介チェーン |
| W | invoice_id | string | NOWPayments インボイス ID |
| X | expected_paid | number | 期待支払額 (USDT) |
| Y | actually_paid | number | 実際の支払額 |
| Z | pay_currency | string | 支払い通貨 |
| AA | ipn_raw | JSON | IPN生データ |
| AB | created_at | datetime | 申請日時 |
| AC | approved_at | datetime | 承認日時 |

#### `ref_tree` シート（紹介ツリー）

`ref_tree_build` アクションで全消し → 再生成される表示用シート。

#### `ref_events` シート（監査ログ）

| 列 | フィールド | 説明 |
|---|---|---|
| A | event_at | イベント日時 |
| B | type | `referral_linked` 等 |
| C | subject_id | 対象ユーザー ID |
| D | referrer_id | 紹介者 ID |
| E | detail | 詳細 JSON |

#### `wallet_ledger` シート（取引履歴）

| 列 | フィールド | 説明 |
|---|---|---|
| A | tx_at | 取引日時 |
| B | user_id | ユーザー ID |
| C | type | `plan_purchase` / `referral_bonus` / `music_use` 等 |
| D | amount | 増減量（正: 増加 / 負: 減少） |
| E | currency | `BP` / `EP` |
| F | balance_after | 取引後残高 |
| G | note | 備考 |

---

## 7. 認証アーキテクチャ

### 二層認証設計

```
┌─────────────────────────────────────────────────────────┐
│   Layer 1: ユーザー認証（クライアントサイド）             │
│                                                         │
│   localStorage: addval_auth_v1                          │
│   { status, id, token, plan, updatedAt }               │
│                                                         │
│   sessionStorage: addval_auth_secret_v1                 │
│   password (ブラウザ終了時消滅)                          │
│                                                         │
│   API呼び出し時: { id, code } をリクエストボディに含む   │
│   → GAS 側でその都度検証                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│   Layer 2: 管理者認証（サーバーサイド）                  │
│                                                         │
│   middleware.ts: Basic Auth                             │
│   対象: /admin/*, /api/admin/*                          │
│   検証: Authorization ヘッダー (Base64)                  │
│   環境変数: ADMIN_USER / ADMIN_PASS                     │
└─────────────────────────────────────────────────────────┘
```

### パスワードハッシュ方式

```
保存形式: HMAC-SHA256(SECRET_KEY, loginId + ":" + password)

SECRET_KEY: GAS ScriptProperties "SECRET_KEY"
デフォルト: "LIFAITOMAKEMONEY" ← ⚠️ セキュリティリスク
```

### リセットトークンフロー

```
管理者承認
  → GAS: UUID + ランダム16文字 = トークン生成
  → 有効期限: 72時間
  → 利用回数: 1回限り
  → メール送信: https://lifai.vercel.app/reset?token=...
    （URL ハードコード ⚠️）

ユーザー: /reset?token=xxx
  → POST /api/auth/reset { token, password }
  → GAS: トークン検証 → 新パスワードハッシュ保存 → トークン無効化
```

---

## 8. 決済アーキテクチャ

### NOWPayments 連携フロー

```
フロント                 Next.js API            NOWPayments
  │                          │                      │
  ├─ POST /api/nowpayments/create                   │
  │   { amount, plan, applyId }                     │
  │                          │                      │
  │                          ├─ POST /v1/invoice ──→│
  │                          │   {                  │
  │                          │    price_amount,      │
  │                          │    price_currency:"usd"│
  │                          │    pay_currency:      │
  │                          │     "usdttrc20",      │
  │                          │    order_id:          │
  │                          │     "lifai_{applyId}",│
  │                          │    ipn_callback_url,  │
  │                          │    success_url,       │
  │                          │    cancel_url         │
  │                          │   }                  │
  │                          │←─ { invoice_url } ───│
  │←── { ok, invoice_url } ──│                      │
  │                          │                      │
  ├─ [外部リダイレクト] invoice_url ──────────────→ │
  │                          │                      │
  │         NOWPayments      │         ユーザー決済  │
  │                          │                      │
  │                          │←── POST /api/nowpayments/ipn
  │                          │    x-nowpayments-sig: HMAC-SHA512
  │                          │                      │
  │                          ├─ 署名検証             │
  │                          ├─ GAS: payment_update  │
  │                          │   → 自動承認判定      │
  │                          │     (TOLERANCE -2%)   │
  │                          │                      │
  │                          └─ 200 OK ─────────────→
```

### 自動承認ロジック（GAS側）

```javascript
// TOLERANCE_PCT = 2
// actually_paid >= expected_paid * (1 - 0.02)
if (actuallyPaid >= expectedPaid * 0.98) {
  autoApprove(); // ログイン情報生成 + メール送信
}
```

---

## 9. 音楽・曲生成アーキテクチャ

### 旧音楽生成（/music → `/api/music/*`）

```
POST /api/music/generate
  │
  ├─ [任意] OpenAI GPT-4o-mini 歌詞生成
  ├─ プロンプト構築（日本語→英語変換マッピング）
  ├─ Replicate minimax/music-01:
  │   ├─ Verse 予測 ID 取得
  │   ├─ Chorus 予測 ID 取得
  │   └─ Bridge 予測 ID 取得
  └─ { predictionId: "music_{ts}", lyrics }
       │
       │ _cache.ts (TTL: 4h)
       │ { verseId, chorusId, bridgeId, stage: "verse" }

GET /api/music/status?id=... (ポーリング: 2秒間隔, MAX 150回)
  │
  ├─ stage: verse   → verseId ポーリング → 完了時 stage=chorus
  ├─ stage: chorus  → chorusId ポーリング → 完了時 stage=bridge
  ├─ stage: bridge  → bridgeId ポーリング → 完了時 stage=merging
  ├─ stage: merging → MERGE_SERVER_URL に POST → 完了時 stage=done
  └─ stage: done    → { outputUrl, progress: 1.0 }
```

### 新曲生成（/music2 → `/api/song/*`）

```
POST /api/song/start { id, code, theme, genre, mood }
  │
  ├─ BP残高確認（>= 10BP）
  ├─ jobId = song_{YYYYMMDD}_{random}
  ├─ _jobStore に保存 { status: "lyrics_generating", bpLocked: 10 }
  └─ background: GPT-4o-mini で歌詞生成

GET /api/song/status?jobId=... (ポーリング: 3秒, MAX 200回)

GET /api/song/lyrics?jobId=...
  → { title, lyrics, version }

POST /api/song/approve-lyrics { jobId, editedLyrics }
  → status: "structure_generating"
  → background: 構成生成

GET /api/song/structure?jobId=...
  → { bpm, key, sections, hookSummary }

POST /api/song/approve-structure { jobId }
  → status: "audio_generating"
  → background: Replicate audio生成

GET /api/song/result?jobId=...
  → { audioUrl, downloadUrl }

POST /api/song/cancel { jobId }
  → BP返却（部分or全額）
```

### キャッシュ設計

```typescript
// _cache.ts - メモリキャッシュ (TTL別)
Map<predictionId, { lyrics, expiresAt }>  // TTL: 2時間
Map<jobId, { JobState, expiresAt }>       // TTL: 4時間

// _jobStore.ts - グローバルジョブ管理
global.__jobMap__ = Map<jobId, SongJob>   // TTL: 4時間
// ホットリロード対策でグローバル変数に保存
```

---

## 10. AIBot アーキテクチャ

### コンポーネント構成

```
AIBotProvider (Context)
  ├─ ルールエンジン
  │   ├─ rules.ts (ルール定義)
  │   ├─ CustomEvent 監視
  │   ├─ setTimeout 遅延実行
  │   └─ localStorage 既読管理
  │
  └─ AIBotWidget (UI)
      ├─ チャットバブル（8秒で自動非表示）
      ├─ モーダルチャット
      └─ CTA ボタン
```

### ルール定義

```typescript
type Rule = {
  trigger: "page_view" | "error_event";
  path?: string;           // 対象パス
  eventKey?: string;       // イベントキー
  delay_ms: number;        // 遅延時間
  message: string;         // 表示メッセージ
  cta?: { label, href };   // CTA ボタン
  condition?: () => boolean; // 追加条件
}
```

**定義済みルール（5件）:**

| # | トリガー | 条件 | 遅延 | メッセージ概要 |
|---|---|---|---|---|
| 1 | page_view | /market | 3秒 | 商品一覧への誘導 |
| 2 | page_view | /market 出品ページ | 2秒 | ルール説明 |
| 3 | error_event | 残高不足 | 即時 | ウォレット確認促進 |
| 4 | page_view | /top | 5秒 | 人気機能案内 |
| 5 | page_view | /top + BP >= 1000 | 10秒 | マーケット利用促進 |

---

## 11. 状態管理設計

### クライアント状態の全体像

```
┌─────────────────────────────────────────────────────────────┐
│                    クライアント状態                          │
│                                                             │
│  localStorage (永続)                                        │
│  ├─ addval_auth_v1: AuthState    ← ログイン状態             │
│  ├─ login_id: string             ← WalletBadge用            │
│  └─ TUTORIAL_KEY: boolean        ← マーケットチュートリアル  │
│                                                             │
│  sessionStorage (セッション限定)                             │
│  ├─ addval_auth_secret_v1: string ← パスワード(セッション限定)│
│  └─ addval_apply_draft_v1: Draft  ← 申請フォーム途中データ  │
│                                                             │
│  React State (揮発性)                                       │
│  └─ 各コンポーネントの入力値・ローディング状態等             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   サーバー状態 (メモリ)                      │
│                                                             │
│  global.__jobMap__ (SongJob Map)     TTL: 4h               │
│  global._lyricsCache (lyrics Map)    TTL: 2h               │
│  global._jobCache (MusicJob Map)     TTL: 4h               │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. セキュリティアーキテクチャ

### 脅威モデル

```
外部脅威:
  ├─ 不正決済 (IPN偽造)       → HMAC-SHA512 署名検証
  ├─ 管理者API不正アクセス    → Basic Auth (middleware)
  ├─ ユーザー偽装             → id + code セット認証
  └─ セッション固定            → sessionStorage でパスワード管理

内部リスク:
  ├─ SECRET_KEY デフォルト値  ← ⚠️ 未対応 (要設定)
  ├─ リセットURL ハードコード  ← ⚠️ 未対応
  ├─ レート制限なし            ← ⚠️ 未対応
  └─ CSRF 対策なし             ← ⚠️ 未対応
```

### 署名検証マップ

| エンドポイント | アルゴリズム | 検証ヘッダー/パラメータ |
|---|---|---|
| `/api/nowpayments/ipn` | HMAC-SHA512 | `x-nowpayments-sig` |
| GAS リクエスト | APIキー照合 | `?key={GAS_API_KEY}` |
| 管理者API | Basic Auth | `Authorization: Basic` |
| ユーザーAPI | id+code | リクエストボディ |

### テスト用セキュリティバイパス

```
POST /api/nowpayments/ipn
Header: x-test-ipn: 1
→ HMAC 署名チェックをスキップ（⚠️ 本番環境でも有効）
```

---

## 13. パフォーマンス設計

### Vercel タイムアウト設定

| エンドポイント | maxDuration |
|---|---|
| `app/api/music/**` | 300秒 |
| `app/api/song/**` | 300秒 |
| その他 | デフォルト (10秒) |

### ポーリング設計

| 機能 | 間隔 | 最大回数 | タイムアウト |
|---|---|---|---|
| 音楽生成 (旧) | 2秒 | 150回 | 5分 |
| 曲生成 (新) | 3秒 | 200回 | 10分 |

### キャッシュ戦略

| 対象 | 場所 | TTL |
|---|---|---|
| 歌詞 | サーバーメモリ | 2時間 |
| 音楽ジョブ | サーバーメモリ | 4時間 |
| 曲ジョブ | サーバーメモリ (global) | 4時間 |
| 申請ドラフト | sessionStorage | セッション |
| 認証状態 | localStorage | 永続 |

### クライアント最適化

- 検索 debounce: 500ms（マーケット）
- `useMemo`: 計算コストの高い処理を最適化
- `next/image`: 画像自動最適化
- PWA: Service Worker でアセットキャッシュ

---

## 14. デプロイ構成

```
┌─────────────────────────────────────────────┐
│              Vercel (Production)             │
│                                             │
│  Domain: https://lifai.vercel.app           │
│                                             │
│  Functions:                                 │
│  ├─ app/api/music/** (maxDuration: 300s)    │
│  ├─ app/api/song/**  (maxDuration: 300s)    │
│  └─ その他 API (デフォルト: 10s)            │
│                                             │
│  Static Assets: CDN キャッシュ              │
│  PWA: Service Worker                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           Google Apps Script               │
│                                             │
│  Deploy: Web App (Execute as: Me)           │
│  Access: Anyone (API key 認証)              │
│  ScriptProperties:                          │
│  ├─ SECRET_KEY (パスワードハッシュキー)      │
│  └─ その他設定値                            │
└─────────────────────────────────────────────┘
```

### 環境変数フロー

```
.env.local (開発)     Vercel Environment Variables (本番)
     │                              │
     └──────────── Next.js ─────────┘
                       │
             process.env.GAS_WEBAPP_URL
             process.env.NOWPAYMENTS_API_KEY
             ...
```

---

## 15. 既知の技術的負債

### クリティカル

| 項目 | 内容 | 対処 |
|---|---|---|
| SECRET_KEY デフォルト | GAS の `"LIFAITOMAKEMONEY"` デフォルト | ScriptProperties に設定必須 |
| IPN テストモード | `x-test-ipn: 1` で本番でも署名スキップ可能 | 本番環境での無効化 |

### 高優先度

| 項目 | 内容 | 対処 |
|---|---|---|
| リセットURL ハードコード | GAS 側で `https://lifai.vercel.app` 固定 | ScriptProperties 化 |
| プラン金額二重管理 | GAS と Next.js 両方で金額定義 | 単一ソースに統合 |
| TypeScript strict 無効 | `tsconfig.json` で strict: false | strict: true へ移行 |
| CSRF 対策なし | フォーム送信への CSRF トークン未実装 | SameSite Cookie or トークン |

### 中優先度

| 項目 | 内容 |
|---|---|
| レート制限なし | `/api/auth/login` 等への ブルートフォース対策なし |
| applyId 衝突可能性 | `lifai_{Date.now()}` は同時リクエストで衝突の可能性 |
| GAS 関数重複 | `getValuesSafe_` / `getSheetValuesSafe_` が同一処理で2つ存在 |
| メモリキャッシュ | Vercel の複数インスタンスでは共有されない |

---

*この設計書は実際のコードを解析して作成されました。GAS コードの詳細は Google Apps Script エディタを参照してください。*
