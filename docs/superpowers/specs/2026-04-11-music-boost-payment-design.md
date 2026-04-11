# Music Boost EP決済・管理画面強化 設計書

作成日: 2026-04-11

## 概要

Music Boost に EP決済フローを接続する。あわせてクレジットカード（準備中）ボタンの追加、決済前の注意確認モーダル、管理画面の会員一覧への Music Boost 列追加・サーバーサイドソート対応を行う。

**方針：既存コード・API・シート構造は壊さない。追加のみ。**

---

## 変更スコープ

| 対象ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | `music_boost_subscribe` にEP差引追加、`admin_get_members` にBoost結合・ソート追加 |
| `app/music-boost/page.tsx` | EP残高取得、確認モーダル追加、決済ボタン2種追加 |
| `app/api/music-boost/subscribe/route.ts` | `paymentMethod` パラメータを GAS に転送 |
| `app/api/admin/members/route.ts` | `sortKey` / `sortOrder` を GAS に転送 |
| `app/admin/page.tsx` | MemberRow に boost 列追加、ヘッダークリックでソート、boost列表示 |

---

## 1. EP決済フロー（フロント: `app/music-boost/page.tsx`）

### 1-1. EP残高の取得・表示

- ページ読み込み時（`userId` が確定後）に `GET /api/wallet/balance?id={userId}` を呼ぶ
- レスポンスの `ep_balance` を state として保持
- ページ上部の説明エリアに「現在のEP残高: XXX EP」を表示する

### 1-2. プラン展開エリアのボタン変更

現在：`selected === plan.id` のとき「プランを契約」ボタン1つ

変更後：2つのボタンを縦並びで表示

```
[EPで支払う（XXX EP）]   ← 通常ボタン（EP不足時はdisabled + "EP不足"表示）
[クレジットカード 準備中]  ← 常にdisabled、グレーアウト
```

- EP費用 = `plan.price × 100`（例：Starter $9 → 900 EP）
- EP残高が費用未満のときは「EPで支払う」ボタンを disabled にし、テキストを「EP不足（残り XXX EP）」とする

### 1-3. 確認モーダル（新規追加）

「EPで支払う」ボタンを押すと、契約APIを直接呼ぶのではなく確認モーダルを開く。

**モーダルの内容：**
- タイトル：「ご確認ください」
- プラン名・ブースト率
- 費用：`plan.price × 100 EP`（例：900 EP）
- 有効期間：30日間（期限：`今日 + 30日` を `YYYY/MM/DD` 形式で表示）
- 注意文（必須表示）：
  > ⚠️ 本機能は収益・利益を保証するものではありません。  
  > Music Boost は認知拡大を目的とした広告サービスです。  
  > 期限到来後は自動更新されません。
- ボタン：「確認して支払う」／「キャンセル」

「確認して支払う」を押したときに既存の `handleSubscribe` ロジックを呼ぶ（paymentMethod: "ep" を追加）。

---

## 2. API ルート変更

### `app/api/music-boost/subscribe/route.ts`

- リクエストボディに `paymentMethod` を追加で受け取り、GAS へそのまま転送する
- 既存の `userId` / `planId` の処理・バリデーションは変更しない

### `app/api/admin/members/route.ts`

- クエリパラメータ `sortKey` / `sortOrder` を受け取り、GAS POST body に追加して転送する
- 既存の `page` / `pageSize` の処理は変更しない

---

## 3. GAS 変更（`gas/Code.gs`）

### 3-1. `music_boost_subscribe_` の変更

変更箇所：枠チェック通過後、新規行追加の前に EP 差引処理を挿入する。

**追加ロジック（paymentMethod === "ep" のとき）：**

```
epCost = plan.price * 100
// applies シートから userId の ep_balance を取得
// ep_balance < epCost なら { ok: false, error: "insufficient_ep", balance: N, needed: epCost } を返す
// mktAdjustEp_(userId, email, -epCost, "music_boost_ep", "Music Boost " + planId + " EP支払い") を呼ぶ
```

- `mktAdjustEp_` は既存関数をそのまま使う（追加・変更なし）
- wallet_ledger に `kind: "music_boost_ep"` で自動記録される
- EP差引に失敗した場合は行追加をせずエラーを返す

**返却値の追加フィールド（paymentMethod === "ep" のとき）：**
- `ep_cost`: 差し引いたEP数
- `ep_balance_after`: 差引後のEP残高

### 3-2. `admin_get_members` の変更

**Music Boost 列の結合：**

- `admin_get_members` の approved 配列構築ループの前に `music_boost` シートを取得
- `active` なレコードの `user_id → { plan_id, expires_at }` のマップを作成
- 各 approved 行に `music_boost_plan` / `music_boost_expires_at` を付与（アクティブでなければ `null`）

**サーバーサイドソート：**

- パラメータ：`sortKey`（文字列）、`sortOrder`（`"asc"` / `"desc"`）
- 許可する `sortKey`：`created_at`, `ep_balance`, `bp_balance`, `login_streak`, `total_login_count`, `last_login_at`
- 許可リスト外のキーが来た場合は `created_at desc`（既存デフォルト）にフォールバック
- ソートは approved 配列全体に対して行い、その後 page/pageSize でスライス（既存の流れを維持）

---

## 4. 管理画面変更（`app/admin/page.tsx`）

### 4-1. `MemberRow` 型に追加

```ts
music_boost_plan?: string | null;
music_boost_expires_at?: string | null;
```

### 4-2. ソート状態の追加

```ts
const [membersSortKey,   setMembersSortKey]   = useState("created_at");
const [membersSortOrder, setMembersSortOrder] = useState<"asc"|"desc">("desc");
```

`loadMembers` 関数に `sortKey` / `sortOrder` をクエリパラメータとして追加。列ヘッダークリック時にソートキー/方向を変更し、`loadMembers(0)` を呼んで1ページ目に戻す。

### 4-3. ソート可能ヘッダーコンポーネント

`<Th>` の代わりにクリッカブルな `<SortTh>` を作成（既存の `<Th>` は変更しない）。

```tsx
// ソートキーを受け取り、現在のソート状態に応じて ▲▼ を表示するヘッダー
function SortTh({ sortKey, label, ... })
```

### 4-4. Music Boost 列の追加

- ヘッダー：「Music Boost」（ソートなし列）
- 行：`m.music_boost_plan` が `null` なら「—」、あれば「プラン名 / 期限 MM/DD」を表示
- アクティブなブーストは緑系バッジで表示

### 4-5. ソート可能列

以下の列を `<SortTh>` に変更する（他の列は既存の `<Th>` のまま）：

| 列 | sortKey |
|---|---|
| BP残高 | `bp_balance` |
| EP残高 | `ep_balance` |
| 連続ログイン | `login_streak` |
| 累計ログイン | `total_login_count` |
| 最終ログイン | `last_login_at` |

---

## エラーケース

| エラー | 原因 | フロント表示 |
|---|---|---|
| `insufficient_ep` | EP残高不足 | 「EPが不足しています（残り XXX EP、必要 XXX EP）」 |
| `no_slots_available` | 全体枠不足 | 既存の表示を維持 |
| `invalid_plan` | 不正なプランID | 「エラー: invalid_plan」 |

---

## 変更しないもの

- `music_boost_cancel_`・`musicBoostStatus_`・`musicBoostAdminList_` は変更なし
- `/api/music-boost/status`・`/api/music-boost/cancel`・`/api/music-boost/admin` は変更なし
- 既存の `handleCancel`・チュートリアル・プラン一覧レンダリングロジックは変更なし
- `mktAdjustEp_` は変更なし（呼ぶだけ）
- `admin_get_members` の既存返却フィールドは変更なし（追加のみ）
