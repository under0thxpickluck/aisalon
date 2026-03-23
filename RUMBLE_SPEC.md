# Rumble League 仕様書

## 概要

Rumble League は LIFAI メンバー向けのウィークリーバトルランキングミニゲームです。
月〜金の5日間、毎日100BPを消費してバトルに参加し、累計RPで週次ランキングを競います。

---

## ゲームサイクル

| タイミング | イベント |
|---|---|
| 月〜金 毎日 | ユーザーがバトル参加（1日1回、100BP）|
| 金曜終了後 | 管理者が週次報酬配布を手動実行 |
| 翌月曜 | 新しい weekId でランキングリセット |

---

## weekId の形式

`YYYY-WNN`（例: `2026-W13`）— ISO週番号ベース、月曜始まり。

---

## スコア計算

```
score = 100 + (level × 2) + 装備ボーナス合計 + random(0〜50)
rp    = score
```

- **level**: `applies` シートの `level` 列（デフォルト1）
- **装備ボーナス**: 装着中の全装備の `bonus` 合計
- **random**: 0〜50の一様乱数

---

## 週次報酬

| 順位 | EP報酬 |
|---|---|
| 1位 | 1,500 EP |
| 2位 | 1,000 EP |
| 3位 | 700 EP |
| 4〜10位 | 400 EP |
| 11〜50位 | 80 EP |
| 51〜100位 | 10 EP |

---

## シート構成

| シート名 | 用途 |
|---|---|
| `applies` | ユーザーデータ（`bp_balance`, `ep_balance`, `level`, `rumble_display_name` 等）|
| `rumble_entry` | 日次バトル参加ログ（`uuid`, `user_id`, `date`, `score`, `rp`, `created_at`）|
| `rumble_week` | 週間累計RP（`user_id`, `week_id`, `total_rp`, `updated_at`）|
| `rumble_equipment` | 装備データ（`item_id`, `user_id`, `slot`, `rarity`, `name`, `bonus`, `equipped`, `enhance_level`, `luck`, `stability`, `created_at`）|

---

## GAS アクション一覧（Rumble関連）

| action | 認証 | 説明 |
|---|---|---|
| `rumble_entry` | `key` | バトル参加（100BP消費・1日1回）|
| `rumble_status` | `key` | 本日参加状況・週間RP取得 |
| `rumble_ranking` | `key` | 週間ランキング取得（`display_name` 含む）|
| `rumble_my_rank_context` | `key` | 自分の順位・周辺ランキング取得 |
| `rumble_gacha` | `key` | 装備ガチャ（100BP）|
| `rumble_equipment` | `key` | 装備一覧取得 |
| `rumble_equip` | `key` | 装備装着切り替え |
| `rumble_dismantle` | `key` | 装備分解 → shard 獲得 |
| `rumble_enhance` | `key` | 装備強化（shard消費）|
| `rumble_shard_status` | `key` | upgrade_shard 残高確認 |
| `rumble_set_display_name` | `key` | 表示名設定（16文字以内、禁止文字: `<>"'&\/`）|
| `rumble_force_entry` | `key` + `adminKey` | 強制バトル参加（BP消費なし・管理者専用）|
| `rumble_reward_distribute` | `key` | 週次報酬配布（`weekId` 省略で今週）|

---

## Next.js API ルート一覧（Rumble関連）

| パス | メソッド | 説明 |
|---|---|---|
| `/api/minigames/rumble/entry` | POST | バトル参加 |
| `/api/minigames/rumble/status` | GET | 参加状況確認 |
| `/api/minigames/rumble/ranking` | GET | ランキング取得 |
| `/api/minigames/rumble/my-rank-context` | GET | 自分の順位コンテキスト |
| `/api/minigames/rumble/gacha` | POST | 装備ガチャ |
| `/api/minigames/rumble/equipment` | GET | 装備一覧 |
| `/api/minigames/rumble/equip` | POST | 装備装着 |
| `/api/minigames/rumble/dismantle` | POST | 装備分解 |
| `/api/minigames/rumble/enhance` | POST | 装備強化 |
| `/api/minigames/rumble/shard-status` | GET | shard残高 |
| `/api/minigames/rumble/set-name` | POST | 表示名設定 |
| `/api/minigames/rumble/force-entry` | POST | 強制バトル参加（管理者、Basic Auth保護）|
| `/api/admin/rumble-reward` | POST | 週次報酬配布（管理者、Basic Auth保護）|

---

## 装備レアリティ・排出率

| レアリティ | 排出率 |
|---|---|
| Common | 80% |
| Rare | 15% |
| Epic | 4% |
| Legendary | 0.9995% |
| Mythic | 0.0005% |

---

## 表示名機能

- `applies` シートの `rumble_display_name` 列に保存
- バリデーション: 16文字以内、禁止文字 `< > " ' & \ /` を含まない
- ランキング・周辺プレイヤー表示で `display_name || user_id` を使用
- フロントは `localStorage` キー `rumble_display_name_{userId}` にキャッシュ

---

## 管理者操作

### 強制バトル参加
- `/admin` ページ → 「Rumble League 管理」セクション → 強制バトル参加
- ログインIDを入力して「実行」
- BP消費なし・参加済みチェックなし

### 週次報酬配布
- `/admin` ページ → 「Rumble League 管理」セクション → 週次報酬配布
- weekId 省略で今週のデータを対象
- **二重付与チェックなし** — 金曜終了後に1回のみ実行すること

---

## 注意事項

- 週次報酬配布は二重付与防止なし。管理者が毎週金曜終了後に1回だけ実行する運用ルールで管理。
- `rumble_force_entry` は GAS 側で `adminKey` チェックあり（`ADMIN_SECRET`）。
- ランキングは上位100位まで返却（`rumbleRanking_` の `slice(0, 100)`）。
