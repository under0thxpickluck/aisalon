# 紹介ダッシュボード ミニアプリ — 設計書

**作成日:** 2026-05-08  
**対象:** LIFAI (Next.js 14 App Router + GAS バックエンド)

---

## 概要

ログイン済みユーザーが「自分が紹介した人の一覧」と「受け取った紹介報酬の履歴・合計」を確認できるミニアプリを `/top` ダッシュボードに追加する。  
あわせて既存の「紹介コードカード（ReferralCard）」をこのダッシュボードカードに統合する。

---

## ゴール

| ゴール | 詳細 |
|--------|------|
| 紹介コード共有 | 既存 `ReferralCard` の機能（コピー・リンクコピー）をそのまま維持 |
| 紹介人数・合計報酬のサマリー | 紹介した人の人数と受け取り報酬合計を数値で表示 |
| 紹介した人リスト | login_id・プラン・入会日（approved_at）の一覧 |
| 報酬履歴リスト | 日時・金額・メモ の一覧 + 合計 |

---

## アーキテクチャ

```
[/top の「紹介カード」を開く]
        |
        | カードを初めて開いたとき（lazy fetch）
        v
[Next.js /api/referral/dashboard  POST { id, code }]
        |
        | GAS へ転送
        v
[GAS action: "my_referral_dashboard"]
        |
        |── applies シート全スキャン
        |   → referrer_login_id == myLoginId の行を収集
        |   → 返却: { login_id, plan, approved_at }
        |
        |── wallet_ledger 全スキャン
        |   → login_id == myLoginId かつ kind IN ["referral_bonus","referral_entry"]
        |   → 返却: { ts, kind, amount, memo }
        |
        v
{
  ok: true,
  my_ref_code: "XXXXXX",
  referrals: [
    { login_id: "abc123", plan: "34", approved_at: "2026-01-10T..." }
  ],
  bonuses: [
    { ts: "2026-01-10T...", kind: "referral_bonus", amount: 6.8, memo: "..." }
  ],
  total_bonus: 6.8
}
```

**認証方式:** `me` action と同一。`id`（login_id）と `code`（パスワード）を HMAC-SHA256 で照合。`status !== "approved"` なら `{ ok:false, reason:"pending" }` を返す。

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|----------|------|------|
| `gas/Code.gs` | 修正 | `action === "my_referral_dashboard"` ブロックを追加 |
| `app/api/referral/dashboard/route.ts` | 新規 | GAS へのプロキシ |
| `app/top/page.tsx` | 修正 | `ReferralCard` を `ReferralDashboardCard` に置き換え |

---

## GAS: `my_referral_dashboard` action

### 追加位置
`handle_` 関数内の末尾付近（`me` action の直後あたり）に既存パターンで追加。

### 処理フロー

```javascript
if (action === "my_referral_dashboard") {
  const id = str_(body.id);
  const code = str_(body.code);

  if (!id || !code) return json_({ ok: false, reason: "invalid" });

  // 1. 認証（me と同じ）
  ensureCols_(sheet, header, ["login_id","pw_hash","status","plan","approved_at",
    "referrer_login_id","my_ref_code"]);
  // ... HMAC 照合 → approved チェック

  // 2. 自分を紹介した人ではなく、自分が紹介した人を取得
  //    → applies を全スキャンして referrer_login_id == myLoginId の行を収集
  const referrals = rows
    .filter(r => str_(r[idx["referrer_login_id"]]) === myLoginId)
    .map(r => ({
      login_id: str_(r[idx["login_id"]]),
      plan: str_(r[idx["plan"]]),
      approved_at: r[idx["approved_at"]] ? new Date(r[idx["approved_at"]]).toISOString() : "",
    }));

  // 3. wallet_ledger からボーナス履歴取得
  const ledger = ss.getSheetByName("wallet_ledger");
  let bonuses = [];
  let total_bonus = 0;
  if (ledger) {
    const ledValues = getValuesSafe_(ledger);
    // ヘッダー: ts, kind, login_id, email, amount, memo
    // kind が "referral_bonus" or "referral_entry" かつ login_id == myLoginId
    bonuses = ledValues.slice(1)
      .filter(r => str_(r[lIdx["login_id"]]) === myLoginId
               && ["referral_bonus","referral_entry"].includes(str_(r[lIdx["kind"]])))
      .map(r => ({
        ts: r[lIdx["ts"]] ? new Date(r[lIdx["ts"]]).toISOString() : "",
        kind: str_(r[lIdx["kind"]]),
        amount: Number(r[lIdx["amount"]] || 0),
        memo: str_(r[lIdx["memo"]]),
      }));
    total_bonus = bonuses.reduce((s, b) => s + b.amount, 0);
  }

  return json_({
    ok: true,
    my_ref_code: myRefCode,
    referrals,
    bonuses,
    total_bonus,
  });
}
```

### エラーケース
- `wallet_ledger` シートが存在しない → `bonuses: [], total_bonus: 0` で正常返却
- 紹介した人がゼロ → `referrals: []` で正常返却
- 認証失敗 → `{ ok: false, reason: "invalid" | "pending" }`

---

## Next.js: `/api/referral/dashboard/route.ts`

```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { id: string, code: string }
// GAS action: "my_referral_dashboard" へ中継
// タイムアウト: 15秒（me と同じ）
// レスポンス: GAS のレスポンスをそのまま返す
```

既存の `/api/me/route.ts` と同じパターンで実装。`id`・`code` バリデーション → GAS POST → JSON 中継。

---

## UI: `ReferralDashboardCard`（`/top/page.tsx` 内）

### 概要
既存の `ReferralCard`（折りたたみ式アコーディオン）を拡張・置き換える新コンポーネント。  
カード展開時に `/api/referral/dashboard` を一度だけ fetch（lazy load）。

### 表示構成

```
┌──────────────────────────────────────────────────────┐
│ あなたの紹介コード                         ▼ 開く    │
├──────────────────────────────────────────────────────┤ ← 展開時
│ ① 紹介コード & リンクコピーUI                        │
│   [ XXXXXX ] [コードをコピー] [リンクをコピー]        │
│   共有リンク: https://example.com/purchase?refCode=XX │
│                                                      │
│ ② サマリー                                           │
│   ┌────────────┐ ┌────────────────────┐              │
│   │ 紹介した人  │ │ 紹介報酬合計        │              │
│   │   3 人     │ │ $150.00            │              │
│   └────────────┘ └────────────────────┘              │
│                                                      │
│ ③ 紹介した人リスト                                   │
│   login_id  | プラン  | 入会日                       │
│   ──────────|─────────|──────────────                │
│   abc123    | $34     | 2026/01/10                   │
│   def456    | $67     | 2026/02/15                   │
│   （紹介実績なしの場合は "まだいません" メッセージ）   │
│                                                      │
│ ④ 報酬履歴                                           │
│   日時        | 金額   | メモ                         │
│   ────────────|────────|────────────                 │
│   2026/01/10  | $6.80  | childRow=... base=...       │
│   （履歴なしの場合は "まだありません" メッセージ）      │
└──────────────────────────────────────────────────────┘
```

### データフェッチのタイミング
- カードの「開く」ボタン押下時に初回 fetch
- 以降はキャッシュ（再開閉しても再 fetch しない）
- ローディング中はスケルトン表示

### auth からの id/code 取得
既存 `ReferralCard` と同じパターン：
- `id`: `auth.id || auth.loginId || auth.login_id`
- `code`: `getAuthSecret()` → sessionStorage から取得

---

## CLAUDE.md への追記

実装完了後、CLAUDE.md の GAS actions テーブルに以下を追記する：

| `my_referral_dashboard` | `/api/referral/dashboard` (POST) | 自分が紹介した人リスト＋報酬履歴を返す |

---

## 制約・注意点

- `name`（氏名）は返却データに含めない（プライバシー）
- `wallet_ledger` が存在しない環境でも壊れない
- 既存の `ReferralCard` の紹介コード表示・コピー機能は完全に維持する
- GAS の既存 action は一切変更しない（追加のみ）
- Next.js の既存 API route は変更しない（新規追加のみ）
- `/top/page.tsx` の `ReferralCard` 関数は新しい `ReferralDashboardCard` に置き換えるが、呼び出し側（`<ReferralCard auth={auth} />`）の行のみ変更

---

## 除外スコープ（今回対象外）

- 紹介ツリーの可視化（管理者向け `TreeTab` が既存）
- 紹介報酬のリアルタイム計算・再計算
- 紹介コードの変更機能
- push 通知・メール通知

---

## 実装状況（2026-05-08）

### 完了タスク

| タスク | ファイル | コミット | 備考 |
|--------|---------|---------|------|
| GAS `my_referral_dashboard` action 追加 | `gas/Code.gs` | `5b66cc3` | |
| Next.js プロキシルート新規作成 | `app/api/referral/dashboard/route.ts` | `272d588` | |
| `/top` UI を `ReferralDashboardCard` に置き換え | `app/top/page.tsx` | `eb60134` | |
| CLAUDE.md GAS actions テーブル更新 | `CLAUDE.md` | `a6091c8` | |

### 実装時の修正事項（設計からの差分）

#### GAS: `ensureCols_` 呼び出し順序
設計書のコード例では `ensureCols_` を `sheet.getDataRange().getValues()` より前に呼んでいたが、実際には先にデータを取得してヘッダーを `ensureCols_` に渡す必要がある。  
修正: `values_rd` / `header_rd` を取得 → `ensureCols_(sheet, header_rd, [...])` → 再フェッチ（`ensureCols_` でカラムが追加された場合に対応）。

#### GAS: referrals に `approved` 以外を含めない
設計書では `referrer_login_id == myLoginId` のフィルターのみ記載されていたが、`pending_payment` 等の未承認ユーザーを除外する必要がある。  
修正: referrals 収集ループ内に `if (status !== "approved") continue;` を追加。

#### API ルート: TypeScript 型ナローイング
`Extract<GasDashboardResponse, { ok: false }>` の二重キャストは不要。  
修正: `if (!gasRes.ok)` で discriminated union を自然にナローイングするよう変更。

### 残り作業

| 作業 | 担当 | 内容 |
|------|------|------|
| GAS デプロイ | ユーザー（手動） | script.google.com で `gas/Code.gs` を最新版にデプロイ |
| E2E テスト | ユーザー | `/top` の紹介カードを展開し、各セクションが正常に表示されることを確認 |
