# Ramble Lottery Reform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace daily BP rewards with weighted-lottery system, add `rumble_daily_result` sheet, seed-based reproducibility, GAS time triggers, and update spectator UI to show pending participants or confirmed lottery results.

**Architecture:** All lottery logic lives in GAS (`gas/Code.gs`). A new GAS action `rumble_daily_result` surfaces the data to Next.js. A new API route (`app/api/minigames/rumble/daily-result/route.ts`) proxies to GAS. The spectator tab (`app/mini-games/rumble/page.tsx`) branches on `dailyResult.status`: "pending" shows the participant list; "ready" runs the existing battle animation then appends a winners reveal.

**Tech Stack:** Google Apps Script (GAS), Next.js 14 App Router (TypeScript), Google Sheets

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `gas/Code.gs` | Modify + Add | All lottery logic, new GAS actions, time trigger wrappers |
| `app/api/minigames/rumble/daily-result/route.ts` | Create | Proxy GET to GAS `rumble_daily_result` action |
| `app/mini-games/rumble/page.tsx` | Modify | Spectator tab UI: pending/ready branching + winners reveal |

---

## Task 1: GAS — Add sheet helper functions and RNG utilities

**Files:**
- Modify: `gas/Code.gs` (insert after line 6428, the end of `getTodayJst_`)

- [ ] **Step 1: Add helpers after `getTodayJst_` (line 6428 in Code.gs)**

Find the exact end of `getTodayJst_`:
```javascript
function getTodayJst_() {
  var now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}
```

Immediately after that closing brace, insert:

```javascript
// ============================================================
// RUMBLE DAILY LOTTERY — helpers
// ============================================================

function getRumbleDailyResultSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rumble_daily_result");
  if (!sheet) sheet = ss.insertSheet("rumble_daily_result");
  return sheet;
}

function ensureRumbleDailyResultCols_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "date","seed","rank","user_id","display_name",
    "rp","weight","bp_amount","distributed","participant_count","created_at"
  ]);
}

/**
 * sha256(dateStr + RUMBLE_SALT) → hex string
 * RUMBLE_SALT is stored in ScriptProperties. Falls back to "rumble_default_salt".
 */
function computeSeed_(dateStr) {
  var props = PropertiesService.getScriptProperties();
  var salt  = props.getProperty("RUMBLE_SALT") || "rumble_default_salt";
  var input = dateStr + salt;
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("");
}

/**
 * Convert first 8 hex chars of sha256 to uint32. Never returns 0.
 */
function seedToInt_(hexStr) {
  var n = parseInt(hexStr.slice(0, 8), 16) >>> 0;
  return n || 1;
}

/**
 * Returns a seeded xorshift RNG function for the given date string.
 * Same dateStr → same sequence every time.
 */
function rumbleDailyRng_(dateStr) {
  var x = seedToInt_(computeSeed_(dateStr));
  return function() {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >> 17)) >>> 0;
    x = (x ^ (x << 5))  >>> 0;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * Weighted selection from pool array (each element has a .weight property).
 * Calls rng() exactly once. Returns the selected index.
 */
function weightedSelect_(pool, rng) {
  var total = 0;
  for (var i = 0; i < pool.length; i++) total += pool[i].weight;
  var r = rng() * total;
  var cum = 0;
  for (var i = 0; i < pool.length; i++) {
    cum += pool[i].weight;
    if (r < cum) return i;
  }
  return pool.length - 1;
}
```

- [ ] **Step 2: Verify the insertion compiles**

Open GAS editor, run any trivial function (e.g., `getTodayJst_`) to confirm no parse errors.

- [ ] **Step 3: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add rumble daily lottery sheet helpers and RNG utilities"
```

---

## Task 2: GAS — Add `rumbleDailyLottery_` function and routing

**Files:**
- Modify: `gas/Code.gs`
  - Insert function after `rumbleRewardDistribute_` (ends around line 6900)
  - Add routing after line 5468 (in the action dispatch chain)

- [ ] **Step 1: Insert `rumbleDailyLottery_` after `rumbleRewardDistribute_`**

Find the line that starts `// ============================================================` just after `rumbleRewardDistribute_` closes (around line 6902), and insert before it:

```javascript
// ============================================================
// action: rumble_daily_lottery（日次BP抽選・GASタイムトリガーから呼ばれる）
// ============================================================

var RUMBLE_DAILY_BP_REWARDS_ = [1000, 700, 400, 250, 200];

function rumbleDailyLottery_(params) {
  var dateStr  = String(params.date || getTodayJst_());
  // created_at in rumble_entry is stored as fake-JST ISO (Date.now()+9h).
  // 19:00 JST stored in that format = "YYYY-MM-DDT19:00:00.000Z"
  var deadline = dateStr + "T19:00:00.000Z";

  // 1. Get participants filtered by deadline
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eHeaders  = entryData[0];
  var eIdx      = {};
  eHeaders.forEach(function(h, i) { eIdx[h] = i; });

  var participants = [];
  for (var i = 1; i < entryData.length; i++) {
    var row = entryData[i];
    if (String(row[eIdx["date"]]) !== dateStr) continue;
    var createdAt = String(row[eIdx["created_at"]] || "");
    if (createdAt && createdAt > deadline) continue;
    participants.push({
      user_id: String(row[eIdx["user_id"]]),
      rp:      Number(row[eIdx["rp"]] || 0),
    });
  }

  if (participants.length === 0) {
    Logger.log("[rumbleDailyLottery_] No participants for " + dateStr);
    return json_({ ok: true, distributed: 0, date: dateStr, skipped: "no_participants" });
  }

  // 2. Idempotency: if all winnerCount ranks are distributed=true, skip
  var winnerCount  = Math.min(5, participants.length);
  var resultSheet  = getRumbleDailyResultSheet_();
  ensureRumbleDailyResultCols_(resultSheet);
  var resultData   = resultSheet.getDataRange().getValues();
  var rHeaders     = resultData[0];
  var rIdx         = {};
  rHeaders.forEach(function(h, i) { rIdx[h] = i; });

  var existingRows = [];
  for (var i = 1; i < resultData.length; i++) {
    if (String(resultData[i][rIdx["date"]]) !== dateStr) continue;
    existingRows.push({
      rowNum:      i + 1,
      rank:        Number(resultData[i][rIdx["rank"]]),
      user_id:     String(resultData[i][rIdx["user_id"]]),
      distributed: String(resultData[i][rIdx["distributed"]]) === "true",
    });
  }

  var doneCount = existingRows.filter(function(r) {
    return r.rank >= 1 && r.rank <= winnerCount && r.distributed;
  }).length;
  if (doneCount === winnerCount) {
    Logger.log("[rumbleDailyLottery_] Already complete for " + dateStr);
    return json_({ ok: true, distributed: 0, date: dateStr, skipped: "already_done" });
  }

  // 3. Seed + RNG (deterministic: same dateStr → same sequence)
  var seedHex = computeSeed_(dateStr);
  var rng     = rumbleDailyRng_(dateStr);

  // 4. Build weighted pool
  var pool = participants.map(function(p) {
    return {
      user_id: p.user_id,
      rp:      p.rp,
      weight:  Math.floor(Math.sqrt(p.rp) * 1000),
    };
  });

  // 5. Load applies data (BP grant + display names)
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  var displayNameMap = {};
  var emailMap       = {};
  for (var j = 1; j < appliesData.length; j++) {
    var uid = String(appliesData[j][aIdx["login_id"]]);
    displayNameMap[uid] = String(appliesData[j][aIdx["rumble_display_name"]] || uid);
    emailMap[uid]       = String(appliesData[j][aIdx["email"]] || "");
  }

  var nowJst      = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  var distributed = 0;

  // 6. Lottery: rank 1 to winnerCount, one winner at a time
  for (var rank = 1; rank <= winnerCount; rank++) {
    // Always run RNG in sequence (deterministic replay for recovery)
    var idx    = weightedSelect_(pool, rng); // consumes exactly 1 rng() call
    var winner = pool[idx];
    pool.splice(idx, 1); // remove from pool for next round

    // If this rank is already distributed=true, skip grant (same seed = same winner)
    var alreadyDone = existingRows.some(function(r) {
      return r.rank === rank && r.distributed;
    });
    if (alreadyDone) {
      Logger.log("[rumbleDailyLottery_] rank=" + rank + " already distributed, skipping");
      continue;
    }

    var bpAmount    = RUMBLE_DAILY_BP_REWARDS_[rank - 1];
    var displayName = displayNameMap[winner.user_id] || winner.user_id;
    var email       = emailMap[winner.user_id] || "";

    // a. Write row to rumble_daily_result (distributed=false)
    var rowData = [
      dateStr, seedHex, rank, winner.user_id, displayName,
      winner.rp, winner.weight, bpAmount, false, participants.length, nowJst
    ];
    var existingRowNum = -1;
    for (var ei = 0; ei < existingRows.length; ei++) {
      if (existingRows[ei].rank === rank) { existingRowNum = existingRows[ei].rowNum; break; }
    }
    if (existingRowNum === -1) {
      resultSheet.appendRow(rowData);
    } else {
      resultSheet.getRange(existingRowNum, 1, 1, rowData.length).setValues([rowData]);
    }
    SpreadsheetApp.flush();

    // b. Grant BP to winner
    for (var k = 1; k < appliesData.length; k++) {
      if (String(appliesData[k][aIdx["login_id"]]) === winner.user_id) {
        var currentBp = Number(appliesData[k][aIdx["bp_balance"]] || 0);
        var newBp     = Math.round((currentBp + bpAmount) * 100) / 100;
        appliesSheet.getRange(k + 1, aIdx["bp_balance"] + 1).setValue(newBp);
        appliesData[k][aIdx["bp_balance"]] = newBp; // update local cache
        break;
      }
    }
    SpreadsheetApp.flush();

    // c. Record to wallet_ledger
    appendWalletLedger_({
      kind:     "rumble_daily_bp",
      login_id: winner.user_id,
      email:    email,
      amount:   bpAmount,
      memo:     dateStr + " 日次BP抽選 " + rank + "位",
    });

    // d. Mark distributed=true
    // Re-read sheet to find final row number after potential appendRow
    var rData2 = resultSheet.getDataRange().getValues();
    var rH2    = rData2[0];
    var rI2    = {};
    rH2.forEach(function(h, i) { rI2[h] = i; });
    for (var ri = 1; ri < rData2.length; ri++) {
      if (String(rData2[ri][rI2["date"]]) === dateStr &&
          Number(rData2[ri][rI2["rank"]]) === rank) {
        resultSheet.getRange(ri + 1, rI2["distributed"] + 1).setValue(true);
        break;
      }
    }
    SpreadsheetApp.flush();

    distributed++;
    Logger.log("[rumbleDailyLottery_] rank=" + rank +
      " user_id=" + winner.user_id +
      " rp=" + winner.rp +
      " weight=" + winner.weight +
      " bp=" + bpAmount);
  }

  Logger.log("[rumbleDailyLottery_] date=" + dateStr +
    " participant_count=" + participants.length +
    " winnerCount=" + winnerCount +
    " distributed=" + distributed);
  return json_({ ok: true, distributed: distributed, date: dateStr, participant_count: participants.length });
}

/** Called by GAS time trigger (毎日 19:00〜20:00 JST) */
function rumbleDailyLotteryTrigger_() {
  rumbleDailyLottery_({ date: getTodayJst_() });
}
```

- [ ] **Step 2: Add action routing**

Find the block of `if (action === ...)` lines (around line 5456–5470). After:
```javascript
    if (action === 'rumble_spectator')         return rumbleSpectator_(body);
```
Add:
```javascript
    if (action === 'rumble_daily_lottery')     return rumbleDailyLottery_(body);
```

- [ ] **Step 3: Manual smoke test in GAS editor**

In GAS editor, create a temporary test function:
```javascript
function testDailyLottery() {
  var result = rumbleDailyLottery_({ date: getTodayJst_() });
  Logger.log(JSON.stringify(result));
}
```
Run it. Check logs: should see participant count and distributed count, or "no_participants" / "already_done". Check `rumble_daily_result` sheet for new rows. Check `wallet_ledger` for `rumble_daily_bp` entries.

- [ ] **Step 4: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add rumbleDailyLottery_ with weighted draw and idempotent BP grant"
```

---

## Task 3: GAS — Add `rumbleDailyResult_` read action

**Files:**
- Modify: `gas/Code.gs`
  - Insert function after `rumbleDailyLotteryTrigger_`
  - Add routing

- [ ] **Step 1: Insert `rumbleDailyResult_` after `rumbleDailyLotteryTrigger_`**

```javascript
// ============================================================
// action: rumble_daily_result（日次抽選結果を返す。Next.js APIから呼ばれる）
// ============================================================
function rumbleDailyResult_(params) {
  var dateStr  = String(params.date || getTodayJst_());
  var todayStr = getTodayJst_();
  var isToday  = dateStr === todayStr;
  // Deadline same as lottery filter
  var deadline = dateStr + "T19:00:00.000Z";

  // --- Participants (filtered by deadline) ---
  var entrySheet = getRumbleEntrySheet_();
  ensureRumbleEntryCols_(entrySheet);
  var entryData = entrySheet.getDataRange().getValues();
  var eHeaders  = entryData[0];
  var eIdx      = {};
  eHeaders.forEach(function(h, i) { eIdx[h] = i; });

  var rawParticipants = []; // {user_id, created_at}
  for (var i = 1; i < entryData.length; i++) {
    var row = entryData[i];
    if (String(row[eIdx["date"]]) !== dateStr) continue;
    var createdAt = String(row[eIdx["created_at"]] || "");
    if (createdAt && createdAt > deadline) continue;
    rawParticipants.push({
      user_id:    String(row[eIdx["user_id"]]),
      created_at: createdAt,
    });
  }
  var participantCount   = rawParticipants.length;
  var expectedWinnerCount = Math.min(5, participantCount);

  // --- Display names ---
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var displayNameMap = {};
  for (var j = 1; j < appliesData.length; j++) {
    var uid = String(appliesData[j][aIdx["login_id"]]);
    displayNameMap[uid] = String(appliesData[j][aIdx["rumble_display_name"]] || uid);
  }

  // --- Lottery results ---
  var resultSheet = getRumbleDailyResultSheet_();
  ensureRumbleDailyResultCols_(resultSheet);
  var resultData = resultSheet.getDataRange().getValues();
  var rHeaders   = resultData[0];
  var rIdx       = {};
  rHeaders.forEach(function(h, i) { rIdx[h] = i; });

  var winners     = [];
  var maxWinnerRank = 0;
  for (var i = 1; i < resultData.length; i++) {
    if (String(resultData[i][rIdx["date"]]) !== dateStr) continue;
    if (String(resultData[i][rIdx["distributed"]]) !== "true") continue;
    var rank = Number(resultData[i][rIdx["rank"]]);
    winners.push({
      rank:         rank,
      user_id:      String(resultData[i][rIdx["user_id"]]),
      display_name: String(resultData[i][rIdx["display_name"]]),
      bp_amount:    Number(resultData[i][rIdx["bp_amount"]]),
      // rp and weight intentionally omitted from response
    });
    if (rank > maxWinnerRank) maxWinnerRank = rank;
  }
  winners.sort(function(a, b) { return a.rank - b.rank; });

  // --- Status: ready only if all expected ranks are distributed ---
  var isReady = expectedWinnerCount > 0 &&
    winners.length === expectedWinnerCount &&
    winners.every(function(w) { return w.rank >= 1 && w.rank <= expectedWinnerCount; });

  if (isReady) {
    return json_({
      ok:               true,
      status:           "ready",
      date:             dateStr,
      participant_count: participantCount,
      winnerCount:      expectedWinnerCount,
      isToday:          isToday,
      replay_seed:      computeSeed_(dateStr), // sha256 hex only, SALT never exposed
      winners:          winners,
    });
  }

  // --- Pending: return participants list (display_name only, created_at order) ---
  var participants = rawParticipants.map(function(p) {
    return {
      user_id:      p.user_id,
      display_name: displayNameMap[p.user_id] || p.user_id,
    };
  });
  return json_({
    ok:               true,
    status:           "pending",
    date:             dateStr,
    participant_count: participantCount,
    winnerCount:      expectedWinnerCount,
    isToday:          isToday,
    participants:     participants,
  });
}
```

- [ ] **Step 2: Add action routing**

After the `rumble_daily_lottery` route you added in Task 2, add:
```javascript
    if (action === 'rumble_daily_result')      return rumbleDailyResult_(body);
```

- [ ] **Step 3: Manual test in GAS editor**

```javascript
function testDailyResult() {
  var r = rumbleDailyResult_({ date: getTodayJst_() });
  Logger.log(JSON.stringify(r));
}
```
Run it. Verify:
- If lottery ran: `status: "ready"` with `winners` array, no `rp`/`weight` in winners.
- If lottery not yet run: `status: "pending"` with `participants` array.
- `replay_seed` present when ready, absent when pending.

- [ ] **Step 4: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add rumbleDailyResult_ action for daily lottery read API"
```

---

## Task 4: GAS — Add idempotency + wallet_ledger to weekly EP reward

**Files:**
- Modify: `gas/Code.gs`
  - Modify `rumbleRewardDistribute_` (around line 6848)
  - Add `rumbleWeeklyRewardTrigger_` after it

- [ ] **Step 1: Add idempotency check and wallet_ledger recording to `rumbleRewardDistribute_`**

Find `rumbleRewardDistribute_` (starts at line 6848). Replace the function body with the version below. The structure is identical to the original; the only additions are marked with `// ★ NEW`:

```javascript
function rumbleRewardDistribute_(params) {
  var WEEKLY_REWARDS = [
    { rank_min: 1,  rank_max: 1,   ep: 1500 },
    { rank_min: 2,  rank_max: 2,   ep: 1000 },
    { rank_min: 3,  rank_max: 3,   ep: 700  },
    { rank_min: 4,  rank_max: 10,  ep: 400  },
    { rank_min: 11, rank_max: 50,  ep: 80   },
    { rank_min: 51, rank_max: 100, ep: 10   },
  ];

  var weekId    = params.weekId || getWeekId_();

  // ★ NEW: Idempotency check via ScriptProperties
  var propKey = "RUMBLE_WEEK_DISTRIBUTED_" + weekId;
  var props   = PropertiesService.getScriptProperties();
  if (props.getProperty(propKey) && !params.force) {
    Logger.log("[rumbleRewardDistribute_] Already distributed for " + weekId);
    return json_({ ok: true, distributed: 0, week_id: weekId, skipped: "already_done" });
  }

  var weekSheet = getRumbleWeekSheet_();
  ensureRumbleWeekCols_(weekSheet);
  var weekData = weekSheet.getDataRange().getValues();
  var wHeaders = weekData[0];
  var wIdx     = {};
  wHeaders.forEach(function(h, i) { wIdx[h] = i; });

  var rows = weekData.slice(1)
    .filter(function(row) { return String(row[wIdx["week_id"]]) === weekId; })
    .map(function(row) { return { user_id: String(row[wIdx["user_id"]]), total_rp: Number(row[wIdx["total_rp"]] || 0) }; });
  rows.sort(function(a, b) { return b.total_rp - a.total_rp; });

  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });

  // ★ NEW: build email map
  var emailMap = {};
  for (var e = 1; e < appliesData.length; e++) {
    emailMap[String(appliesData[e][aIdx["login_id"]])] = String(appliesData[e][aIdx["email"]] || "");
  }

  var distributed = 0;
  rows.forEach(function(entry, i) {
    var rank = i + 1;
    var ep   = 0;
    for (var j = 0; j < WEEKLY_REWARDS.length; j++) {
      if (rank >= WEEKLY_REWARDS[j].rank_min && rank <= WEEKLY_REWARDS[j].rank_max) {
        ep = WEEKLY_REWARDS[j].ep;
        break;
      }
    }
    if (ep <= 0) return;

    for (var k = 1; k < appliesData.length; k++) {
      if (String(appliesData[k][aIdx["login_id"]]) === entry.user_id) {
        var currentEp = Number(appliesData[k][aIdx["ep_balance"]] || 0);
        appliesSheet.getRange(k + 1, aIdx["ep_balance"] + 1).setValue(currentEp + ep);
        distributed++;

        // ★ NEW: Record to wallet_ledger
        appendWalletLedger_({
          kind:     "rumble_weekly_ep",
          login_id: entry.user_id,
          email:    emailMap[entry.user_id] || "",
          amount:   ep,
          memo:     weekId + " 週次EP報酬 " + rank + "位",
        });

        break;
      }
    }
  });

  // ★ NEW: Mark week as distributed
  props.setProperty(propKey, new Date().toISOString());

  return json_({ ok: true, distributed: distributed, week_id: weekId });
}
```

- [ ] **Step 2: Add `rumbleWeeklyRewardTrigger_` after `rumbleRewardDistribute_`**

Insert immediately after the closing brace of `rumbleRewardDistribute_`:

```javascript
/** Called by GAS time trigger (金曜 23:00〜24:00 JST) */
function rumbleWeeklyRewardTrigger_() {
  var weekId = getWeekId_();
  Logger.log("[rumbleWeeklyRewardTrigger_] Starting for " + weekId);
  var result = rumbleRewardDistribute_({ weekId: weekId });
  Logger.log("[rumbleWeeklyRewardTrigger_] " + JSON.stringify(result));
}
```

- [ ] **Step 3: Manual test**

In GAS editor, run:
```javascript
function testWeeklyReward() {
  // First call should distribute
  var r1 = rumbleRewardDistribute_({ weekId: getWeekId_() });
  Logger.log("First: " + JSON.stringify(r1));
  // Second call should be skipped
  var r2 = rumbleRewardDistribute_({ weekId: getWeekId_() });
  Logger.log("Second (should skip): " + JSON.stringify(r2));
}
```
Check:
- First call: `distributed > 0` (or 0 if no entries this week), `wallet_ledger` has `rumble_weekly_ep` entries.
- Second call: `skipped: "already_done"`.
- To reset for re-testing: delete the ScriptProperty `RUMBLE_WEEK_DISTRIBUTED_<weekId>` in GAS Project Settings > Script properties.

- [ ] **Step 4: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add weekly EP idempotency, wallet_ledger recording, and trigger wrapper"
```

---

## Task 5: GAS — Set up time triggers

**Files:**
- Modify: `gas/Code.gs` (add setup helper — run once manually)

- [ ] **Step 1: Add trigger setup function**

Insert anywhere (e.g., at the very bottom of `gas/Code.gs`):

```javascript
// ============================================================
// TRIGGER SETUP — run once manually in GAS editor
// ============================================================

/**
 * Run this function ONCE in the GAS editor to install time triggers.
 * Do NOT call from code — triggers persist across deploys.
 */
function setupRumbleTriggers_() {
  // Remove existing rumble triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    var name = t.getHandlerFunction();
    if (name === "rumbleDailyLotteryTrigger_" || name === "rumbleWeeklyRewardTrigger_") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Daily lottery: every day 19:00–20:00 JST
  ScriptApp.newTrigger("rumbleDailyLotteryTrigger_")
    .timeBased()
    .everyDays(1)
    .atHour(19) // GAS uses script timezone; set GAS timezone to Asia/Tokyo in Project Settings
    .create();

  // Weekly EP reward: every Friday 23:00–24:00 JST
  ScriptApp.newTrigger("rumbleWeeklyRewardTrigger_")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(23)
    .create();

  Logger.log("Rumble triggers set up successfully.");
}
```

- [ ] **Step 2: Set GAS project timezone**

In GAS editor: Project Settings → Script timezone → set to `Asia/Tokyo`.

- [ ] **Step 3: Set RUMBLE_SALT ScriptProperty**

In GAS editor: Project Settings → Script properties → Add property:
- Key: `RUMBLE_SALT`
- Value: a random 32+ character string (e.g., generate with `Utilities.getUuid()` in GAS console)

- [ ] **Step 4: Run `setupRumbleTriggers_` in GAS editor**

In GAS editor, select `setupRumbleTriggers_` from the function dropdown and click Run. Verify in Triggers panel that two triggers appear.

- [ ] **Step 5: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add setupRumbleTriggers_ helper for daily and weekly time triggers"
```

---

## Task 6: Next.js — Create `daily-result` API route

**Files:**
- Create: `app/api/minigames/rumble/daily-result/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTodayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function pendingFallback(date: string) {
  const todayJst = getTodayJST();
  return NextResponse.json({
    ok: true,
    status: "pending",
    date,
    participant_count: 0,
    winnerCount: 0,
    isToday: date === todayJst,
    participants: [],
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? getTodayJST();

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  if (!gasUrl || !gasKey) return pendingFallback(date);

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "rumble_daily_result", date }),
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) return pendingFallback(date);
    return NextResponse.json(data);
  } catch {
    return pendingFallback(date);
  }
}
```

- [ ] **Step 2: Manual test (dev server must be running)**

```bash
npm run dev
```

In a new terminal:
```bash
# Should return pending (no lottery run yet, or pending state)
curl "http://localhost:3000/api/minigames/rumble/daily-result" | jq .
```

Expected: `{ "ok": true, "status": "pending" | "ready", "date": "YYYY-MM-DD", ... }`

- [ ] **Step 3: Commit**

```bash
git add app/api/minigames/rumble/daily-result/route.ts
git commit -m "feat(api): add GET /api/minigames/rumble/daily-result route"
```

---

## Task 7: Frontend — Update 観戦 tab UI

**Files:**
- Modify: `app/mini-games/rumble/page.tsx`

- [ ] **Step 1: Add `DailyResultData` type after the `SpectatorData` type (after line 62)**

Find:
```typescript
type SpectatorData = {
  ok: boolean;
  status: "ready" | "no_data";
  ...
};
```

After its closing `};`, add:
```typescript
type DailyResultData = {
  ok: boolean;
  status: "pending" | "ready";
  date: string;
  participant_count: number;
  winnerCount: number;
  isToday: boolean;
  participants?: Array<{ user_id: string; display_name: string }>;
  replay_seed?: string;
  winners?: Array<{ rank: number; user_id: string; display_name: string; bp_amount: number }>;
};
```

- [ ] **Step 2: Add state variables after `spectatorDate` state (after line 116)**

Find:
```typescript
  const [spectatorDate,      setSpectatorDate]      = useState<string | null>(null);
```

After that line, add:
```typescript
  const [dailyResult,        setDailyResult]        = useState<DailyResultData | null>(null);
  const [dailyResultLoading, setDailyResultLoading] = useState(false);
  const [showWinners,        setShowWinners]         = useState(false);
```

- [ ] **Step 3: Add `dailyResult` fetch useEffect**

Find the existing spectator `useEffect` that starts with:
```typescript
  useEffect(() => {
    if (tab !== "観戦" || !userId) return;
```

Add a NEW `useEffect` immediately after that entire block (after its closing `}, [tab, userId, ...]);`):

```typescript
  // 日次抽選結果を取得（観戦タブ表示のたびにリフレッシュ）
  useEffect(() => {
    if (tab !== "観戦") return;
    setDailyResultLoading(true);
    setShowWinners(false);
    fetch("/api/minigames/rumble/daily-result")
      .then(r => r.json())
      .then((d: DailyResultData) => { if (d.ok) setDailyResult(d); })
      .catch(() => {})
      .finally(() => setDailyResultLoading(false));
  }, [tab]);
```

- [ ] **Step 4: Set `showWinners = true` when battle animation ends**

Find inside `handleSpectatorPlay`:
```typescript
      } else if (event.type === "result") {
        addLog(event.text ?? "バトル終了！", "text-yellow-300");
        setSpectatorPhase("result");
      }
```

Change to:
```typescript
      } else if (event.type === "result") {
        addLog(event.text ?? "バトル終了！", "text-yellow-300");
        setSpectatorPhase("result");
        setShowWinners(true);
      }
```

- [ ] **Step 5: Reset `showWinners` in "もう一度見る" handler**

Find inside the 観戦タブ JSX, the "もう一度見る" button's `onClick`:
```typescript
                    onClick={() => {
                      setBattleLogs([]);
                      setSpectatorPlayers(spectatorData.players.map(p => ({ ...p, status: "alive" as const })));
                      handleSpectatorPlay();
                    }}
```

Change to:
```typescript
                    onClick={() => {
                      setBattleLogs([]);
                      setShowWinners(false);
                      setSpectatorPlayers(spectatorData.players.map(p => ({ ...p, status: "alive" as const })));
                      handleSpectatorPlay();
                    }}
```

- [ ] **Step 6: Replace 観戦タブ JSX**

Find the entire 観戦タブ block:
```typescript
      {/* 観戦タブ */}
      {tab === "観戦" && (
        <div className="space-y-4">

          {spectatorLoading && (
            ...
          )}

          {!spectatorLoading && spectatorData?.status === "no_data" && (
            ...
          )}

          {!spectatorLoading && spectatorData?.status === "ready" && (
            <>
              ...
            </>
          )}
        </div>
      )}
```

Replace the entire inner `<div className="space-y-4">` content with:

```tsx
        <div className="space-y-4">

          {/* ローディング */}
          {(spectatorLoading || dailyResultLoading) && (
            <div className="text-center text-white/40 text-sm py-12">読み込み中...</div>
          )}

          {/* 抽選前（pending）：参加者一覧 */}
          {!spectatorLoading && !dailyResultLoading && dailyResult?.status === "pending" && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-white/60">本日の参加者</p>
                  <p className="text-xs text-white/40">{dailyResult.participant_count}人</p>
                </div>
                {dailyResult.participant_count === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">まだ参加者がいません</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(dailyResult.participants ?? []).map(p => (
                      <span
                        key={p.user_id}
                        className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          p.user_id === userId
                            ? "bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50"
                            : "bg-white/10 text-white/60"
                        }`}
                      >
                        {p.display_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-xs text-white/40">⏰ 抽選は19:00以降に実施されます</p>
                <div className="mt-2">
                  <p className="text-xs text-white/30 mb-1">次のランブルまで</p>
                  <p className="text-2xl font-black text-purple-400 font-mono">{countdown}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDailyResult(null);
                  setDailyResultLoading(true);
                  fetch("/api/minigames/rumble/daily-result")
                    .then(r => r.json())
                    .then((d: DailyResultData) => { if (d.ok) setDailyResult(d); })
                    .catch(() => {})
                    .finally(() => setDailyResultLoading(false));
                }}
                disabled={dailyResultLoading}
                className="w-full py-2 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 transition text-white/50 disabled:opacity-40"
              >
                {dailyResultLoading ? "取得中..." : "🔃 最新を取得"}
              </button>
            </div>
          )}

          {/* 抽選後（ready）：バトル演出 + 当選者発表 */}
          {!spectatorLoading && !dailyResultLoading && dailyResult?.status === "ready" && (
            <>
              {/* 観戦ステータスカード */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {spectatorPhase === "live" ? (
                      <span className="flex items-center gap-1 text-xs font-black text-pink-400">
                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                        観戦中
                      </span>
                    ) : spectatorPhase === "result" ? (
                      <span className="text-xs font-black text-yellow-400">🏆 結果確定</span>
                    ) : (
                      <span className="text-xs text-white/40">本日の観戦データを準備中…</span>
                    )}
                  </div>
                  <span className="text-xs text-white/40">参加者 {dailyResult.participant_count}人</span>
                </div>
                {spectatorData?.status === "ready" && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-white/40">生存中</p>
                      <p className="text-xl font-black text-purple-400">
                        {spectatorPlayers.filter(p => p.status !== "eliminated").length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">脱落</p>
                      <p className="text-xl font-black text-red-400/70">
                        {spectatorPlayers.filter(p => p.status === "eliminated").length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">あなた</p>
                      <p className={`text-sm font-black ${
                        spectatorData.self
                          ? spectatorPlayers.find(p => p.is_self)?.status === "eliminated"
                            ? "text-red-400"
                            : "text-green-400"
                          : "text-white/30"
                      }`}>
                        {spectatorData.self
                          ? spectatorPlayers.find(p => p.is_self)?.status === "eliminated"
                            ? "脱落"
                            : "生存中"
                          : "未参加"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* バトルログカード */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4">
                <p className="text-xs font-bold text-purple-400/60 mb-3 tracking-widest">BATTLE LOG</p>
                <div className="min-h-[200px] space-y-2 font-mono">
                  {battleLogs.length === 0 && !isPlaying && (
                    <p className="text-white/20 text-sm text-center pt-8">
                      ▶ 観戦を開始してください
                    </p>
                  )}
                  {battleLogs.map(log => (
                    <p key={log.id} className={`text-sm leading-relaxed whitespace-pre-line ${log.color}`}>
                      {log.text}
                    </p>
                  ))}
                  {isPlaying && (
                    <p className="text-white/30 text-xs animate-pulse">▌</p>
                  )}
                </div>
              </div>

              {/* 再生ボタン群 */}
              <div className="flex flex-col gap-2">
                {!isPlaying && spectatorPhase !== "result" && spectatorData?.status === "ready" && (
                  <button
                    onClick={handleSpectatorPlay}
                    className="w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105 transition"
                  >
                    ⚔️ 観戦スタート
                  </button>
                )}
                {!isPlaying && spectatorPhase === "result" && spectatorData?.status === "ready" && (
                  <button
                    onClick={() => {
                      setBattleLogs([]);
                      setShowWinners(false);
                      setSpectatorPlayers(spectatorData.players.map(p => ({ ...p, status: "alive" as const })));
                      handleSpectatorPlay();
                    }}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 transition"
                  >
                    🔄 もう一度見る
                  </button>
                )}
                <button
                  onClick={handleSpectatorRefresh}
                  disabled={spectatorLoading}
                  className="w-full py-2 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 transition text-white/50 disabled:opacity-40"
                >
                  {spectatorLoading ? "取得中..." : "🔃 最新を取得"}
                </button>
              </div>

              {/* 生存者一覧カード */}
              {spectatorData?.status === "ready" && (
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-white/60">生存者</p>
                    <p className="text-xs text-white/30">
                      {spectatorPlayers.filter(p => p.status !== "eliminated").length} / {dailyResult.participant_count}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spectatorPlayers.map(p => (
                      <span
                        key={p.id}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all duration-500 ${
                          p.is_self
                            ? p.status === "eliminated"
                              ? "bg-red-900/40 text-red-400/60 line-through border border-red-500/20"
                              : "bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50"
                            : p.status === "eliminated"
                              ? "bg-white/3 text-white/20 line-through"
                              : p.rank <= 10
                                ? "bg-yellow-500/10 text-yellow-400/80 border border-yellow-500/20"
                                : "bg-white/10 text-white/60"
                        }`}
                      >
                        {p.display_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 日次BP当選者発表（バトル演出後に表示） */}
              {showWinners && dailyResult.winners && dailyResult.winners.length > 0 && (
                <div className="bg-gradient-to-b from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-2xl p-5">
                  <p className="text-xs font-bold text-yellow-400/80 mb-4 tracking-widest text-center">🎰 日次BP抽選結果</p>
                  <div className="space-y-2">
                    {dailyResult.winners.map(w => (
                      <div
                        key={w.rank}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                          w.rank === 1 ? "bg-yellow-500/20 border border-yellow-500/40" :
                          w.rank === 2 ? "bg-slate-400/10 border border-slate-400/30" :
                          w.rank === 3 ? "bg-amber-700/10 border border-amber-700/30" :
                          "bg-white/5"
                        }`}
                      >
                        <span className="text-sm font-bold text-white/80">
                          {w.rank === 1 ? "🏆" : w.rank === 2 ? "🥈" : w.rank === 3 ? "🥉" : `${w.rank}位`}{" "}
                          <span className={w.user_id === userId ? "text-purple-300" : ""}>{w.display_name}</span>
                        </span>
                        <span className="text-sm font-black text-yellow-400">+{w.bp_amount.toLocaleString()} BP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 今週のランキング簡易 */}
              {spectatorData?.ranking && spectatorData.ranking.length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-xs font-bold text-white/60 mb-3">📊 今週ランキング TOP5</p>
                  <div className="space-y-1">
                    {spectatorData.ranking.map((r, i) => (
                      <div key={r.user_id} className={`flex justify-between text-xs py-1 px-2 rounded ${r.user_id === userId ? "bg-purple-500/20 text-white font-bold" : "text-white/50"}`}>
                        <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}位`} {r.display_name}</span>
                        <span className="text-purple-400">{r.total_rp} RP</span>
                      </div>
                    ))}
                    {spectatorData.self && (spectatorData.self.week_rank ?? 0) > 5 && (
                      <div className="flex justify-between text-xs py-1 px-2 rounded bg-purple-500/20 text-white font-bold mt-2 border-t border-white/10 pt-2">
                        <span>👤 {spectatorData.self.week_rank}位 {spectatorData.self.display_name}</span>
                        <span className="text-purple-400">{spectatorData.self.week_rp} RP</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
```

- [ ] **Step 7: Verify build passes**

```bash
npm run build
```

Expected: compilation succeeds, no TypeScript errors.

- [ ] **Step 8: Manual UI test (dev server)**

```bash
npm run dev
```

Open browser to `http://localhost:3000/mini-games/rumble`, switch to 観戦 tab. Verify:
- If `status: "pending"`: participant list shows, "抽選は19:00以降..." message shows, no battle animation button.
- If `status: "ready"`: "⚔️ 観戦スタート" shows, after clicking and animation completes, `🎰 日次BP抽選結果` section appears below with winners and BP amounts.
- RP, weight, RUMBLE_SALT are never visible in UI.

- [ ] **Step 9: Commit**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(ui): update spectator tab with pending/ready branching and daily BP lottery reveal"
```

---

## Self-Review — Spec vs Plan Coverage

| Spec requirement | Task that implements it |
|---|---|
| 1. 参加100BP、1日1回 | Existing (unchanged) |
| 2. 参加時にRP内部確定 | Existing (unchanged) |
| 3. RP計算式 | Existing (unchanged) |
| 4. RP参加直後非公開 | Existing (unchanged); Task 6 hides RP in pending UI |
| 5. 毎日締切後に当選者決定 | Task 2 (rumbleDailyLottery_), Task 5 (time trigger) |
| 6. 重み付き非復元抽選 | Task 2 (weightedSelect_ + pool.splice) |
| 7. weight = sqrt(RP)×1000 整数 | Task 1 (weightedSelect_), Task 2 |
| 8. 1位〜5位順次抽選・除外 | Task 2 (for loop + pool.splice) |
| 9. 日次BP報酬固定額 | Task 2 (RUMBLE_DAILY_BP_REWARDS_) |
| 10. 週次EP報酬現行維持 | Task 4 (修正のみ、既存ロジック維持) |
| 11. 観戦モード演出UI変更 | Task 7 (pending/ready分岐) |
| 12. 観戦中RP詳細非表示 | Task 3 (rumbleDailyResult_がrp返さない), Task 7 (UI) |
| 13. 観戦後統計表示可能 | Task 7 (showWinners section) |
| 14. 抽選結果seed方式保存 | Task 2 (seed列), Task 3 (replay_seed返却) |
| 15. seed = date+secretSalt | Task 1 (computeSeed_), Task 5 (RUMBLE_SALT ScriptProperty) |
| 16. 日次報酬冪等 | Task 2 (idempotency check + per-rank distributed flag) |
| 17. wallet_ledger記録 | Task 2 (daily BP), Task 4 (weekly EP) |
