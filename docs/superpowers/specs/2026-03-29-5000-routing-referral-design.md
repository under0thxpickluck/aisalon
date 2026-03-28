# /5000 グループ ルーティング＋紹介ツリー設計書

## 概要

`/5000` グループは通常LIFAIと同じフロントエンド・機能を使うが、すべてのデータは専用スプレッドシート（`SPREADSHEET_5000_ID`）に分離して管理される。本設計書はその基盤ルーティング（フェーズ1）と紹介ツリー＋報酬計算（フェーズ2）を定義する。

**絶対ルール:** 既存コード・APIルート・GASアクション・ページは破壊しない。追加・後方互換拡張のみ。

---

## フェーズ1: /5000 ログイン・データルーティング

### アーキテクチャ

```
【通常LIFAIユーザー】
/login → setAuth({id, status}) → /top
  APIコール（group なし） → GAS → 既存スプレッドシート

【/5000ユーザー】
/5000/login → setAuth({id, status, group:"5000"}) → /top（同じページ）
  APIコール（group:"5000" 付加） → GAS → /5000スプレッドシート
```

### 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---|---|---|
| `app/lib/auth.ts` | 後方互換拡張 | `AuthState` に `group?: string` を追加 |
| `app/5000/login/page.tsx` | 新規作成 | ダーク系ログインページ。`group:"5000"` を auth state に保存 |
| `app/api/auth/login/route.ts` | 後方互換拡張 | `group` を受け取りGASに転送（なければ従来通り） |
| `app/api/me/route.ts` | 後方互換拡張 | `group` を受け取りGASに転送 |
| `app/api/wallet/balance/route.ts` | 後方互換拡張 | `group` を受け取りGASに転送 |
| 既存ページ（下記5ページ） | 後方互換拡張 | `getAuth()?.group` を読んでAPI呼び出しに付加 |
| `gas/Code.gs` | 後方互換拡張 | `login`・`me`・`get_balance` に `/5000` スプレッドシート分岐追加 |

### auth.ts の変更

```typescript
// 変更前
export type AuthState = {
  status: AuthStatus;
  id: string;
  token?: string;
  plan?: string;
  updatedAt: number;
};

// 変更後（group を追加するのみ）
export type AuthState = {
  status: AuthStatus;
  id: string;
  token?: string;
  plan?: string;
  group?: string;   // 追加: "5000" | undefined
  updatedAt: number;
};
```

### /5000/login ページ仕様

- デザイン: `/5000/page.tsx` と同じダーク系（`#0A0A0A` ベース、`#6C63FF`/`#00D4FF` アクセント）
- フィールド: ログインID・パスワード（既存 `/login` と同じ）
- 送信先: `/api/auth/login`（`group: "5000"` を body に追加）
- 成功時: `setAuth({..., group: "5000"})` → `/top` へリダイレクト
- 既存 `/login` ページは一切変更しない

### GAS 分岐ロジック（`login` / `me` / `get_balance` 共通パターン）

```javascript
// 既存コードの sheet 取得部分の直後に追加
const group = str_(body.group) || "";
const targetSheet = group === "5000" ? getAppliesSheet5000_() : sheet;
// 以降 sheet → targetSheet に切り替え
```

`getAppliesSheet5000_()` は既存の `apply_5000` アクションで使用済みのパターンを関数化：

```javascript
function getAppliesSheet5000_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
  if (!id) throw new Error("SPREADSHEET_5000_ID not set");
  return SpreadsheetApp.openById(id).getSheetByName("applies");
}
```

---

## フェーズ2: 紹介ツリー＋報酬計算

### 紹介ツリー構造

- 最大5段のツリー構造
- 各メンバーが持つ:
  - `my_ref_code`: 自分の紹介コード（承認時に自動生成、例: `5KA1B2C3`）
  - `ref_id`: 自分を紹介した人のコード（申請フォームで入力）

ツリー遡り: `ref_id` → そのコードを `my_ref_code` に持つ人 → さらにその `ref_id` → …（最大5段）

### 報酬レート

| 段 | 関係 | レート |
|---|---|---|
| 1st | 直接紹介者 | 10% |
| 2nd | 紹介者の紹介者 | 5% |
| 3rd | 3段上 | 2% |
| 4th | 4段上 | 2% |
| 5th | 5段上 | 1% |

合計: 20%

### プランと入会金（USD）

| プランID | 金額 |
|---|---|
| 500 | $500 |
| 2000 | $2,000 |
| 3000 | $3,000 |
| 5000 | $5,000 |

### 報酬計算例（$5000プラン入会の場合）

| 段 | 金額 |
|---|---|
| 1st | $500 |
| 2nd | $250 |
| 3rd | $100 |
| 4th | $100 |
| 5th | $50 |

紹介者がいない段はスキップ（0段目からの入会でも正常動作）。

### /5000スプレッドシートのデータ構造

#### `applies` シート（既存列に追加）

| 追加列 | 内容 |
|---|---|
| `my_ref_code` | 承認時に自動生成される自分の紹介コード（例: `5KA1B2C3`） |

#### `ledger_YYYY_MM` シート（月別自動生成）

例: `ledger_2026_03`, `ledger_2026_04`

| 列名 | 型 | 内容 |
|---|---|---|
| `created_at` | DateTime | 記録日時 |
| `to_login_id` | String | 報酬受取人のログインID |
| `type` | String | `"referral_entry"`（将来: `"referral_monthly"` 等） |
| `amount_usd` | Number | 報酬金額（USD） |
| `from_apply_id` | String | 報酬発生元の申請ID |
| `level` | Number | 紹介段数（1〜5） |
| `memo` | String | 例: `"$5000 plan 1st level 10%"` |

### 承認フロー（GAS `admin_approve_5000` アクション）

```
1. /5000/admin から管理者が承認ボタンを押す
2. POST /api/5000/admin/approve → GAS action: "admin_approve_5000"
3. GAS 処理:
   a. applies シートの当該行を status: "approved" に更新
   b. my_ref_code 生成: "5K" + 6文字ランダム英数字（重複チェックあり）
   c. ログインID生成・pw_hash設定・reset_token発行（既存 `admin_approve` GASアクションと同じパターン）
   d. パスワードリセットメール送信（リセットURLは既存 `https://lifai.vercel.app/reset` を流用）
   e. 紹介チェーン遡り（最大5段）:
      - 申請の ref_id から applies シートで my_ref_code 一致を検索
      - 見つかれば報酬計算 → ledger_YYYY_MM に追記
      - その人の ref_id を次の段として繰り返す
   f. { ok: true } を返す
```

### 月別シート生成ロジック

```javascript
function getLedgerSheet5000_(ss, yearMonth) {
  // yearMonth: "2026_03" 形式
  const name = "ledger_" + yearMonth;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow([
      "created_at", "to_login_id", "type",
      "amount_usd", "from_apply_id", "level", "memo"
    ]);
  }
  return sheet;
}
```

### 紹介コード生成ロジック

```javascript
function generateRefCode5000_(sheet) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字除外
  const existing = sheet.getDataRange().getValues()
    .map(function(r) { return r[idx["my_ref_code"]]; });
  let code;
  do {
    code = "5K";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (existing.indexOf(code) >= 0);
  return code;
}
```

### /5000/admin ページ仕様

- 新規作成（既存 `/admin` は変更しない）
- Basic Auth は既存の `ADMIN_USER` / `ADMIN_PASS` を流用
- `/5000` スプレッドシートの `applies` シートを読み込んで一覧表示
- `status: "pending"` の申請に承認ボタン
- 承認ボタン → POST `/api/5000/admin/approve`
- 承認後の wallet_ledger への書き込みはGAS側で完結

### 将来の月額報酬への拡張

`type` 列が `"referral_entry"`（今回）と `"referral_monthly"`（将来）で区別できる構造になっているため、月額サブスクリプション報酬が追加になっても台帳構造の変更は不要。

---

## 実装順序

1. **フェーズ1-A**: `auth.ts` に `group` 追加 + `/5000/login` ページ作成
2. **フェーズ1-B**: GAS `getAppliesSheet5000_()` 関数化 + `login`/`me`/`get_balance` 分岐追加
3. **フェーズ1-C**: 既存APIルート（`/api/auth/login`, `/api/me`, `/api/wallet/balance`）に `group` 転送追加
4. **フェーズ1-D**: 以下の既存ページに `group` の付加（`getAuth()?.group` を読んでAPIコールに渡す）:
   - `app/top/page.tsx`（`/api/me` + `/api/wallet/balance`）
   - `app/membership/page.tsx`（`/api/wallet/balance`）
   - `app/music/page.tsx`（`/api/me`）
   - `app/music/pro/page.tsx`（`/api/me`）
   - `app/market/create/page.tsx`（`/api/wallet/balance`）
5. **フェーズ2-A**: GAS `admin_approve_5000` アクション（`my_ref_code`生成 + 紹介報酬計算 + ledger書き込み）
6. **フェーズ2-B**: `/5000/admin` ページ + `/api/5000/admin/approve` APIルート
