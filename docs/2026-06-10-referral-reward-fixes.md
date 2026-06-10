# 2026-06-10 作業ログ：紹介報酬システム修正

## 概要

紹介報酬の月次集計が正しく動作しない問題を調査・修正した。

---

## 発見したバグと修正内容

### バグ1: `getEpPerJpy_` のプランIDキーが全て間違い（修正済み）

**場所**: `gas/Code.gs` → `getEpPerJpy_` 関数

**原因**: スプレッドシートの `plan` 列に格納されるのはプランID（"30"/"50"/"100"/"500"/"1000"）だが、関数のキーが表示価格（"40"/"67"/"134"/"667"/"1334"）になっていた。

| プラン | 格納値（正） | 旧キー（誤） | EP/円レート |
|---|---|---|---|
| Starter | "30" | "40" | 4 |
| Builder | "50" | "67" | 3.5 |
| Automation | "100" | "134" | 3 |
| Core | "500" | "667" | 2.5 |
| Infra | "1000" | "1334" | 2 |

**修正**: キーを実際のプランIDに変更。

```javascript
// 修正後
function getEpPerJpy_(plan) {
  var map = { "30": 4, "50": 3.5, "100": 3, "500": 2.5, "1000": 2 };
  return map[String(plan)] || 4;
}
```

---

### バグ2: `my_ref_code` 変更後に古いコードで申し込んだユーザーの `referrer_login_id` が空（修正済み）

**場所**: `gas/Code.gs` → `resolveRefChain_` 関数

**原因**: 紹介者がデフォルトコード "R-xxx" からカスタムコード（例: "jamdao001"）に変更した後、古いコード "R-xxx" で申し込んだユーザーが承認されると、`resolveRefChain_` が現在の `my_ref_code` にしか一致検索しないため紹介者が解決できず `referrer_login_id` が空になる。

**修正**: `"R-" + login_id` フォールバック検索を追加。

```javascript
// 修正後
if (mrc === usedRefCode || ("R-" + lid === usedRefCode)) {
  ref1 = lid;
  break;
}
```

また `ref_backfill_from_refcode` にも同様のフォールバックを追加（`myRefMap["R-" + lid] = entry`）。

---

### バグ3: `referral/page.tsx` のEPレート表示が全て "4EP=1円"（修正済み）

**場所**: `app/referral/page.tsx` → `planRows`

全プランが `epRateNormal: "4EP=1円"` になっていた。正しいレートに修正済み。

---

### 変更4: `MonthlyTab` の L1 率表示を修正（修正済み）

**場所**: `app/admin/finance/MonthlyTab.tsx`

`INIT_RATES[0]` が `10` になっていたが、L1は20%なので `20` に修正。

---

### 変更5: 月次集計にデバッグ情報を追加（本日）

**場所**: `gas/Code.gs` → `affiliate_monthly_summary` アクション

レスポンスに `debug_info` フィールドを追加:

```json
{
  "debug_info": {
    "approved_in_month": 5,
    "no_ref_code": 2,
    "no_referrer_id": 1
  }
}
```

- `approved_in_month`: 対象月に承認されたユーザー数
- `no_ref_code`: 紹介コードなしで申し込んだユーザー数（集計対象外）
- `no_referrer_id`: 紹介コードあり・紹介者未解決のユーザー数（Backfill要）

MonthlyTab にも警告バナーを追加。`no_referrer_id > 0` のとき「TreeタブでBackfill実行を推奨」と表示。

---

### 変更6: お知らせ欄に紹介報酬支払い遅延のご案内を追加（本日）

**場所**: `app/top/page.tsx` → `NOTICES` 配列

```typescript
{
  id: "2",
  date: "2026-06-10",
  title: "【紹介報酬のお支払いについて】",
  body: "...",
}
```

---

## 残タスク（未完了）

### 最優先: GAS 再デプロイ（必須）

GitHub にコードをプッシュしただけでは GAS には反映されない。以下の手順が必要：

1. GAS エディタを開く
2. `gas/Code.gs` の内容を全コピー&ペースト
3. 「新しいバージョンとしてデプロイ」を実行

### GAS デプロイ後: Backfill 実行

1. `/admin/finance` → 「紹介ツリー」タブを開く
2. Backfill ボタンを押す
3. `referrer_login_id` が空だった既存ユーザーが一括解決される

### 確認

月次集計を実行して以下を確認:
- 警告バナーが消える（`no_referrer_id = 0`）
- 各紹介者にEPが正しく集計されている
- プランに応じたEPレート（例: Core紹介者は 2.5EP/円）が表示されている

---

## 関連ファイル

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | `getEpPerJpy_` キー修正、`resolveRefChain_` フォールバック追加、`ref_backfill_from_refcode` フォールバック追加、月次集計デバッグ情報追加 |
| `app/admin/finance/MonthlyTab.tsx` | L1率修正、`ep_per_jpy` 表示追加、デバッグ警告バナー追加 |
| `app/referral/page.tsx` | プランごとのEPレート表示修正 |
| `app/top/page.tsx` | お知らせ追加 |

## コミット履歴（本日分）

```
862eb74 feat(top): お知らせに紹介報酬支払い遅延のご案内を追加
5c02692 fix(gas): getEpPerJpy_ のプランIDキーを修正、月次集計にデバッグ情報を追加
b7bd4e1 fix(gas/referral): resolveRefChain_ カスタムrefcode後方互換修正 + referralページEPレート修正
```
