# Music Boost 自動更新 設計書

**日付:** 2026-04-12  
**目的:** Music Boost の EP 決済を期限到来時に自動更新する。残高不足の場合はブーストを失効させメールで通知する。

---

## アーキテクチャ

**変更対象:** `gas/Code.gs` のみ。Next.js 側は変更なし。

| 追加要素 | 説明 |
|---|---|
| `musicBoostAutoRenew_()` | 自動更新メイン関数 |
| GAS 時間ベーストリガー | 毎日深夜 0 時（JST）に実行 |

---

## 処理フロー

```
毎日 0:00 JST
  └─ musicBoostAutoRenew_()
       └─ music_boost シートをスキャン
            └─ status="active" かつ expires_at <= nowJst の行を対象に
                 ├─ EP残高 >= epCost
                 │    ├─ mktAdjustEp_() で EP 差引
                 │    ├─ 旧行: status → "expired"
                 │    └─ 新行: status="active", expires_at = nowJst + 30日
                 └─ EP残高 < epCost
                      ├─ 旧行: status → "expired"
                      └─ MailApp.sendEmail() で失敗メール送信
```

---

## データ変更

### music_boost シート
- 新ステータス `expired` を追加（`active` / `canceled` に加えて）
- スキーマ変更なし（status カラムは既存）

---

## 更新ロジック詳細

1. `music_boost` シート全件取得
2. `status === "active"` かつ `expires_at <= nowJst` の行を抽出
3. 各行に対して:
   - `MUSIC_BOOST_PLANS` から `plan_id` でプランを検索
   - `epCost = plan.price * 100`
   - `applies` シートから `login_id === user_id` の行を検索し `ep_balance` と `email` を取得
   - **EP 十分:** `mktAdjustEp_(userId, email, -epCost, "music_boost_ep_renew", "Music Boost 自動更新")` → 旧行 `expired` → 新行 `active`（+30日）
   - **EP 不足:** 旧行 `expired` → 失敗メール送信

---

## メール仕様（EP不足時）

- **件名:** `【LIFAI】Music Boost の自動更新ができませんでした`
- **送信先:** `applies` シートの `email`
- **本文:**
  ```
  Music Boost の自動更新ができませんでした。

  プラン: {plan.label}（{plan.percent}%）
  必要 EP: {epCost} EP
  現在の EP 残高: {userEp} EP

  EP をチャージして再度ご契約いただけます:
  https://lifai.vercel.app/music-boost
  ```

---

## トリガー設定

Apps Script エディタで以下のトリガーを手動設定:
- 関数: `musicBoostAutoRenew_`
- イベントの種類: 時間ベース
- 時間の間隔: 日付ベースのタイマー
- 時刻: 深夜 0 時〜1 時

---

## エラーハンドリング

- `MUSIC_BOOST_PLANS` に存在しない `plan_id` の場合はスキップ（ログのみ）
- `mktAdjustEp_` が失敗した場合は旧行を `expired` に変更せず次の行へ（二重差引防止）
- `MailApp.sendEmail` が失敗してもブーストの失効は続行（メール失敗でロールバックしない）
- 処理全体は try/catch で保護し、エラーは `console.error` で記録

---

## 対象外

- フロントエンド側の変更（失効時は現在と同様「契約なし」表示、メールで通知済みのため）
- 更新成功メール（不要）
- 複数プランの同時更新（1ユーザー1アクティブの既存仕様を維持）
