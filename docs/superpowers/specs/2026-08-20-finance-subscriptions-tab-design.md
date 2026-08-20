# 財務管理「サブスク」タブ 設計メモ

作成日: 2026-08-20

## 目的

管理者が「誰が・いつから・どのサブスクを使っているか」を財務管理画面から一覧で確認できるようにする。

## 前提調査でわかったこと

- **稼働している定期課金は Music Boost だけ。**
  `applies` シートには `subscription_plan` / `subscription_status` / `subscription_started_at` / `subscription_period_end`
  というカラムがあるが、`gas/Code.gs` 内に書き込み処理が一切なく全行が空。読み出しのみ実装されているため、
  管理画面のサブスク列は常に `free` を表示していた。今回の一覧では扱わない。
- Music Boost の契約は `music_boost` シートに 1契約 = 1行 で蓄積されている
  （`id / user_id / plan_id / percent / price_usd / slots_used / status / started_at / expires_at / canceled_at / updated_at`）。
- GAS には管理者向けの `music_boost_admin_list` が既にあり、Next.js からは `/api/music-boost/admin` で叩けていた。
- ただし `/api/music-boost/admin` は `/api/admin/*` の外にあるため **`middleware.ts` の Basic 認証がかからない**。
  未認証で全契約者の login_id・プラン・金額が取得できる状態（今回は既存動作を壊さないため触っていない。別途対応を検討）。

## 構成

### 1. `app/lib/music-boost-plans.ts`（新規）

プラン定義の唯一の情報源。`app/music-boost/page.tsx` と管理API の両方が参照する。
GAS の `MUSIC_BOOST_PLANS` とは自動同期されないため、価格変更時は手動で合わせる。

### 2. `app/api/admin/subscriptions/route.ts`（新規・GET）

`/api/admin/*` 配下なので Basic 認証がかかる（未認証は 401）。

- GAS の `music_boost_admin_list`（契約一覧）と `admin_list`（ユーザー名簿）を並列で呼ぶ
- `login_id` で結合し、名前・メールを付与する
- `admin_list` が失敗しても一覧は返す（`summary.names_joined: false` で画面に注意書きを出す）
- 集計（`active_count` / `mrr_jpy` / 枠情報）をサーバー側で計算して返す

**月額は `plan_id` から現在のプラン表を引いて算出する。**
`music_boost` シートの `price_usd` 列は 2026-08 の円建て改定より前の行がドル建て（9, 29…）、
以降の行が円建て（1440, 4640…）で混在するため、そのまま表示すると桁が揃わない。

### 3. `app/admin/finance/SubscriptionsTab.tsx`（新規）

- サマリカード: 契約中件数 / 月額合計（MRR） / 使用枠 / 空き枠
- フィルタ: 契約中 / 期限切れ / 解約 / 全件（デフォルトは契約中）
- 検索: 名前・login_id・メール・プラン名
- テーブル: ユーザー（名前＋login_id）/ メール / プラン＋ブースト率 / 月額 / 枠 / 状態 / 開始日 / 期限 / 残日数
  - 状態バッジを色分け（契約中=緑・期限切れ=グレー・解約=赤）
  - 残り7日以内はアンバーで強調
  - 解約行は期限日ではなく解約日を表示
  - ユーザー / プラン / 月額 / 状態 / 開始日 / 期限 でソート可
- フッターに「表示中N件 / 月額合計」を出し、絞り込み条件ごとの金額が見えるようにする

### 4. `app/admin/finance/page.tsx`（変更）

タブ配列に `subscriptions`（ラベル「サブスク」）を追加。既存タブは変更しない。

### 5. `gas/Code.gs`（変更）

`musicBoostAdminList_` の返却値に `canceled_at` を追加。解約済み契約が「いつまで使われていたか」を出すため。
旧シートに列が無い場合を考慮し、`idx["canceled_at"] === undefined` なら空文字を返す。既存の返却フィールドは変更しない。

## 検証結果（2026-08-20 / 本番GASに対して実施）

- `GET /api/admin/subscriptions`（認証あり）→ 200 / `ok: true` / 契約20件・契約中4件・MRR ¥5,760 / 名簿結合成功
- 同エンドポイント（認証なし）→ 401
- `npm run build` 成功、`tsc --noEmit` エラーなし
- `/music-boost` が円表示（¥1,440）で 200

## お知らせ（data/notices.ts）について

本機能は管理者専用画面のためユーザーに影響がなく、お知らせの追加は行わない。
