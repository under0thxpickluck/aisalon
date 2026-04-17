# Rumble League 仕様書

## 概要

Rumble League は LIFAI メンバー向けのウィークリーバトルランキングミニゲームです。
月〜金の5日間、毎日100BPを消費してバトルに参加し、累計RPで週次ランキングを競います。
日次でBP報酬の重み付き抽選も行われます。

---

## ゲームサイクル

| タイミング | イベント |
|---|---|
| 月〜金 毎日 | ユーザーがバトル参加（1日1回、100BP）|
| 毎日 19:00 JST | 日次BP報酬抽選（GASタイムトリガー）|
| 金曜 23:00〜24:00 JST | 週次EP報酬配布（GASタイムトリガー or 管理者手動）|
| 翌月曜 | 新しい weekId でランキングリセット |

---

## weekId の形式

`YYYY-WNN`（例: `2026-W13`）— ISO週番号ベース、月曜始まり。

---

## スコア・RP計算

```
score = 100 + (level × 2) + 装備ボーナス合計 + random(0〜50)
rp    = score
```

- **level**: `applies` シートの `level` 列（デフォルト1）
- **装備ボーナス**: 装着中の全装備の `bonus` 合計（上限50）
- **random**: 0〜50の一様乱数
- RPは参加直後には詳細公開しない（観戦UIでRP詳細は非表示）

---

## 日次BP報酬（重み付き抽選）

### 概要

毎日19:00 JSTの締切後、当日の参加者を対象に重み付き非復元抽選で日次BP報酬を配布。

### 抽選ルール

- 重み: `weight = Math.floor(Math.sqrt(RP) × 1000)`（高RP有利だが確実ではない）
- 1位〜5位まで順番に抽選、当選者は都度除外
- 参加者5人未満の場合は人数に応じて縮小

### 日次BP報酬テーブル

| 順位 | BP報酬 |
|---|---|
| 1位 | 1,000 BP |
| 2位 | 700 BP |
| 3位 | 400 BP |
| 4位 | 250 BP |
| 5位 | 200 BP |

### 抽選のseed

`seed = sha256(date + RUMBLE_SALT)` で再現可能。`RUMBLE_SALT` は GAS ScriptProperties に保管、外部非公開。

### 冪等性

同日二重配布不可。rank1〜winnerCount全存在 かつ 全 `distributed=true` の場合はスキップ。

---

## 週次EP報酬

累計RP（月〜金）のランキングで配布。**参加人数に応じて報酬テーブルが変動する（合計上限700EP）。**

### 2人以下

| 順位 | EP報酬 |
|---|---|
| 1位 | 400 EP |
| 2位 | 300 EP |

### 3〜4人

| 順位 | EP報酬 |
|---|---|
| 1位 | 350 EP |
| 2位 | 230 EP |
| 3位 | 120 EP |

### 5〜9人

| 順位 | EP報酬 |
|---|---|
| 1位 | 300 EP |
| 2位 | 200 EP |
| 3位 | 120 EP |
| 4〜5位 | 40 EP |

### 10人以上

| 順位 | EP報酬 |
|---|---|
| 1位 | 280 EP |
| 2位 | 190 EP |
| 3位 | 120 EP |
| 4〜5位 | 45 EP |
| 6〜10位 | 4 EP |

> **表示仕様（2026-04-17実装）:** 月〜金曜18:50前は `📊 予測` ラベル付きで現在参加人数ベースの金額を薄表示。金曜18:50以降に `✅ 確定` ラベルに切り替わり金額がフル表示される。参加人数は `rumble_status` APIの `week_participant_count` フィールドから取得（`ranking.length` 依存を廃止）。

---

## シート構成

| シート名 | 用途 |
|---|---|
| `applies` | ユーザーデータ（`bp_balance`, `ep_balance`, `level`, `rumble_display_name` 等）|
| `rumble_entry` | 日次バトル参加ログ（`uuid`, `user_id`, `date`, `score`, `rp`, `created_at`）|
| `rumble_week` | 週間累計RP（`user_id`, `week_id`, `total_rp`, `updated_at`）|
| `rumble_equipment` | 装備データ（`item_id`, `user_id`, `slot`, `rarity`, `name`, `bonus`, `equipped`, `enhance_level`, `luck`, `stability`, `created_at`）|
| `rumble_daily_result` | 日次抽選結果（`date`, `seed`, `rank`, `user_id`, `display_name`, `rp`※内部のみ, `weight`, `bp_amount`, `distributed`, `participant_count`, `created_at`）|
| `wallet_ledger` | 金融取引履歴（rumble_daily_bp / rumble_weekly_ep を記録）|

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
| `rumble_spectator` | `key` | 観戦イベント生成（当日 rumble_entry → 演出events[]生成）|
| `rumble_daily_result` | `key` | 日次抽選結果取得（pending/ready判定）|
| `rumble_force_entry` | `key` + `adminKey` | 強制バトル参加（BP消費なし・管理者専用）|
| `rumble_reward_distribute` | `key` | 週次EP報酬配布（`weekId` 省略で今週）|

---

## GAS バグ修正（2026-04-17）

### `rumbleDateStr_(val)` ヘルパー追加

Google Sheets がセル値を Date オブジェクトに自動変換する場合、`String(val)` では正しい `"YYYY-MM-DD"` が取れない問題を修正。全 rumble 関数の日付比較に適用。

```javascript
function rumbleDateStr_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Tokyo", "yyyy-MM-dd");
  }
  return String(val);
}
```

適用箇所: `rumbleEntry_`, `rumbleStatus_`, `rumbleDailyLottery_`, `rumbleDailyResult_`, `rumbleSpectator_`, `rumbleForceStart_`

### `rumbleStatus_` の `getAppSheet_()` バグ修正

`getAppSheet_()` 未定義エラーを修正。`SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies")` に直接変更。

### `rumbleRunNow_` の `json_()` 戻り値処理修正

`json_()` が `ContentService.TextOutput` オブジェクトを返す場合に対応。`.getContent()` でパースするよう修正。

---

## GAS 主要関数

### `rumbleEntry_(params)` — バトル参加

**処理フロー:**
1. LockService（15秒）で排他制御
2. 当日参加済みチェック（二重参加禁止）
3. BP残高確認 → -100 BP
4. スコア計算（level×2 + equipBonus + random(0〜50) + 100）
5. `rumble_entry` シートに追記
6. `rumble_week` シートの週累計RP更新
7. `SpreadsheetApp.flush()` で即確定

### `rumbleDailyLottery_(date)` — 日次抽選

**処理フロー:**
1. `rumble_entry` から当日19:00 JST以前の参加者取得
2. 参加者ゼロなら終了
3. 冪等性チェック（全順位 distributed=true ならスキップ）
4. `seed = sha256(date + RUMBLE_SALT)` で xorshift RNG初期化
5. 各参加者の `weight = Math.floor(sqrt(rp) × 1000)` を計算
6. `winnerCount = Math.min(5, participants.length)` で順次抽選
7. `rumble_daily_result` に書き込み → BP付与 → `distributed=true` 更新
8. `wallet_ledger` に `rumble_daily_bp` 記録

### `rumbleSpectator_(params)` — 観戦イベント生成

**バトルは演出の事前生成であり、リアルタイムシミュレーションではない。結果はスコア順で確定済み。**

**処理フロー:**
1. 当日の `rumble_entry` を全取得
2. `applies` から `display_name` をマッピング
3. score降順でソート → rank付与
4. 人数分岐処理
5. seeded random でイベント列(events[])を生成して返却

**seededランダム:** `date + total + player.id:score...` を連結してseed生成。同一日・同一参加者なら毎回同じevents[]を返す。

**人数別演出:**

| 参加者数 | 演出 |
|---|---|
| 0人 | `status: "no_data"` 返却 |
| 1人 | intro → log（唯一の挑戦者）→ result（自動優勝）|
| 2人 | intro → battle（1本）→ result |
| 3人 | intro → battle or log → batch_eliminate（1人）→ battle → result |
| 4人以上 | 既存4波構成（wave1〜4 → TOP3決戦 → ranking → result）|

**脱落波計算（4人以上）:**
```
target3    = max(3, floor(total × 0.03))
wave1_elim = floor((total     - target3) × 0.45)
wave2_elim = floor((remaining - target3) × 0.45)
wave3_elim = floor((remaining - target3) × 0.55)
wave4_elim = remaining - 3
```
脱落順: スコア下位から（上位が生き残る）

**注目戦ロジック:**
```
playerA（攻撃側）: 自分 or TOP10 から優先選出
playerB（守備側）: 11位以下からランダム選出
damage  = floor(playerA.score / 10) + seededRandom(0〜10)
isCrit  = seededRandom() < 0.1
```

**SpectatorEvent 型定義:**
```typescript
type SpectatorEvent = {
  type:     "intro" | "batch_eliminate" | "battle" | "log" | "ranking" | "result";
  text?:    string;
  ids?:     string[];      // batch_eliminate時の脱落者ID一覧
  a?:       string;        // battle時の攻撃者ID
  b?:       string;        // battle時の防御者ID
  is_crit?: boolean;
  phase?:   string;
  delay:    number;        // ms単位（フロントでのwait時間）
};
```

**返却値:**
```json
{
  "ok": true,
  "status": "ready",
  "date": "2026-04-01",
  "players": [{ "id": "...", "display_name": "...", "score": 145, "rp": 145, "rank": 1, "is_self": false }],
  "events": [...],
  "self": { "id": "...", "display_name": "...", "score": 130, "week_rp": 430, "week_rank": 5 },
  "ranking": [{ "user_id": "...", "display_name": "...", "total_rp": 1200 }],
  "total": 42
}
```

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
| `/api/minigames/rumble/spectator` | GET | 観戦イベント取得（QueryParams: userId, date省略可, mock=1でモックデータ返却）|
| `/api/minigames/rumble/daily-result` | GET | 日次抽選結果取得（QueryParams: date省略可）|
| `/api/minigames/rumble/force-entry` | POST | 強制バトル参加（管理者、Basic Auth保護）|
| `/api/admin/rumble-reward` | POST | 週次報酬配布（管理者、Basic Auth保護）|

### GET `/api/minigames/rumble/daily-result` 返却仕様

**共通フィールド:**
```typescript
{
  status: "pending" | "ready",
  date: string,
  participant_count: number,
  winnerCount: number,
  isToday: boolean
}
```

**pending 時の追加フィールド:**
```typescript
{
  participants: Array<{ user_id: string; display_name: string }>
  // created_at昇順ソート、RP/weight非公開
}
```

**ready 時の追加フィールド:**
```typescript
{
  replay_seed: string,   // sha256ハッシュのみ（RUMBLE_SALTは絶対含めない）
  winners: Array<{ rank: number; user_id: string; display_name: string; bp_amount: number }>
  // rank昇順、rp/weightは含めない
}
```

---

## フロントエンド

### ファイル

`app/mini-games/rumble/page.tsx` — 全5タブ

### タブ構成

`"バトル" | "観戦" | "ランキング" | "装備" | "ガチャ"`

### 観戦タブ — 追加State（2026-04-17）

| 変数 | 型 | 用途 |
|---|---|---|
| `isAfter1850Jst` | `boolean` | JST 18:50以降フラグ（週次報酬表示切り替え用）|
| `prevBattleDate` | `string \| null` | 前回バトルの日付（today pending時に表示）|
| `prevDailyResult` | `DailyResultData \| null` | 前回バトルの日次抽選結果 |
| `prevSpectatorData` | `SpectatorData \| null` | 前回バトルの観戦データ |
| `prevLoading` | `boolean` | 前回バトルデータ取得中フラグ |
| `prevBattleLogs` | `{text,color,id}[]` | 前回バトルのログ |
| `prevPhase` | `"waiting" \| "live" \| "result"` | 前回バトルの再生フェーズ |
| `showBattleLogModal` | `boolean` | バトルログモーダル表示フラグ |
| `battleLogModalMode` | `"today" \| "prev"` | モーダルが今日・前回どちらを表示しているか |
| `showWinners` | `boolean` | 当選者発表セクション表示フラグ（result event到達後にtrue）|

### 観戦タブ — カウントダウン仕様

**JST基準で `YYYY-MM-DDT19:00:00+09:00` 形式で目標時刻を構築（`setHours` の擬似JST禁止）。**

| 状態 | 表示 |
|---|---|
| 平日 19:00前 | `参加受付中` / `開始まで HH:MM:SS` |
| 平日 19:00以降・再生前 | `本日の観戦データを準備中…` |
| 再生中 | `観戦中` |
| 再生終了後 | `結果確定` |
| 土日 | `次回開催は月曜19:00` |

### 観戦タブ — カウントダウン実装（Intl.DateTimeFormat 方式）

```typescript
const jstParts = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
}).formatToParts(now);
// → "YYYY-MM-DDT19:00:00+09:00" 形式でtargetDate構築
```

土日スキップも `Intl.DateTimeFormat weekday` で判定（UTC環境対応済み）。

### 観戦タブ — データ再取得条件

以下のいずれかで再取得:
1. `spectatorData === null`
2. `spectatorDate !== 今日のJST日付`
3. `spectatorData.status === "no_data"`
4. `spectatorFetchedAt === null`
5. `Date.now() - spectatorFetchedAt > 30000`（30秒経過）
6. 「最新を取得」ボタン押下

### 観戦タブ — ボタン構成

| ボタン | 動作 |
|---|---|
| `観戦スタート` | battleLogs初期化 → 全員alive → events順再生（初回用）|
| `もう一度見る` | battleLogs初期化 → 全員alive → 同じevents再生（再fetchなし）|
| `最新を取得` | API再fetch → データ更新のみ（自動再生しない）|

### 観戦タブ — キャッシュ戦略（localStorage）

| キー | 内容 | 保存タイミング |
|---|---|---|
| `rumble_spectator_{date}_{userId}` | SpectatorData | `status === "ready"` 取得時 |
| `rumble_daily_result_{date}` | DailyResultData | `status === "ready"` 取得時 |
| `rumble_entered_{userId}` | 当日JST日付文字列 | バトル参加後 / status API で確認後 |
| `rumble_display_name_{userId}` | 表示名 | 設定保存時 / status API で取得時 |

### 観戦タブ — 自動ポーリング

- `dailyResult.status === "pending"` かつ `isToday === true` の間、**5秒ごとに `daily-result` APIをポーリング**
- 参加者が増えるたびに即反映

### 観戦タブ — 前回バトル表示（pending時フォールバック）

今日の `daily-result` が `pending` の場合、過去10日を遡って最直近の `status === "ready"` な日のデータを自動取得して表示する。キャッシュ（localStorage）優先で取得。

### 観戦タブ — daily-result UI

| daily-result status | 表示 |
|---|---|
| `pending` | 参加者一覧（display_nameのみ） / 「抽選は19:00以降に実施されます」/ 前回バトル結果を別途表示 |
| `ready` | バトル演出再生完了後（result event到達後）に当選者発表セクション表示（RP/weight非表示）|

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

## GAS タイムトリガー

| 関数 | タイミング |
|---|---|
| `rumbleDailyLotteryTrigger_` | 毎日 19:00〜20:00 JST |
| `rumbleWeeklyRewardTrigger_` | 金曜 23:00〜24:00 JST |

---

## GAS ScriptProperties（Rumble関連）

| キー | 内容 |
|---|---|
| `RUMBLE_SALT` | 日次抽選seed生成用秘密鍵（外部非公開）|
| `ADMIN_SECRET` | `rumble_force_entry` の adminKey チェック用 |

---

## 管理者操作

### 強制バトル参加
- `/admin` ページ → 「Rumble League 管理」セクション → 強制バトル参加
- ログインIDを入力して「実行」
- BP消費なし・参加済みチェックなし

### 週次報酬配布
- `/admin` ページ → 「Rumble League 管理」セクション → 週次報酬配布
- weekId 省略で今週のデータを対象
- **GASタイムトリガーでも自動実行（金曜 23:00〜24:00 JST）**

---

## 注意事項

- 週次報酬配布は二重付与防止なし。タイムトリガーか管理者が毎週金曜に1回のみ実行する運用ルールで管理。
- 日次抽選は冪等（同日二重配布不可）。
- `rumble_force_entry` は GAS 側で `adminKey` チェックあり（`ADMIN_SECRET`）。
- ランキングは上位100位まで返却（`rumbleRanking_` の `slice(0, 100)`）。
- 観戦イベント(events[])は seeded random で生成されるため、同日同参加者なら「もう一度見る」でも完全一致する。
- 日次抽選結果の `rp` / `weight` はAPIレスポンスに含めない（`replay_seed` のみ公開）。
