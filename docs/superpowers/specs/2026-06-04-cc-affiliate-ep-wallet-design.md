# CC決済アフィリエイト報酬・EPウォレットログ 設計書

Date: 2026-06-04

## 概要

4つのパートで構成。いずれも既存構造を壊さず追加・変更のみ行う。

---

## Part 1: EP付与のwallet_ledger記録

### 対象
`gas/Code.gs` の `approveRowCore_` 関数内、`ep_balance.setValue` の直後。

### 変更内容
```javascript
appendWalletLedger_({
  kind:     "ep_grant",
  login_id: loginId,
  email:    email,
  amount:   epAdded,
  memo:     "plan:" + plan,
});
```
既存の try/catch ブロック内に追加。`epAdded === 0` の場合（二重付与スキップ時）は書き込まない。

### 影響範囲
- wallet_ledger シートに行が追加されるだけ
- UsersTab の Wallet履歴は既存の表示ロジックで自動的に表示される

---

## Part 2: アフィリエイト集計を1段構造（L1のみ20%）に変更

### 対象
`gas/Code.gs` の `affiliate_monthly_summary` アクション内の初回入金集計ループ。

### 変更内容
```javascript
// 変更前: for (let lvl = 0; lvl < 5; lvl++) { ... initRates[lvl] ... }
// 変更後: L1のみ
const colName    = "referrer_login_id";  // L1のみ
if (amIdx[colName] === undefined) continue_row;
const refLoginId = str_(r[amIdx[colName]]);
if (!refLoginId) continue_row;
const ratePct  = 20;  // L1固定 20%
const rewardEp = Math.floor(amountJpy * ratePct / 100 * epPerJpy);
// levels[0] に記録（L2〜L4は0のまま）
```

### 影響範囲
- `initRates` / `settings.rates` は他のコードから参照されないため無影響
- MonthlyTab の L1〜L5 表示列はそのまま残す（L2〜L5 は 0 になるだけ）
- `grantReferralBonusOnce_`（入会時の即時USD報酬）は別系統のため変更不要

---

## Part 3: Square CC購入のアフィリエイト報酬付与

### 対象
`gas/Code.gs` の `square_grant_bp` アクション。

### 冪等性設計（2段階チェック）

```
① wallet_ledger で square_bp_purchase + payment_id の重複確認
   → BP済みフラグを立てる（早期returnはしない）

② wallet_ledger で cc_affiliate_reward + payment_id の重複確認
   → アフィリ済みフラグを立てる

パターンA: BP未 + アフィリ未 → BP付与 + アフィリ付与
パターンB: BP済 + アフィリ未 → アフィリのみ付与
パターンC: BP済 + アフィリ済 → duplicate return
```

### アフィリエイト計算
```
購入者の referrer_login_id（L1のみ）を取得
amountUsd = amount_cents / 100
amountJpy = amountUsd * usdToJpy
rewardEp  = Math.floor(amountJpy * 0.05 * epPerJpy)  // L1: 5%
```
- `usdToJpy`, `epPerJpy` は `getSystemSettings_()` で取得
- `amount_cents` が 0 または undefined の場合はアフィリをスキップ
- 購入者に `referrer_login_id` がない場合もスキップ

### 記録
```javascript
// 紹介者の ep_balance を加算
// wallet_ledger に追記
appendWalletLedger_({
  kind:     "cc_affiliate_reward",
  login_id: refLoginId,
  email:    refEmail,
  amount:   rewardEp,
  memo:     JSON.stringify({
    from:           userId_sq,
    level:          1,
    amount_usd:     amountUsd,
    rate_pct:       5,
    square_payment_id: paymentId_sq,
  }),
});
```

---

## Part 4: MonthlyTab の CC集計有効化

### 対象
`gas/Code.gs` の `affiliate_monthly_summary` 内の Phase 2 コメントアウトブロック。

### 変更方針
既存のコメントアウトブロック（`wallet_ledger` の `cc_payment` を再計算していたもの）を**削除し**、以下のシンプルな実装に置き換える：

```javascript
// wallet_ledger の cc_affiliate_reward を月次フィルタして集計
// kindが "cc_affiliate_reward" かつ ts が対象月範囲内のエントリを読む
// memo の JSON から level, amount_usd, rate_pct を取得
// login_id（紹介者）ごとに cc_usd と cc_ep を集計
```

既に `appendWalletLedger_` で記録済みのデータを読むだけで、再計算は不要。

---

## AffiliateTab の kind フィルタ更新

`AffiliateTab.tsx` は現在 `kind="affiliate_reward"` でフィルタしているが、
このkindはGASに存在しない（AffiliateTabは常に空）。
`cc_affiliate_reward` も含めるよう更新する：

```typescript
ledger.filter(l => l.kind === "affiliate_reward" || l.kind === "cc_affiliate_reward")
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | Part 1: ep_grant記録 / Part 2: 1段ループ / Part 3: CC affiliate / Part 4: CC集計 |
| `app/admin/finance/AffiliateTab.tsx` | kindフィルタに cc_affiliate_reward を追加 |

---

## 安全性確認済み項目

- `initRates` の消費者は `affiliate_monthly_summary` のみ（他影響なし）
- `appendWalletLedger_` は既存の try/catch 内に追加（失敗しても本体処理に無影響）
- `square_grant_bp` の冪等性は2段階チェックで部分失敗に対応
- MonthlyTab の5段表示列は削除しない（L2〜L5が0になるだけ）
- `grantReferralBonusOnce_` は変更不要（別系統）
