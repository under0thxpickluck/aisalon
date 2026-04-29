# LIFAI アフィリエイト機能 現状仕様書

作成日: 2026-04-29

---

## 0. 全体像

ユーザーが自分の紹介コードを他人に渡し、そのコードを使って新規ユーザーが入会すると  
紹介者（最大5段まで）に EP が付与される仕組み。

ルートは2系統あり、データストア・配当計算・コードフォーマットがそれぞれ独立している。

| ルート | 対象ページ | スプレッドシート |
|---|---|---|
| メイン LIFAI | `/purchase` → `/apply` → `/confirm` | メイン applies シート |
| /5000 ルート | `/5000` → `/5000/apply` → `/5000/confirm` | 5000専用シート (`SPREADSHEET_5000_ID`) |

---

## 1. 紹介コード

### 1-1. コード形式

| ルート | 形式 | 例 | 生成タイミング |
|---|---|---|---|
| メイン | `R-{login_id}` | `R-lifai_ABC123` | 承認時・login_id 確定後に自動生成 |
| /5000 | `5K` + 英数6文字 | `5KAB2C3D` | 承認時・`generateRefCode5000_()` で生成（衝突チェックあり） |

使用文字セット（/5000）: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（O/0/I/1 を除外）

### 1-2. 保存列（applies シート）

| 列名 | 内容 |
|---|---|
| `my_ref_code` | **自分の**紹介コード（他人に渡す） |
| `ref_code` / `ref_id` | 申請時に**入力した**紹介コード（参照元） |
| `referrer_login_id` | 1段目紹介者の login_id |
| `referrer_2_login_id` | 2段目 |
| `referrer_3_login_id` | 3段目 |
| `referrer_4_login_id` | 4段目（bunpai.md v2 で追加定義済み） |
| `referrer_5_login_id` | 5段目（同上） |
| `ref_path` | チェーン可視化文字列（例: `A→B→C→自分`） |
| `affiliate_granted_at` | アフィリエイトEP付与完了タイムスタンプ（冪等ガード） |

### 1-3. 紹介コードの流れ

```
1. 既存ユーザーが my_ref_code を受け取る
2. 新規ユーザーが /purchase?refCode=XXX or /5000?refCode=XXX でアクセス
3. refCode は sessionStorage に保存（キー: addval_apply_draft_v1 / 5000_ref_code）
4. 申請フォーム送信時に ref_code / ref_id として GAS に送られる
5. 承認時に resolveRefChain_() が ref_code → referrer_login_id 1〜5 を解決
6. ref_events シートに監査ログを記録
7. アフィリエイトEP付与を実行
```

---

## 2. 紹介チェーン解決ロジック

### 2-1. `resolveRefChain_(sheet, header, usedRefCode)`

`gas/Code.gs:4658`

- `my_ref_code` が `usedRefCode` と一致する行を検索
- その行の `login_id` = ref1（直接紹介者）
- その行の `referrer_login_id` = ref2、`referrer_2_login_id` = ref3（親を引き継ぐ方式）
- 現在の戻り値: `{ ref1_login_id, ref2_login_id, ref3_login_id }`
- bunpai.md v2 では 5段に拡張予定（`ref4_login_id`, `ref5_login_id` を追加）

### 2-2. 監査ログ `ref_events` シート

`gas/Code.gs:4696` `appendRefEvent_()`

| 列 | 内容 |
|---|---|
| `ts` | 記録時刻 |
| `new_login_id` | 新規ユーザーの login_id |
| `new_email` | 新規ユーザーのメール |
| `used_ref_code` | 使用した紹介コード |
| `ref1_login_id` | 1段目紹介者 |
| `ref2_login_id` | 2段目紹介者 |
| `ref3_login_id` | 3段目紹介者 |
| `note` | 呼び出し元識別 |

---

## 3. アフィリエイト EP 付与

### 3-1. 現行実装（メイン LIFAI）

`gas/Code.gs:4267` `grantReferralBonusOnce_()` — **旧方式・まだ本番稼働中**

- **段数: 1段のみ**（直接紹介者にのみ付与）
- 基準: `expected_paid`（USD）
- 報酬率: `ref_share_pct`（applies シートの列、管理者が **手動で** 20 or 40 を入力）
- 計算: `bonus = expected_paid × ref_share_pct / 100`（USD単位）
- 記録先: `wallet_ledger` シート（`kind = "referral_bonus"`）
- 二重付与防止: `ref_bonus_granted_at` 列にタイムスタンプ済みなら skip
- 備考: `ref_share_pct` が 20 または 40 以外の場合は付与しない（エラー: `ref_share_pct_invalid`）

### 3-2. 設計中実装（メイン LIFAI v2）

`docs/bunpai.md` — **仕様確定済み・未実装**

- **段数: 最大5段**
- 基準: `amount_usd`（支払い金額）
- 報酬率: `system_settings` シートから動的取得（管理者が GAS 再デプロイなしに変更可）

| 段 | 列名 | デフォルト報酬率 |
|---|---|---:|
| 1段目 | `referrer_login_id` | 10% |
| 2段目 | `referrer_2_login_id` | 5% |
| 3段目 | `referrer_3_login_id` | 2% |
| 4段目 | `referrer_4_login_id` | 2% |
| 5段目 | `referrer_5_login_id` | 1% |

- 換算レート（`system_settings`）:
  - `usd_to_jpy`: 145（固定）
  - `ep_per_jpy`: 4 EP/円
- 計算式: `reward_ep = floor(amount_usd × usd_to_jpy × rate_pct/100 × ep_per_jpy)`
- 例（$1000 プラン、1段目 10%）: `1000 × 145 × 0.10 × 4 = 58,000 EP`
- 記録先: `wallet_ledger`（`kind = "affiliate_reward"`）
- 二重付与防止: `affiliate_granted_at` 列
- 新関数名: `grantAffiliateEp_(sheet, header, idx, childRowIndex, amountUsd, note)`

### 3-3. 現行実装（/5000 ルート）

`gas/Code.gs:3934` `approveRowCore5000_()` — **本番稼働中**

- **段数: 最大5段**
- 基準: `plan` 額（USD: 500 / 2000 / 3000 / 5000）
- 報酬率（ハードコード）:

| 段 | 報酬率 |
|---|---:|
| 1段目 | 10% |
| 2段目 | 5% |
| 3段目 | 2% |
| 4段目 | 2% |
| 5段目 | 1% |

- 計算: `commission = entryAmount × rate`（USD単位・小数点2桁で丸め）
- 例（$5000 プラン）: 1段目 $500 / 2段目 $250 / 3段目 $100 / 4段目 $100 / 5段目 $50
- 記録先: **5000専用スプレッドシート**の `ledger_YYYY_MM` シート（メインの `wallet_ledger` とは別）
- 二重付与防止: `referral_processed_at` 列
- タイミング: 管理者が `admin_approve_5000` を実行したとき（手動承認）

`ledger_YYYY_MM` シートの列:
| 列 | 内容 |
|---|---|
| `created_at` | 記録時刻 |
| `to_login_id` | 受取人の login_id |
| `type` | `"referral_entry"` |
| `amount_usd` | コミッション額（USD） |
| `from_apply_id` | 発生源の apply_id |
| `level` | 段（1〜5） |
| `memo` | 人間可読メモ（例: `$5000 plan 1st level 10%`） |

---

## 4. wallet_ledger シート（メイン）

`gas/Code.gs:4488` `appendWalletLedger_()`

| 列 | 内容 |
|---|---|
| `ts` | 記録時刻 |
| `kind` | トランザクション種別 |
| `login_id` | 対象ユーザー |
| `email` | 対象メール |
| `amount` | 金額（旧: USD / 新v2: EP） |
| `memo` | 付加情報（旧: `childRow=X base=Y pct=Z` / 新v2: JSON） |

現在存在する `kind` 値:
- `referral_bonus` — 旧アフィリエイト（USD単位・1段のみ）
- `affiliate_reward` — 新アフィリエイト（EP単位・5段、**未実装**）
- `market_buy`, `market_sell`, `market_auto_confirm` — マーケット取引
- `music_boost_ep`, `music_boost_ep_renew` — ミュージックブースト
- `gift_send`, `gift_send_rollback` — ギフト送受

---

## 5. ユーザー向け現行 UI

### 5-1. `ReferralCard`（`/top` ページ）

`app/top/page.tsx:172`

- `/api/me` を POST 呼び出し（`{ id, code, group }`）
- GAS `me` action が返す値:
  ```json
  {
    "my_ref_code": "R-lifai_ABC123",
    "ref_path": "A → B → 自分",
    "referrer_login_id": "lifai_XXX",
    "referrer_2_login_id": "",
    "referrer_3_login_id": ""
  }
  ```
- 表示内容: 自分の紹介コード + コピーボタン + 共有リンクコピーボタン
- 共有リンク形式:
  - メイン: `https://lifai.vercel.app/purchase?refCode=R-lifai_ABC123`
  - /5000: `https://lifai.vercel.app/5000?refCode=5KAB2C3D`

### 5-2. 不足している機能（ミニアプリ実装の目標）

現時点でユーザーが確認**できない**情報:
- 自分のコードで入会した人の一覧（何人紹介したか）
- 各紹介者の入会日・プラン
- 各紹介からいくら EP が付与されたか・いつ付与されたか
- 自分の紹介ツリー（2段目・3段目まで誰がいるか）

---

## 6. 管理者向け現行 UI

### 6-1. アフィリエイトタブ（`/admin/finance`）

`app/admin/finance/AffiliateTab.tsx`

- `/api/admin/wallet-ledger` → GAS `wallet_ledger_all` → `kind === "affiliate_reward"` でフィルタ
- 表示: 受取人 login_id・段・USD額・EP額・日時
- サマリ: 総付与 EP / 対象ユーザー数 / 最終付与日
- 備考: 旧方式の `referral_bonus` は **表示されない**（フィルタ外）

### 6-2. 紹介ツリー表示（`/admin/finance`）

`app/admin/finance/TreeTab.tsx`

- GAS `ref_tree_build` → `ref_tree` シートを全消し→再生成
- L1（直紹介あり） → L2 → L3 の3段インデント表示
- 各ユーザー: login_id / email / `ref_share_pct` / 配当合計 / 直紹介人数
- ドラッグ&ドロップで紹介者を変更 → `ref_reassign` アクション呼び出し

### 6-3. /5000 管理パネル（`/5000/admin`）

`app/5000/admin/page.tsx`

- 承認待ちリスト表示
- 「承認」ボタン → `admin_approve_5000` → メール + 紹介チェーン5段コミッション付与

---

## 7. GAS アクション一覧（アフィリエイト関連）

| action | API ルート | 内容 |
|---|---|---|
| `me` | `/api/me` | ユーザーの `my_ref_code` / `ref_path` / `referrer_*` を返す |
| `admin_list` | `/api/admin/list` | 全申請行（`referrer_login_id`〜`ref_share_pct` 含む）を返す |
| `wallet_ledger_all` | `/api/admin/wallet-ledger` | `wallet_ledger` シート全行を返す（管理者専用） |
| `ref_tree_build` | 管理者メニュー | `ref_tree` シートを全消し→再生成 |
| `ref_reassign` | `/api/admin/ref-reassign` | 紹介者変更（chain 再計算・循環防止つき） |
| `admin_approve` | `/api/admin/approve` | 承認 + EP付与 + メール送信（メイン） |
| `admin_approve_5000` | `/api/5000/admin/approve` | 承認 + 5段コミッション + メール送信（/5000） |

**ユーザー向けアフィリエイトデータ取得 API は現在存在しない。**  
ミニアプリ実装には新しい GAS action（例: `get_affiliate_stats`）が必要。

---

## 8. ミニアプリ実装に必要な新規 API（設計用メモ）

ユーザーが確認したいデータ:

```
GET /api/affiliate
  → GAS action: get_affiliate_stats
  → 認証: login_id + パスワード（me と同様）
  → 返却例:
    {
      my_ref_code: "R-lifai_ABC123",
      total_ep_earned: 58000,
      referrals: [
        {
          login_id: "lifai_XYZ",  // プライバシー上は伏字も検討
          plan: "1134",
          approved_at: "2026-03-01",
          level: 1,
          ep_granted: 58000,
          granted_at: "2026-03-01"
        },
        ...
      ]
    }
```

データソース（メイン LIFAI）:
- `applies` シートを `referrer_login_id` / `referrer_2_login_id` ... で検索
- `wallet_ledger` シートの `kind = "affiliate_reward"` を `login_id` でフィルタ

データソース（/5000）:
- `ledger_YYYY_MM` シートを `to_login_id` でフィルタ（`type = "referral_entry"`）

---

## 9. 実装状態まとめ

| 機能 | 状態 |
|---|---|
| 紹介コード生成・保存 | 本番稼働中 |
| 紹介チェーン解決（3段） | 本番稼働中 |
| 紹介チェーン解決（5段拡張） | 仕様定義済み・未実装 |
| `ref_events` 監査ログ | 本番稼働中 |
| 旧アフィリエイト配当（1段・USD・`grantReferralBonusOnce_`） | 本番稼働中 |
| 新アフィリエイトEP付与（5段・`grantAffiliateEp_`） | 仕様定義済み・未実装 |
| /5000 コミッション（5段・USD・`ledger_YYYY_MM`） | 本番稼働中 |
| ユーザー向け紹介コード表示（`ReferralCard`） | 本番稼働中 |
| **ユーザー向けアフィリエイト確認ミニアプリ** | **未実装（今回の目標）** |
| 管理者ツリー表示 | 本番稼働中 |
| 管理者アフィリエイトタブ（`affiliate_reward`） | UI実装済み・データが空（新EP未実装のため） |
