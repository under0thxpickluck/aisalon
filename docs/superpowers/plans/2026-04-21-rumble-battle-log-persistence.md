# Rumble バトルログ永続化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `rumble_battle_log` シートにバトルログを保存し、19時の抽選完了後に自動生成・翌18時にクリアすることで前日ログが確実に取得できる構造にする

**Architecture:** `rumble_spectator_` をキャッシュファースト（シート→オンザフライ生成+保存）に変更。`rumbleDailyLotteryTrigger_` 完了後に自動でspectator生成→保存。18時トリガーで古いログを削除。Next.js側・既存シート・レスポンス形式は一切変更なし。

**Tech Stack:** Google Apps Script (GAS)、Google Sheets

---

## ファイル構成

| 操作 | ファイル | 変更箇所 |
|------|----------|----------|
| 修正 | `gas/Code.gs` | ①6766行目付近にヘルパー3関数追加、②`rumble_spectator_`（8050〜8297行）の先頭とreturn直前に追記、③`rumbleDailyLotteryTrigger_`（7623〜7626行）に1行追加、④`setupRumbleTriggers_`（9471〜9496行）にトリガー追加と削除対象追加 |

---

## 重要な前提知識

- `rumble_spectator_` は `rumble_entry` シートから参加者を取得し、決定論的なバトルイベント列を生成してレスポンスする。**現状シートへの保存はしていない**。
- `rumbleDailyLotteryTrigger_` は毎日19:00〜20:00に発火し `rumbleDailyLottery_` を呼ぶ。
- `setupRumbleTriggers_` はGASエディタから手動で1回実行してトリガーを登録する関数。変更後に再実行が必要。
- GAS時間トリガーは正確な分指定ができない。`atHour(18)` = 18:00〜19:00の間に発火する。

---

## Task 1: ヘルパー関数3つを追加する

**Files:**
- Modify: `gas/Code.gs` (6766行目直後に挿入)

- [ ] **Step 1: 6766行目（`getRumbleDailyResultSheet_` 関数の閉じ括弧直後）を確認する**

`gas/Code.gs` の6761〜6766行を読んで、以下のコードの直後を挿入ポイントとして確認する:
```javascript
function getRumbleDailyResultSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_daily_result");
  if (!sheet) sheet = ss.insertSheet("rumble_daily_result");
  return sheet;
}
```

- [ ] **Step 2: 6766行目の `}` の直後に3つのヘルパー関数を挿入する**

`gas/Code.gs` の6766行目（`getRumbleDailyResultSheet_` の閉じ括弧）の直後に以下を追記:

```javascript

function getRumbleBattleLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_battle_log");
  if (!sheet) {
    sheet = ss.insertSheet("rumble_battle_log");
    sheet.appendRow(["date", "players_json", "events_json", "total", "ranking_json", "created_at"]);
  }
  return sheet;
}

function getBattleLogCache_(dateStr) {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["date"]]) === dateStr) {
      try {
        return {
          players: JSON.parse(String(data[i][idx["players_json"]] || "[]")),
          events:  JSON.parse(String(data[i][idx["events_json"]]  || "[]")),
          total:   Number(data[i][idx["total"]] || 0),
          ranking: JSON.parse(String(data[i][idx["ranking_json"]] || "[]")),
        };
      } catch(e) {
        return null;
      }
    }
  }
  return null;
}

function saveBattleLog_(dateStr, players, events, total, ranking) {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var nowJst      = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var playersJson = JSON.stringify(players);
  var eventsJson  = JSON.stringify(events);
  var rankingJson = JSON.stringify(ranking);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["date"]]) === dateStr) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, idx["players_json"] + 1).setValue(playersJson);
      sheet.getRange(rowNum, idx["events_json"]  + 1).setValue(eventsJson);
      sheet.getRange(rowNum, idx["total"]        + 1).setValue(total);
      sheet.getRange(rowNum, idx["ranking_json"] + 1).setValue(rankingJson);
      sheet.getRange(rowNum, idx["created_at"]   + 1).setValue(nowJst);
      SpreadsheetApp.flush();
      return;
    }
  }
  sheet.appendRow([dateStr, playersJson, eventsJson, total, rankingJson, nowJst]);
  SpreadsheetApp.flush();
}
```

- [ ] **Step 3: 挿入内容を読んで確認する**

挿入後のコードを読み、以下を確認:
- `getRumbleBattleLogSheet_` — シートがなければ作成しヘッダー行を書く
- `getBattleLogCache_` — dateStr に一致する行を見つけ JSON.parse して返す、なければ null
- `saveBattleLog_` — 同日行があれば上書き、なければ appendRow

- [ ] **Step 4: コミットする**

```bash
git add gas/Code.gs
git commit -m "feat(rumble): バトルログ永続化ヘルパー関数追加（getRumbleBattleLogSheet_, getBattleLogCache_, saveBattleLog_）"
```

---

## Task 2: `rumble_spectator_` をキャッシュファーストに変更する

**Files:**
- Modify: `gas/Code.gs` (8050行付近の `rumbleSpectator_` 関数)

`rumble_spectator_` 関数は8050〜8297行にある。変更は2箇所:
1. 関数冒頭（weekId取得直後）にキャッシュ読み込み処理を追加
2. return直前にキャッシュ保存処理を追加

- [ ] **Step 1: キャッシュ読み込みを関数冒頭に挿入する**

`rumbleSpectator_` の `var weekId = getWeekId_();` の直後（8053行目の直後）に以下を挿入:

```javascript
  // キャッシュチェック: rumble_battle_log に保存済みデータがあれば返す
  var cachedLog = getBattleLogCache_(dateStr);
  if (cachedLog) {
    var cachedSelf = null;
    for (var ci = 0; ci < cachedLog.players.length; ci++) {
      if (cachedLog.players[ci].id === userId) {
        cachedSelf = cachedLog.players[ci];
        break;
      }
    }
    return json_({
      ok:      true,
      status:  "ready",
      date:    dateStr,
      players: cachedLog.players,
      events:  cachedLog.events,
      self:    cachedSelf,
      ranking: cachedLog.ranking,
      total:   cachedLog.total,
    });
  }
```

- [ ] **Step 2: バトルログ保存をreturn直前に挿入する**

`rumbleSpectator_` の `return json_({` の直前（8287行目の直前）に以下を挿入:

```javascript
  // バトルログをシートに保存（以降の呼び出しはキャッシュから返す）
  saveBattleLog_(dateStr, players, events, total, weekRows.slice(0, 5));
```

- [ ] **Step 3: 変更箇所を読んで確認する**

以下を確認:
- キャッシュHITのreturnと通常returnのレスポンスキーが同じ（`ok, status, date, players, events, self, ranking, total`）
- `saveBattleLog_` の引数 `weekRows.slice(0, 5)` が `ranking` に対応している（8294行の `ranking: weekRows.slice(0, 5)` と一致）
- `todayEntries.length === 0` のときは `no_data` を返して早期returnされるので、saveBattleLog_ は呼ばれない（正しい動作）

- [ ] **Step 4: コミットする**

```bash
git add gas/Code.gs
git commit -m "feat(rumble): rumble_spectator_ をキャッシュファーストに変更（rumble_battle_log シートから読み書き）"
```

---

## Task 3: `rumbleDailyLotteryTrigger_` で抽選後に自動保存する

**Files:**
- Modify: `gas/Code.gs` (7623〜7626行の `rumbleDailyLotteryTrigger_` 関数)

現在:
```javascript
function rumbleDailyLotteryTrigger_() {
  rumbleDailyLottery_({ date: getTodayJst_() });
}
```

- [ ] **Step 1: `rumbleDailyLotteryTrigger_` に spectator 自動生成を追加する**

上記関数を以下に置き換える:

```javascript
function rumbleDailyLotteryTrigger_() {
  var today = getTodayJst_();
  rumbleDailyLottery_({ date: today });
  // 抽選完了後にバトルログを生成・シートに保存（翌日以降も確実に取得できるようにする）
  rumbleSpectator_({ date: today });
}
```

- [ ] **Step 2: 変更箇所を読んで確認する**

`rumbleDailyLotteryTrigger_` が:
1. `rumbleDailyLottery_` で抽選を実行
2. `rumbleSpectator_` でバトルログを生成→`saveBattleLog_` 経由でシートに保存

の順で動くことを確認。

- [ ] **Step 3: コミットする**

```bash
git add gas/Code.gs
git commit -m "feat(rumble): 抽選トリガー完了後にバトルログを自動生成・保存"
```

---

## Task 4: 18時トリガーで古いログを削除する

**Files:**
- Modify: `gas/Code.gs` (9471〜9496行の `setupRumbleTriggers_` 関数付近)

- [ ] **Step 1: `rumbleClearOldBattleLogsTrigger_` 関数を追加する**

`setupRumbleTriggers_` 関数（9471行）の直前に以下を挿入:

```javascript
/**
 * 毎日18:00〜19:00 JST に発火。昨日より古いバトルログを rumble_battle_log から削除する。
 * 昨日・今日分は保持（前回バトルログ表示のため）。
 */
function rumbleClearOldBattleLogsTrigger_() {
  var sheet = getRumbleBattleLogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000);
  var yesterdayStr = Utilities.formatDate(yesterday, "Asia/Tokyo", "yyyy-MM-dd");
  // 末尾から走査して古い行を削除（行番号がずれないようにするため）
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idx["date"]]) < yesterdayStr) {
      sheet.deleteRow(i + 1);
    }
  }
  SpreadsheetApp.flush();
  Logger.log("[rumbleClearOldBattleLogsTrigger_] done. yesterdayStr=" + yesterdayStr);
}
```

- [ ] **Step 2: `setupRumbleTriggers_` を更新する**

`setupRumbleTriggers_` 関数内のトリガー削除ロジック（9476行）を以下に変更（`rumbleClearOldBattleLogsTrigger_` を追加）:

変更前:
```javascript
    if (name === "rumbleDailyLotteryTrigger_" || name === "rumbleWeeklyRewardTrigger_") {
```

変更後:
```javascript
    if (name === "rumbleDailyLotteryTrigger_" || name === "rumbleWeeklyRewardTrigger_" || name === "rumbleClearOldBattleLogsTrigger_") {
```

そして `setupRumbleTriggers_` の最後のトリガー登録部分（9493行の `.create();` 直後）に以下を追加:

```javascript
  // 毎日18:00〜19:00 JST に古いバトルログを削除
  ScriptApp.newTrigger("rumbleClearOldBattleLogsTrigger_")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();
```

- [ ] **Step 3: 変更後の `setupRumbleTriggers_` 全体を読んで確認する**

変更後の関数が以下の構造になっていることを確認:
```
1. 既存の3トリガーを全削除（rumbleDailyLotteryTrigger_ / rumbleWeeklyRewardTrigger_ / rumbleClearOldBattleLogsTrigger_）
2. 19時トリガー: rumbleDailyLotteryTrigger_
3. 金曜23時トリガー: rumbleWeeklyRewardTrigger_
4. 18時トリガー: rumbleClearOldBattleLogsTrigger_（新規）
```

- [ ] **Step 4: コミットする**

```bash
git add gas/Code.gs
git commit -m "feat(rumble): 18時トリガーで古いバトルログを自動削除（rumbleClearOldBattleLogsTrigger_追加）"
```

---

## 実装完了後の手順（GASエディタで実施）

実装をGASにデプロイした後、以下を1回実行する:

1. GASエディタを開く
2. 関数ドロップダウンから `setupRumbleTriggers` を選択して実行
3. トリガー一覧（メニュー → トリガー）で以下3つが登録されていることを確認:
   - `rumbleDailyLotteryTrigger_` — 毎日19時
   - `rumbleWeeklyRewardTrigger_` — 毎週金曜23時
   - `rumbleClearOldBattleLogsTrigger_` — 毎日18時（新規）

---

## 注意事項

- `setupRumbleTriggers_` は手動で再実行しないと新しい18時トリガーが登録されない
- `rumble_battle_log` シートは初回 `rumble_spectator_` 呼び出し時に自動作成される
- キャッシュがある日は `rumble_entry` を読まずにシートから返すため、GASの呼び出し回数が減りパフォーマンスも向上する
