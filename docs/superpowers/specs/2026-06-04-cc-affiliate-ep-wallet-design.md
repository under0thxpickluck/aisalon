# CC決済アフィリエイト報酬・EPウォレットログ 設計書

Date: 2026-06-04（更新）

## 概要

5つのパートで構成。いずれも既存構造を壊さず追加・変更のみ行う。
EP付与は管理者が手動確認して実行する。自動付与は行わない。

---

## Part 1: EP付与のwallet_ledger記録

### 対象
`gas/Code.gs` の `approveRowCore_` 内、`ep_balance.setValue` 直後。

### 変更内容
```javascript
if (epAdded > 0) {
  appendWalletLedger_({
    kind: "ep_grant", login_id: loginId, email: email,
    amount: epAdded, memo: "plan:" + plan,
  });
}
```

### 影響範囲
wallet_ledger に行追加のみ。UsersTab の Wallet履歴に自動表示される。

---

## Part 2: アフィリエイト集計を1段構造（L1のみ20%）に変更

### 対象
`gas/Code.gs` の `affiliate_monthly_summary` 初回入金集計ループ。

### 変更内容
`for lvl=0..4` のループを廃止し、L1（`referrer_login_id`）のみ 20% で計算。
`levels[0]` に記録、L2〜L4 は 0 のまま（表示列は残す）。

### 影響範囲
`initRates` の消費者はこのアクションのみ。`grantReferralBonusOnce_` は別系統で変更不要。

---

## Part 3: Square CC購入 → 報酬をキューに積む（自動付与なし）

### 設計方針
`square_grant_bp` 実行時に EP 額を**計算してキューシートに保存するだけ**。
ep_balance は変更しない。wallet_ledger にも書かない。

### 新規シート: `cc_affiliate_pending`

| カラム | 内容 |
|---|---|
| `ts` | 計算日時 |
| `square_payment_id` | 冪等キー |
| `payer_login_id` | BP購入者 |
| `referrer_login_id` | L1紹介者 |
| `referrer_email` | 紹介者メール |
| `amount_usd` | 購入USD額 |
| `reward_ep` | 付与予定EP |
| `status` | `"pending"` / `"granted"` |
| `granted_at` | 付与日時（空=未付与）|

### 冪等性
`cc_affiliate_pending` で `square_payment_id` の重複チェック。
既存の `square_bp_purchase` 重複チェックと分離し、BP付与とキュー積みを独立させる。

### 計算式
```
amountUsd = amount_cents / 100
rewardEp  = Math.floor(amountUsd * usdToJpy * 0.05 * epPerJpy)  // L1: 5%
```
- `referrer_login_id` がない場合・`amount_cents` が 0 の場合はスキップ

---

## Part 4: 管理画面 — 付与待ちレビュー＆付与ボタン

### 配置
`app/admin/finance/` に新タブ **「CC付与待ち」** を追加（既存タブ構造に追加）。

### 表示内容
`cc_affiliate_pending` の `status="pending"` 行を一覧表示。

| 列 | 内容 |
|---|---|
| 日時 | `ts` |
| 購入者 | `payer_login_id` |
| 紹介者 | `referrer_login_id` |
| USD額 | `amount_usd` |
| 付与予定EP | `reward_ep` |
| [付与]ボタン | クリックで付与実行 |

### 付与ボタンの動作
1. 新 GAS アクション `cc_affiliate_grant` を呼び出す
2. GAS 側処理:
   - `cc_affiliate_pending` の対象行を `status="granted"`, `granted_at=now` に更新
   - 紹介者の `ep_balance` を `reward_ep` 加算
   - `wallet_ledger` に `kind="cc_affiliate_reward"` で記録（AffiliateTabに表示される）
   - `applies` シートの紹介者行に `ep_notification` カラムを設定（EP額を書き込む）

### 新 GAS アクション: `cc_affiliate_grant`
```
input: { adminKey, payment_id }
処理:
  1. cc_affiliate_pending で payment_id を検索
  2. status !== "pending" → error("already_granted")
  3. referrer の ep_balance += reward_ep
  4. wallet_ledger に cc_affiliate_reward 追記
  5. applies の referrer 行の ep_notification に reward_ep を**加算**（複数付与が未読のまま重なる場合に対応）
  6. cc_affiliate_pending の status = "granted", granted_at = now
output: { ok, reward_ep, referrer_login_id }
```

---

## Part 5: EP獲得ポップアップ（次回ログイン時）

### 仕組み

**GAS側（cc_affiliate_grant 内で設定）:**
```
applies シートの紹介者行に ep_notification カラムを追加
値: 付与したEP額（数値）。0または空 = 通知なし
```

**新 GAS アクション: `ep_notification_clear`**
```
input: { loginId, token }
処理: ep_notification を 0 にクリア
output: { ok }
```

**フロントエンド（`/api/me` の拡張）:**
- `me` アクションの返却に `ep_notification` フィールドを追加
- 値 > 0 のとき通知あり

**`app/top/page.tsx`（または共通レイアウト）:**
- `/api/me` の結果を見て `ep_notification > 0` ならモーダル表示
- モーダル: 「+{N} EP を獲得しました！」
- 閉じるボタン → `ep_notification_clear` を呼び出して消す

---

## AffiliateTab の kind フィルタ更新

現状 `kind="affiliate_reward"` は GAS に存在しない（常に空）。
```typescript
// 変更前
ledger.filter(l => l.kind === "affiliate_reward")
// 変更後
ledger.filter(l => l.kind === "affiliate_reward" || l.kind === "cc_affiliate_reward")
```

---

## Part 6（MonthlyTab CC集計）

`cc_affiliate_pending` の `status="granted"` かつ `granted_at` が対象月範囲のエントリを集計。
または `wallet_ledger` の `cc_affiliate_reward` エントリを直接読む（こちらを採用）。

Phase 2コメントアウトブロックを削除し、wallet_ledger読み取りに置き換え。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | Part 1: ep_grant / Part 2: 1段ループ / Part 3: キュー積み / Part 4: cc_affiliate_grant・ep_notification_clear / GAS me拡張 |
| `app/admin/finance/page.tsx` | 「CC付与待ち」タブ追加 |
| `app/admin/finance/CcPendingTab.tsx` | 新規: 付与待ちリスト + 付与ボタン |
| `app/admin/finance/AffiliateTab.tsx` | kind フィルタ更新 |
| `app/api/me/route.ts` | ep_notification フィールド追加 |
| `app/top/page.tsx` | EP獲得ポップアップ追加 |

---

## 安全性確認済み項目

- EP付与は管理者ボタンのみ（自動実行なし）
- `cc_affiliate_pending` は新規シート（既存シートに無影響）
- `ep_notification` カラムは `ensureCols_` で動的追加（既存行を壊さない）
- `square_grant_bp` の BP付与ロジックは変更しない
- `grantReferralBonusOnce_` は変更不要
- MonthlyTab の5段表示列は削除しない
- ポップアップは `/top` ページのみで表示（他ページ無影響）
