# /5000 決済〜自動承認フロー 設計書

## 概要

`/5000` グループに NOWPayments 決済 → IPN 受信 → 自動承認フローを追加する。
既存の通常 LIFAI フロー・コード・API は一切変更しない。
既存の `/5000/admin` 手動承認も引き続き動作する（両立）。

**絶対ルール:** 既存コード・APIルート・GASアクション・ページは破壊しない。追加・後方互換拡張のみ。

---

## ユーザーフロー

```
[/5000/apply] フォーム入力（email/name/plan/refId等）
      ↓
[/5000/confirm] 確認画面
      ↓ POST /api/5000/apply（既存・拡張）
        GAS apply_5000 → expected_paid セット、status=pending_payment
        → apply_id 返却
      ↓ POST /api/5000/nowpayments/create（新規）
        → invoice_url 返却
      ↓ apply_id を sessionStorage 保存
      外部 NOWPayments へリダイレクト
      ↓（ユーザーは戻らなくてよい）

[NOWPaymentsサーバー] 送金確認
      ↓ POST /api/5000/nowpayments/ipn（新規）
        署名検証（HMAC-SHA512）
        ↓ GAS payment_update_5000（新規）
          条件クリア → approve_row_core_5000_() 実行
          → login_id / my_ref_code 生成・メール送信

[/5000/purchase-status?apply_id=xxx]（新規ページ）
      5秒ポーリングで状況確認
      メール未着 → 「再送」ボタン → POST /api/5000/reset/resend（新規）
```

---

## アーキテクチャ方針

- `/5000` 専用の独立したエンドポイント群を新規作成（通常 LIFAI の `/api/nowpayments/*` は変更しない）
- NOWPayments の `ipn_callback_url` を `/api/5000/nowpayments/ipn` に向けることで、IPN を /5000 専用エンドポイントで受ける
- `order_id = apply_id`（`5000_` プレフィックス付き）で支払いを識別
- GAS の `payment_update_5000` は `/5000` スプレッドシート（`SPREADSHEET_5000_ID`）のみ操作

---

## 変更ファイル一覧

### 新規作成

| ファイル | 役割 |
|---|---|
| `app/api/5000/nowpayments/create/route.ts` | apply_id を受け取り NOWPayments invoice 作成 |
| `app/api/5000/nowpayments/ipn/route.ts` | IPN 受信・署名検証・GAS payment_update_5000 呼び出し |
| `app/api/5000/purchase-status/route.ts` | apply_id でステータス照会 |
| `app/api/5000/reset/resend/route.ts` | 認証メール再送 |
| `app/5000/purchase-status/page.tsx` | 購入状況確認ページ（ポーリング付き） |

### 後方互換拡張（既存ファイル）

| ファイル | 変更内容 |
|---|---|
| `app/5000/confirm/page.tsx` | フォーム送信後に決済ステップを追加（apply_id 取得 → invoice_url 取得 → リダイレクト） |
| `app/5000/apply/page.tsx` | plan を sessionStorage に保存し confirm へ渡す |
| `app/5000/page.tsx` | プラン選択を sessionStorage に保存。CTAを `/5000/apply` へのリンクに変更 |
| `gas/Code.gs` | `payment_update_5000`・`get_apply_status_5000`・`approve_row_core_5000_()` 追加。`apply_5000` を拡張 |

### 変更しないファイル

- `app/api/nowpayments/create/route.ts`
- `app/api/nowpayments/ipn/route.ts`
- `app/api/5000/admin/approve/route.ts`
- `app/5000/admin/page.tsx`
- その他既存すべてのファイル

---

## /5000 スプレッドシート `applies` シート 追加列

既存列はそのまま保持し、以下を `ensureCols_` パターンで追加する。

| 列名 | 型 | 内容 |
|---|---|---|
| `expected_paid` | Number | プランに応じた USDT 金額（500/2000/3000/5000） |
| `payment_id` | String | NOWPayments の payment_id |
| `payment_status` | String | NOWPayments ステータス（waiting/confirming/finished 等） |
| `actually_paid` | Number | 実際に入金された金額 |
| `pay_currency` | String | 支払い通貨（USDT 等） |
| `paid_at` | DateTime | 入金確認日時（finished 到達時） |
| `approved_at` | DateTime | 承認日時（二重承認防止キー） |
| `last_ipn_at` | DateTime | 最後の IPN 受信日時 |
| `auto_approve_reason` | String | 自動承認理由（例: `finished_amount_ok`） |

---

## API ルート仕様

### `POST /api/5000/nowpayments/create`

**入力:**
```json
{ "apply_id": "5000_1234567890" }
```

**処理:**
1. `apply_id` から plan を取得（GAS `get_apply_status_5000` 経由）
2. plan → `expected_paid` マップ: `{ "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 }`
3. NOWPayments API に invoice 作成リクエスト:
   - `price_amount`: expected_paid
   - `price_currency`: "usd"
   - `pay_currency`: "usdttrc20"
   - `order_id`: apply_id
   - `ipn_callback_url`: `${NEXT_PUBLIC_SITE_URL}/api/5000/nowpayments/ipn`
   - `success_url`: `${NEXT_PUBLIC_SITE_URL}/5000/purchase-status?apply_id={apply_id}`
   - `cancel_url`: `${NEXT_PUBLIC_SITE_URL}/5000/apply`

**出力:**
```json
{ "ok": true, "invoice_url": "https://...", "apply_id": "5000_xxx" }
```

---

### `POST /api/5000/nowpayments/ipn`

**処理:**
1. ヘッダー `x-nowpayments-sig` で HMAC-SHA512 署名検証（`NOWPAYMENTS_IPN_SECRET` 使用）
2. テストモード: `x-test-ipn: 1` ヘッダーがあれば署名検証をスキップ
3. payload から抽出:
   - `payment_id`, `order_id`（= apply_id）, `payment_status`
   - `pay_amount`, `actually_paid`, `price_amount`, `price_currency`, `pay_currency`
4. GAS `payment_update_5000` を POST で呼び出し
5. `{ ok: true }` を返す

---

### `GET /api/5000/purchase-status?apply_id=xxx`

**処理:** GAS `get_apply_status_5000` を呼び出し

**出力:**
```json
{
  "ok": true,
  "apply_id": "5000_xxx",
  "status": "approved",
  "payment_status": "finished",
  "mail_sent": true,
  "plan": "5000"
}
```

---

### `POST /api/5000/reset/resend`

**入力:**
```json
{ "apply_id": "5000_xxx" }
```

**処理:** GAS `reset_resend_5000` を呼び出し（既存 `reset_resend` の /5000 版）

**出力:**
```json
{ "ok": true }
```

---

## GAS アクション仕様

### `apply_5000`（既存アクション拡張）

現在は `status: "pending"` で保存。以下を追加:
- `expected_paid` を plan から計算してセット（500→500, 2000→2000, 3000→3000, 5000→5000 USD）
- `status = "pending_payment"` に変更
- `apply_id` を返却: `{ ok: true, apply_id: "5000_xxx" }`

---

### `payment_update_5000`（新規）

**入力:** apply_id, payment_id, payment_status, actually_paid, pay_amount, pay_currency, price_amount, price_currency

**処理:**
1. `/5000` スプレッドシートの `applies` シートで `apply_id` 一致行を検索
2. `payment_id`, `payment_status`, `actually_paid`, `pay_amount`, `pay_currency`, `last_ipn_at` を更新
3. `payment_status === "finished"` かつ `actually_paid >= expected_paid * 0.98` なら `approve_row_core_5000_()` 呼び出し
4. 金額不足の場合 `status = "manual_review"` に更新
5. `{ ok: true, autoApproved: boolean, reason: string }` を返す

---

### `approve_row_core_5000_(applySheet, idx, rowIndex, reason)`（内部関数・新規）

既存 `admin_approve_5000` の承認ロジックを関数化して共有。

**処理（冪等）:**
1. `approved_at` が既にある → `{ already: true }` を返す（二重承認防止）
2. `login_id` 生成（`5k_` + 6文字ランダム英数字）
3. `my_ref_code` 生成（`generateRefCode5000_()` 使用）
4. reset_token 生成・reset_expires 設定（72時間）
5. `approved_at` 記録
6. `sendResetMail_()` 呼び出し
7. `reset_sent_at` 記録
8. `status = "approved"` 更新
9. 紹介チェーン処理（`referral_processed_at` でデデュープ）
10. `{ ok: true, loginId, myRefCode, resetSent }` を返す

---

### `get_apply_status_5000`（新規）

**入力:** apply_id（query param）

**処理:** `/5000` スプレッドシートで apply_id 一致行を検索

**出力:**
```json
{
  "ok": true,
  "apply_id": "5000_xxx",
  "status": "approved",
  "payment_status": "finished",
  "plan": "5000",
  "mail_sent": true
}
```

---

### `reset_resend_5000`（新規）

**入力:** apply_id

**処理:**
1. `/5000` スプレッドシートで apply_id 一致行を検索
2. `status === "approved"` の行のみ対象
3. reset_token 再生成（または既存を流用）・reset_expires 更新
4. `sendResetMail_()` 呼び出し
5. `reset_sent_at` 更新

---

## 状態遷移

| NOWPayments status | /5000 内部 status |
|---|---|
| （申込直後） | `pending_payment` |
| `waiting` | `payment_waiting` |
| `confirming` | `payment_confirming` |
| `confirmed` | `payment_confirmed` |
| `finished` + 金額OK | `approved` |
| `finished` + 金額不足 | `manual_review` |
| `partially_paid` | `manual_review` |
| `failed` / `expired` / `refunded` | `pending_error` |

---

## UI 仕様

### `/5000/confirm` 変更

現在: フォーム送信 → 成功メッセージ表示

変更後:
1. POST `/api/5000/apply` → apply_id 取得
2. POST `/api/5000/nowpayments/create` → invoice_url 取得
3. `sessionStorage.setItem("5000_apply_id", apply_id)`
4. `window.location.href = invoice_url` でリダイレクト
5. エラー時はエラーメッセージ表示（既存成功メッセージUIを流用）

### `/5000/purchase-status` ページ（新規）

- URL: `/5000/purchase-status?apply_id=xxx`
- apply_id は URL param または sessionStorage から取得
- 5秒ポーリングで `/api/5000/purchase-status` を叩く
- ステータス別メッセージ:

| status | 表示 |
|---|---|
| `pending_payment` | 申込受付済み。支払いをお待ちしています |
| `payment_waiting` / `payment_confirming` | 入金確認中です。しばらくお待ちください |
| `payment_confirmed` | 承認処理中です |
| `approved` | 承認完了。認証メールを送信しました |
| `manual_review` | 手動確認が必要です。サポートへご連絡ください |
| `pending_error` | エラーが発生しました。サポートへご連絡ください |

- `status === "approved"` かつ `mail_sent === false` → 「メールを再送する」ボタン表示
- ポーリングは `status === "approved"` または `pending_error` で停止

### `/5000/page.tsx` 変更

- 各プランカードの「申し込む」ボタン押下で `sessionStorage.setItem("5000_plan", plan)` を保存
- CTAを `/5000/apply` へのリンクに変更（既存の直接決済ロジックがあれば削除）

### `/5000/apply/page.tsx` 変更

- マウント時に `sessionStorage.getItem("5000_plan")` を読んでプランを初期選択状態に設定

---

## 冪等性・安全性

- `approved_at` が空の場合のみ承認実行（二重承認防止）
- `referral_processed_at` が空の場合のみ紹介報酬計算（二重計算防止）
- IPN の同一 `payment_id` による二重処理: `last_ipn_at` を更新するのみで、承認は `approved_at` ガードで防止
- メール送信失敗時は `mail_error` 列に記録し `status` は `approved` のまま維持（再送で対応）

---

## 実装順序

1. GAS `apply_5000` 拡張（expected_paid・status=pending_payment・apply_id返却）
2. GAS `approve_row_core_5000_()` 関数化（既存 `admin_approve_5000` からロジック抽出）
3. GAS `payment_update_5000` アクション追加
4. GAS `get_apply_status_5000` アクション追加
5. GAS `reset_resend_5000` アクション追加
6. `app/api/5000/nowpayments/create/route.ts` 新規作成
7. `app/api/5000/nowpayments/ipn/route.ts` 新規作成
8. `app/api/5000/purchase-status/route.ts` 新規作成
9. `app/api/5000/reset/resend/route.ts` 新規作成
10. `app/5000/page.tsx` プラン選択 sessionStorage 保存
11. `app/5000/apply/page.tsx` プラン初期値読み込み
12. `app/5000/confirm/page.tsx` 決済ステップ追加
13. `app/5000/purchase-status/page.tsx` 新規作成
