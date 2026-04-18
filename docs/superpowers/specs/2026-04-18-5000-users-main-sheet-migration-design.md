# Design: 5000プランユーザーをメインシートで管理

**Date:** 2026-04-18

## 背景・目的

現在、5000円プランユーザーは別スプレッドシート（`SPREADSHEET_5000_ID`）の `applies` シートで管理されている。このため、占い・ガチャ・ルンブルなどすべてのGAS機能がメインシートしか参照しないため、5000ユーザーはこれらの機能を使えない。

**目標:** 入口（`/5000/` ルート）は変えず、承認後はメインの `applies` シートで管理することで全機能を使えるようにする。5000から入ったユーザーはスプレッドシート上で識別できるようにする。

## 方針

- メインの `applies` シートに `entry_source` 列を追加
- 5000プランユーザー承認時: メインシートに行を追加し `entry_source = "5000"` をセット
- ログイン時: `group:"5000"` を受け取ったらメインシートを先に検索。見つかれば `group:""` で返す（以降の全機能が通常通り動作）。メインシートに見つからなければ従来の5000シートを検索（既存ユーザー互換性）
- Next.js 側の変更は**なし**
- 5000シートは以降新規データを書かない（既存の申請・支払いレコードは残す）

## 変更スコープ

### GAS（`gas/Code.gs`）

#### 1. `approveRowCore5000_` の変更

承認処理でメインの `applies` シートに書き込む。

書き込む内容:
- `created_at`, `apply_id`, `plan`, `email`, `name`, `name_kana`
- `age_band`, `prefecture`, `city`, `job`
- `ref_name`, `ref_id`
- `status = "approved"`, `approved_at`
- `login_id`（`5k_XXXXXX` 形式をそのまま使用）
- `my_ref_code`, `reset_token`, `reset_expires`
- `bp_balance`（プランに応じた初期BP）
- `ep_balance = 0`
- `entry_source = "5000"`

既存の5000シートへの書き込み（`status`, `approved_at` など）は互換性のため残す。

#### 2. `login` action の変更

`group === "5000"` のとき:
1. メインシートで `login_id` を検索
2. 見つかれば認証処理を行い、レスポンスに `group` を含めない（空文字）
3. 見つからなければ従来通り5000シートで検索し `group: "5000"` を返す

#### 3. `ensureCols_` でメインシートに `entry_source` 列を保証

`approveRowCore_`（通常承認）の `ensureCols_` に `entry_source` を追加。通常ユーザーは値が空のまま。

### Next.js

変更なし。

## データフロー（変更後）

```
[新規5000ユーザー]
  /5000/apply → SPREADSHEET_5000_ID の applies に申請行（変更なし）
  支払い完了 or 管理者承認
    → approveRowCore5000_()
      → SPREADSHEET_5000_ID の applies に approved_at/status 書き込み（互換性のため残す）
      → メインの applies に行追加（entry_source="5000"）
  /5000/login → GAS login action（group:"5000"）
    → メインシートで発見 → group:"" で返す
    → 以降 /top のすべての機能が通常通り使える

[既存5000ユーザー（SPREADSHEET_5000_ID のみに存在）]
  /5000/login → GAS login action（group:"5000"）
    → メインシートでは見つからない
    → 5000シートで発見 → group:"5000" で返す（現状維持）
```

## 識別方法

スプレッドシート上で `entry_source` 列を `"5000"` でフィルタすることで5000プランユーザーを一覧できる。通常ユーザーはこの列が空。

## 既存ユーザーへの影響

- 既存の通常会員: 影響なし
- 既存の5000ユーザー（5000シートにいる人）: 現状維持（機能制限は残るが、移行なし）
- 今後の新規5000ユーザー: メインシートで管理され全機能使用可能

## 非スコープ

- 既存5000ユーザーのメインシートへの移行
- 管理画面での `entry_source` フィルタUI
- 5000シートの削除・アーカイブ
