# Admin Finance Page 設計仕様

**作成日:** 2026-04-26
**対象ブランチ:** feature/bunpai-affiliate（またはその後継）

---

## 0. 概要

`/admin` ページ最下部にパスワードロック付きゲートウェイを設置し、解錠後に `/admin/finance` 専用ページへ遷移する。finance ページではユーザーごとの決済・wallet動き・アフィリエイト履歴・紹介ツリーを一括管理できる。

---

## 1. ページ構成

```
/admin（既存）
└── 最下部: 🔒 財務管理ゲートウェイ
    └── パスワード入力 → 正しければ /admin/finance へ遷移

/admin/finance（新規）
├── ヘッダー（← admin に戻るリンク、ページタイトル）
├── タブ切り替え: [ユーザー詳細] [アフィリエイト] [紹介ツリー]
└── タブコンテンツ
```

### 認証フロー

1. `/admin` 最下部でパスワード入力 → `POST /api/admin/finance-unlock` に送信
2. サーバーが env var `FINANCE_UNLOCK_PASS` と照合
3. 正しければ `HMAC-SHA256(FINANCE_HMAC_SECRET, timestamp)` トークンを返す
4. クライアントが `sessionStorage["finance_token"]` に保存
5. `/admin/finance` へ遷移
6. finance ページはロード時に token を `POST /api/admin/verify-finance-token` で検証
7. 無効なら `/admin` へリダイレクト
8. ブラウザを閉じると sessionStorage がリセットされ再認証が必要

---

## 2. 新規 GAS アクション

### `wallet_ledger_all`

wallet_ledger シート全行を返す。

```js
// リクエスト
{ action: "wallet_ledger_all", adminKey: "..." }

// レスポンス
{
  ok: true,
  items: [
    { ts, kind, login_id, email, amount, memo }
  ]
}
```

### `ref_reassign`

指定ユーザーの `referrer_login_id` を更新し、`ref_events` に監査ログを記録する。

```js
// リクエスト
{
  action: "ref_reassign",
  adminKey: "...",
  targetLoginId: "U-xxxx",      // 紹介者を変更されるユーザー
  newReferrerLoginId: "U-yyyy", // 新しい紹介者（空文字列で紹介者なしに設定）
  note: "admin_finance_drag"
}

// レスポンス
{ ok: true, targetLoginId, newReferrerLoginId }
```

**処理フロー:**
1. `targetLoginId` の `referrer_login_id` を `newReferrerLoginId` に更新
2. `resolveRefChain_` を呼び出して referrer_2〜referrer_5 を再計算・更新
3. `ref_path` を再生成
4. `ref_events` に監査ログを記録

**制約:**
- `targetLoginId` が applies に存在しない場合は `{ ok: false, error: "target_not_found" }`
- `newReferrerLoginId` が自分自身の場合は `{ ok: false, error: "self_referral" }`
- 循環参照チェック（A→B→C→A になる場合はエラー）

---

## 3. 新規 Next.js API ルート

| Route | Method | 用途 |
|---|---|---|
| `/api/admin/finance-unlock` | POST | パスワード照合 → トークン返却 |
| `/api/admin/verify-finance-token` | POST | トークン検証 |
| `/api/admin/wallet-ledger` | GET | GAS `wallet_ledger_all` プロキシ |
| `/api/admin/ref-reassign` | POST | GAS `ref_reassign` プロキシ |

既存の `/api/admin/list` は流用（ユーザー詳細タブのベースデータ）。

---

## 4. タブ詳細設計

### 4-1. [ユーザー詳細] タブ

**データソース:** `/api/admin/list`（既存）+ `/api/admin/wallet-ledger`（新規）

**レイアウト:**
```
[検索バー: login_id / メール / 名前でフィルタ]

ユーザー一覧テーブル（クリックでドロワー展開）
  列: login_id / 名前 / プラン / ステータス / EP残高 / BP残高 / 承認日 / affiliate付与済み

右側ドロワー（選択ユーザーの詳細）:
  ├── 基本情報: email, plan, status, created_at
  ├── 決済状況: expected_paid, actually_paid, payment_status, invoice_id, order_id
  ├── BP/EP残高・付与情報: bp_balance, ep_balance, bp_granted_at, bp_grant_plan
  ├── 紹介情報: referrer_login_id〜referrer_5_login_id, ref_path, affiliate_granted_at
  └── wallet動き: このユーザー宛（login_id一致）の wallet_ledger 全行
      列: 日時 / kind / amount / memo
```

**インタラクション:**
- 検索はクライアント側でリアルタイムフィルタ（全データロード済み）
- ドロワーは右側からスライドイン
- ドロワー内の wallet 動きは日時降順

---

### 4-2. [アフィリエイト] タブ

**データソース:** `/api/admin/wallet-ledger`（kind=affiliate_reward でフィルタ）

**レイアウト:**
```
サマリーカード（3枚）:
  [総付与EP] [対象ユーザー数] [最終付与日]

アフィリエイト付与履歴テーブル（日時降順）:
  列: 日時 / 受取人(login_id) / 送出元(from) / レベル / USD額 / EP付与量
  ※ memo の JSON をパース: { from, level, amount_usd, rate_pct, reward_jpy }

フィルタ:
  - 受取人 login_id で絞り込み
  - レベル（1〜5）で絞り込み
```

---

### 4-3. [紹介ツリー] タブ

**データソース:** `/api/admin/list`（referrer_login_id チェーンからツリーを構築）

**レイアウト:**
```
[ルートユーザー検索] または [全体表示トグル（最大50ノード）]

SVGツリー（縦方向レイアウト）:
  各ノード（foreignObject内）:
    ┌─────────────────┐
    │ login_id        │
    │ 名前 / プラン   │
    │ EP: ○○         │
    └─────────────────│

  エッジ: 親→子を曲線で接続
  ドラッグ: ノードをドラッグして別ノードへドロップ
```

**ドラッグ&ドロップ動作:**
1. ユーザーAのノードをドラッグ開始
2. ユーザーBのノードにドロップ
3. 確認モーダル: 「**A** の紹介者を **B** に変更しますか？」
4. 確認 → `POST /api/admin/ref-reassign` 呼び出し
5. 成功 → ツリーを再描画（admin_list 再取得）
6. エラー（循環参照など）→ エラーメッセージ表示

**ツリー実装:**
- 外部ライブラリ不使用、SVG + foreignObject のカスタム実装
- レイアウトアルゴリズム: Reingold-Tilford（幅優先の簡易実装）
- HTML5 Drag API（`draggable` 属性）使用

---

## 5. 環境変数

```env
FINANCE_UNLOCK_PASS=（管理者が設定するパスワード）
FINANCE_HMAC_SECRET=（トークン署名用シークレット）
```

---

## 6. ファイル構成

**新規作成:**
```
app/admin/finance/page.tsx           — finance ページ本体
app/api/admin/finance-unlock/route.ts
app/api/admin/verify-finance-token/route.ts
app/api/admin/wallet-ledger/route.ts
app/api/admin/ref-reassign/route.ts
```

**変更:**
```
app/admin/page.tsx                   — 最下部にゲートウェイセクション追加
gas/Code.gs                          — wallet_ledger_all / ref_reassign アクション追加
```

---

## 7. 変更しないもの

- 既存の `/api/admin/list` ルート（流用）
- 既存の admin_list GAS アクション（流用）
- middleware.ts の Basic Auth 設定（/admin/* は自動保護済み）
- 既存の admin ページの全セクション（最下部への追加のみ）
