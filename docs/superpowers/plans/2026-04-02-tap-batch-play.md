# Tap Mining バッチ処理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1タップ=1APIコールの実装を、クライアント側バッチ蓄積＋サーバー一括確定方式に移行し、API呼び出し数を約1/10に削減する。

**Architecture:** フロントはタップを`pendingTapsRef`に蓄積し、10タップ到達または2秒経過でバッチ送信。GASはバッチを受け取り抽選→残高更新→ログを1行で記録。旧`tapPlay_`はdeprecatedとして残す。

**Tech Stack:** Next.js 14 (App Router), Google Apps Script, TypeScript

---

## ファイル一覧

| ファイル | 操作 |
|---|---|
| `gas/Code.gs` | 修正：routing追加 + deprecated comment + `tapBatchPlay_` 関数追加 |
| `app/api/minigames/tap/batch-play/route.ts` | 新規作成 |
| `app/api/minigames/tap/play/route.ts` | 修正：deprecated comment のみ |
| `app/mini-games/tap/page.tsx` | 全面書き換え |

---

## Task 1: GAS — ルーティングに tap_batch_play を追加

**Files:**
- Modify: `gas/Code.gs` (line 5454付近)

- [ ] **Step 1: tap_ticker の次行に tap_batch_play ルートを追加**

`gas/Code.gs` の以下の行を探す：
```javascript
    if (action === 'tap_ticker') return tapTicker_(body);
```

その直後に追加：
```javascript
    if (action === 'tap_batch_play') return tapBatchPlay_(body);
```

結果（前後含む）：
```javascript
    if (action === 'tap_ticker')     return tapTicker_(body);
    if (action === 'tap_batch_play') return tapBatchPlay_(body);
    if (action === 'rumble_entry')   return rumbleEntry_(body);
```

- [ ] **Step 2: tapPlay_ に deprecated コメントを追記**

`gas/Code.gs` の以下を探す：
```javascript
// action: tap_play
// params: userId
function tapPlay_(params) {
```

以下に変更：
```javascript
// @deprecated: Use tapBatchPlay_ instead. Kept for debug/fallback/rollback only.
// action: tap_play
// params: userId
function tapPlay_(params) {
```

- [ ] **Step 3: コミット（この時点では動作変更なし）**

```bash
git add gas/Code.gs
git commit -m "chore: add tap_batch_play routing + deprecated comment on tapPlay_"
```

---

## Task 2: GAS — シートヘルパーと tapBatchPlay_ 関数を追加

**Files:**
- Modify: `gas/Code.gs`（`tapTicker_` 関数の末尾 〜 RUMBLE LEAGUEセクションの間に追記）

- [ ] **Step 1: tapTicker_ 末尾を確認**

`gas/Code.gs` の以下の行を探す（tapTicker_の末尾付近）：
```javascript
  rows.sort(function(a, b) { return b.created_at > a.created_at ? 1 : -1; });
  return json_({ ok: true, events: rows.slice(0, 20) });
}
```

その直後（`// RUMBLE LEAGUE` コメントより前）に以下を追記する。

- [ ] **Step 2: getTapBatchLogsSheet_ を追加**

```javascript
function getTapBatchLogsSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("tap_batch_logs");
  if (!sheet) {
    sheet = ss.insertSheet("tap_batch_logs");
    sheet.appendRow([
      "session_id", "user_id",
      "requested_tap_count", "processed_tap_count",
      "bp_cost", "bp_reward", "ep_reward",
      "rare_count", "max_combo", "suspicious_flag",
      "started_at", "ended_at", "created_at"
    ]);
  }
  return sheet;
}
```

- [ ] **Step 3: getTapRareLogsSheet_ を追加**

```javascript
function getTapRareLogsSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rare_logs");
  if (!sheet) {
    sheet = ss.insertSheet("rare_logs");
    sheet.appendRow(["id", "user_id", "reward", "type", "session_id", "created_at"]);
  }
  return sheet;
}
```

- [ ] **Step 4: tapBatchPlay_ 関数を追加**

```javascript
// action: tap_batch_play
// params: userId, sessionId, tapCount, maxCombo, startedAt, endedAt
function tapBatchPlay_(params) {
  var userId    = String(params.userId    || "");
  var sessionId = String(params.sessionId || "");
  var tapCount  = Math.floor(Number(params.tapCount  || 0));
  var maxCombo  = Math.floor(Number(params.maxCombo  || 0));
  var startedAt = String(params.startedAt || "");
  var endedAt   = String(params.endedAt   || "");

  if (!userId)       return json_({ ok: false, error: "userId_required" });
  if (tapCount <= 0) return json_({ ok: false, error: "invalid_tap_count" });

  var MAX_TAPS_PER_DAY = 500;
  var MAX_BATCH        = 50;

  var suspicious = tapCount > MAX_BATCH;
  if (suspicious) tapCount = MAX_BATCH;
  var requestedTapCount = tapCount; // 切り捨て後の要求数

  var sheet = getTapGameSheet_();
  ensureTapGameCols_(sheet);

  var nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var nowStr   = nowJst.toISOString();
  var todayStr = nowStr.slice(0, 10);

  // ユーザー行取得・なければ初期化
  var found = getTapGameRow_(sheet, userId);
  var rowNum, idx, row;
  if (!found) {
    sheet.appendRow([userId, 0, 0, 0, 0, 0, 0, todayStr, nowStr, false]);
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });
    rowNum = sheet.getLastRow();
    row    = data[rowNum - 1];
  } else {
    rowNum = found.rowNum;
    idx    = found.idx;
    row    = found.row;
    resetTapIfNeeded_(sheet, rowNum, idx, row);
    row = sheet.getRange(rowNum, 1, 1, Object.keys(idx).length).getValues()[0];
  }

  if (suspicious) {
    sheet.getRange(rowNum, idx["suspicious_flag"] + 1).setValue(true);
  }

  var todayTaps = Number(row[idx["today_taps"]] || 0);
  var totalTaps = Number(row[idx["total_taps"]] || 0);

  // 残り枠チェック
  var remaining    = MAX_TAPS_PER_DAY - todayTaps;
  if (remaining <= 0) {
    return json_({ ok: false, error: "daily_limit_reached", taps_remaining: 0 });
  }
  var processCount = Math.min(tapCount, remaining);

  // BP残高チェック（1tap=1BP）
  var appliesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
  var appliesData  = appliesSheet.getDataRange().getValues();
  var aHeaders     = appliesData[0];
  var aIdx         = {};
  aHeaders.forEach(function(h, i) { aIdx[h] = i; });
  var userRow = null, userRowNum = -1;
  for (var i = 1; i < appliesData.length; i++) {
    if (String(appliesData[i][aIdx["login_id"]]) === userId) {
      userRow    = appliesData[i];
      userRowNum = i + 1;
      break;
    }
  }
  if (!userRow) return json_({ ok: false, error: "user_not_found" });

  var currentBp = Number(userRow[aIdx["bp_balance"]] || 0);
  var affordable = Math.min(processCount, Math.floor(currentBp));
  if (affordable <= 0) return json_({ ok: false, error: "insufficient_bp", bp: currentBp });
  processCount = affordable;

  // BP消費
  var bpCost = processCount;
  var afterBp = Math.round((currentBp - bpCost) * 100) / 100;

  // 抽選ループ
  var REWARD_TABLE = [
    { type: "BP", amount: 0.1,   prob: 0.45     },
    { type: "BP", amount: 0.2,   prob: 0.25     },
    { type: "BP", amount: 0.5,   prob: 0.08     },
    { type: "EP", amount: 1,     prob: 0.15     },
    { type: "EP", amount: 3,     prob: 0.05     },
    { type: "EP", amount: 10,    prob: 0.015    },
    { type: "EP", amount: 100,   prob: 0.0009   },
    { type: "EP", amount: 10000, prob: 0.000001 }
  ];

  var totalBpReward = 0;
  var totalEpReward = 0;
  var rareRewards   = [];
  var rareCount     = 0;

  for (var t = 0; t < processCount; t++) {
    var rand = Math.random(), cumulative = 0;
    var rType = "BP", rAmount = 0.1;
    for (var j = 0; j < REWARD_TABLE.length; j++) {
      cumulative += REWARD_TABLE[j].prob;
      if (rand < cumulative) { rType = REWARD_TABLE[j].type; rAmount = REWARD_TABLE[j].amount; break; }
    }
    if (rType === "BP") {
      totalBpReward = Math.round((totalBpReward + rAmount) * 100) / 100;
    } else {
      totalEpReward = Math.round((totalEpReward + rAmount) * 100) / 100;
      if (rAmount >= 50) { rareRewards.push({ type: "EP", amount: rAmount }); rareCount++; }
    }
  }

  // 残高更新
  afterBp = Math.round((afterBp + totalBpReward) * 100) / 100;
  var currentEp = Number(userRow[aIdx["ep_balance"]] || 0);
  var afterEp   = Math.round((currentEp + totalEpReward) * 100) / 100;
  appliesSheet.getRange(userRowNum, aIdx["bp_balance"] + 1).setValue(afterBp);
  if (totalEpReward > 0) {
    appliesSheet.getRange(userRowNum, aIdx["ep_balance"] + 1).setValue(afterEp);
  }

  // tap_game シート更新
  var newTodayTaps     = todayTaps + processCount;
  var newTotalTaps     = totalTaps + processCount;
  var todayBp          = Number(row[idx["today_bp_earned"]] || 0);
  var todayEp          = Number(row[idx["today_ep_earned"]] || 0);
  var newTodayBp       = Math.round((todayBp + totalBpReward) * 100) / 100;
  var newTodayEp       = Math.round((todayEp + totalEpReward) * 100) / 100;
  var newMaxCombo      = Math.max(Number(row[idx["max_combo"]]       || 0), maxCombo);
  var newTodayMaxCombo = Math.max(Number(row[idx["today_max_combo"]] || 0), maxCombo);

  sheet.getRange(rowNum, idx["total_taps"]       + 1).setValue(newTotalTaps);
  sheet.getRange(rowNum, idx["today_taps"]       + 1).setValue(newTodayTaps);
  sheet.getRange(rowNum, idx["today_bp_earned"]  + 1).setValue(newTodayBp);
  sheet.getRange(rowNum, idx["today_ep_earned"]  + 1).setValue(newTodayEp);
  sheet.getRange(rowNum, idx["max_combo"]        + 1).setValue(newMaxCombo);
  sheet.getRange(rowNum, idx["today_max_combo"]  + 1).setValue(newTodayMaxCombo);
  sheet.getRange(rowNum, idx["last_tap_at"]      + 1).setValue(nowStr);

  // tap_batch_logs（1バッチ1行）
  var batchSheet = getTapBatchLogsSheet_();
  batchSheet.appendRow([
    sessionId || Utilities.getUuid(), userId,
    requestedTapCount, processCount,
    bpCost, totalBpReward, totalEpReward,
    rareCount, maxCombo, suspicious,
    startedAt || nowStr, endedAt || nowStr, nowStr
  ]);

  // rare_logs + tap_ticker
  if (rareRewards.length > 0) {
    var rareSheet   = getTapRareLogsSheet_();
    var tickerSheet = getOrCreateTickerSheet_();
    var masked      = userId.length > 2 ? userId.slice(0, 2) + "***" : userId + "***";
    rareRewards.forEach(function(r) {
      rareSheet.appendRow([Utilities.getUuid(), userId, r.amount, "EP", sessionId || "", nowStr]);
      tickerSheet.appendRow([Utilities.getUuid(), masked, r.amount, "EP", nowStr]);
    });
  }

  return json_({
    ok:                true,
    processedTapCount: processCount,
    bpCost:            bpCost,
    bpReward:          totalBpReward,
    epReward:          totalEpReward,
    rareRewards:       rareRewards,
    todayTaps:         newTodayTaps,
    tapsRemaining:     MAX_TAPS_PER_DAY - newTodayTaps,
    bpBalance:         afterBp,
    epBalance:         afterEp,
    today_bp:          newTodayBp,
    today_ep:          newTodayEp
  });
}
```

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs
git commit -m "feat: add tapBatchPlay_ with tap_batch_logs and rare_logs sheets"
```

---

## Task 3: API Route — batch-play エンドポイント新規作成

**Files:**
- Create: `app/api/minigames/tap/batch-play/route.ts`

- [ ] **Step 1: ディレクトリ確認**

```bash
ls app/api/minigames/tap/
```

Expected: `play/  status/  ranking/  ticker/` が存在すること

- [ ] **Step 2: batch-play/route.ts を作成**

```typescript
// app/api/minigames/tap/batch-play/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { userId, sessionId, tapCount, maxCombo, startedAt, endedAt } = body ?? {};
  if (!userId)          return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  if (!tapCount || tapCount <= 0) return NextResponse.json({ ok: false, error: "invalid_tap_count" }, { status: 400 });

  const bodyStr = JSON.stringify({
    action:    "tap_batch_play",
    key:       GAS_API_KEY,
    userId,
    sessionId: sessionId ?? "",
    tapCount,
    maxCombo:  maxCombo  ?? 0,
    startedAt: startedAt ?? Date.now(),
    endedAt:   endedAt   ?? Date.now(),
  });
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;

  try {
    const res = await fetch(url, {
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) },
      body:     bodyStr,
      redirect: "follow",
      cache:    "no-store",
    });
    return NextResponse.json(await res.json());
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: play/route.ts に deprecated コメントを追記**

`app/api/minigames/tap/play/route.ts` の先頭に追加：

```typescript
// @deprecated: Use /api/minigames/tap/batch-play instead.
// Kept for debug/fallback/rollback only. Do NOT call from production frontend.
import { NextResponse } from "next/server";
// ... 以下既存コードそのまま
```

- [ ] **Step 4: コミット**

```bash
git add app/api/minigames/tap/batch-play/route.ts app/api/minigames/tap/play/route.ts
git commit -m "feat: add tap batch-play API route; deprecate play route"
```

---

## Task 4: Frontend — tap/page.tsx を全面書き換え

**Files:**
- Modify: `app/mini-games/tap/page.tsx`

**変更点まとめ:**
- パスワードゲート追加（sessionStorage）
- バッチ処理ロジック（pendingTapsRef / flushTaps / pagehide / sendBeacon）
- optimisticRemaining による楽観的残数表示
- デイリーボーナスUIを削除（GAS未実装のため誤認防止）
- フロートは⛏️のみ（レア報酬はサーバー確認後に表示）

- [ ] **Step 1: page.tsx を以下の内容に書き換える**

```typescript
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type TapStatus = {
  today_taps:      number;
  today_bp:        number;
  today_ep:        number;
  taps_remaining:  number;
  max_combo:       number;
  today_max_combo: number;
  total_taps:      number;
};

type BatchResult = {
  ok:                boolean;
  processedTapCount?: number;
  bpCost?:           number;
  bpReward?:         number;
  epReward?:         number;
  rareRewards?:      { type: string; amount: number }[];
  todayTaps?:        number;
  tapsRemaining?:    number;
  bpBalance?:        number;
  epBalance?:        number;
  today_bp?:         number;
  today_ep?:         number;
  error?:            string;
};

export default function TapMiningPage() {
  // ── パスワードゲート ──
  const [tapAuthed,   setTapAuthed]   = useState(false);
  const [tapPw,       setTapPw]       = useState("");
  const [tapPwError,  setTapPwError]  = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("tap_authed") === "1") setTapAuthed(true);
  }, []);

  const tryAuth = () => {
    if (tapPw === "nagoya01@") {
      sessionStorage.setItem("tap_authed", "1");
      setTapAuthed(true);
    } else {
      setTapPwError(true);
    }
  };

  // ── コア State ──
  const [userId,              setUserId]              = useState("");
  const [status,              setStatus]              = useState<TapStatus | null>(null);
  const [optimisticRemaining, setOptimisticRemaining] = useState<number | null>(null);
  const [combo,               setCombo]               = useState(0);
  const [lastTapTime,         setLastTapTime]         = useState(0);
  const [isTapping,           setIsTapping]           = useState(false);
  const [floats,              setFloats]              = useState<{ id: number; text: string; color: string; x: number }[]>([]);
  const [rareEffect,          setRareEffect]          = useState(false);
  const [fever,               setFever]               = useState(false);
  const [feverTimer,          setFeverTimer]          = useState(0);
  const [tickerEvents,        setTickerEvents]        = useState<{ masked_name: string; reward: number; type: string }[]>([]);
  const [showHelp,            setShowHelp]            = useState(false);

  // ── バッチ用 Refs ──
  const pendingTapsRef      = useRef(0);
  const flushTimerRef       = useRef<NodeJS.Timeout | null>(null);
  const isFlushingRef       = useRef(false);
  const sessionIdRef        = useRef(`tap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const batchStartRef       = useRef<number | null>(null);
  const maxComboInBatchRef  = useRef(0);
  const userIdRef           = useRef("");
  const floatIdRef          = useRef(0);
  const comboTimerRef       = useRef<NodeJS.Timeout | null>(null);
  const feverIntervalRef    = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── 初期化 ──
  useEffect(() => {
    const seen = localStorage.getItem("tap_help_seen");
    if (!seen) setShowHelp(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) {
        const auth = JSON.parse(raw);
        setUserId(String(auth?.id ?? ""));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/tap/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setStatus(d); })
      .catch(() => {});
  }, [userId]);

  // status が来たら optimisticRemaining を初期化（一度だけ）
  useEffect(() => {
    if (status && optimisticRemaining === null) {
      setOptimisticRemaining(status.taps_remaining);
    }
  }, [status, optimisticRemaining]);

  useEffect(() => {
    const fetchTicker = () => {
      fetch("/api/minigames/tap/ticker")
        .then(r => r.json())
        .then(d => { if (d.ok && d.events) setTickerEvents(d.events); })
        .catch(() => {});
    };
    fetchTicker();
    const interval = setInterval(fetchTicker, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── バッチ flush ──
  const flushTaps = useCallback(async () => {
    const count = pendingTapsRef.current;
    if (count === 0 || !userIdRef.current || isFlushingRef.current) return;

    isFlushingRef.current  = true;
    pendingTapsRef.current = 0;
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }

    const startedAt = batchStartRef.current ?? Date.now();
    const endedAt   = Date.now();
    batchStartRef.current       = null;
    const maxCombo              = maxComboInBatchRef.current;
    maxComboInBatchRef.current  = 0;

    try {
      const res  = await fetch("/api/minigames/tap/batch-play", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:    userIdRef.current,
          sessionId: sessionIdRef.current,
          tapCount:  count,
          maxCombo,
          startedAt,
          endedAt,
        }),
      });
      const data: BatchResult = await res.json();

      if (data.ok) {
        // サーバー値で状態を同期
        setStatus(prev => prev ? {
          ...prev,
          today_taps:      data.todayTaps      ?? prev.today_taps,
          today_bp:        data.today_bp        ?? prev.today_bp,
          today_ep:        data.today_ep        ?? prev.today_ep,
          taps_remaining:  data.tapsRemaining   ?? prev.taps_remaining,
          today_max_combo: Math.max(prev.today_max_combo, maxCombo),
        } : prev);
        // optimisticRemaining を実残数で補正（必須）
        if (data.tapsRemaining !== undefined) setOptimisticRemaining(data.tapsRemaining);

        // レア報酬演出（サーバー確認後のみ）
        data.rareRewards?.forEach(r => {
          const id = floatIdRef.current++;
          const x  = 40 + Math.random() * 20;
          let text: string, color: string;
          if (r.amount >= 10000) {
            text = `💥 +${r.amount}EP 大当たり!!!`; color = "text-red-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 3000);
          } else if (r.amount >= 500) {
            text = `🌟 +${r.amount}EP EPIC!!!`; color = "text-orange-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 2000);
          } else {
            text = `✨ +${r.amount}EP RARE!`; color = "text-yellow-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 1500);
          }
          setFloats(prev => [...prev, { id, text, color, x }]);
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1500);
        });
      } else if (data.error === "daily_limit_reached") {
        setOptimisticRemaining(0);
        setStatus(prev => prev ? { ...prev, taps_remaining: 0 } : prev);
      }
    } catch {}
    finally { isFlushingRef.current = false; }
  }, []);

  // ── 離脱時 flush（pagehide 最優先 / visibilitychange / beforeunload 補助） ──
  useEffect(() => {
    const buildPayload = () => ({
      userId:    userIdRef.current,
      sessionId: sessionIdRef.current,
      tapCount:  pendingTapsRef.current,
      maxCombo:  maxComboInBatchRef.current,
      startedAt: batchStartRef.current ?? Date.now(),
      endedAt:   Date.now(),
    });

    const sendBatch = () => {
      const count = pendingTapsRef.current;
      if (count === 0 || !userIdRef.current) return;
      pendingTapsRef.current = 0;
      const payload = buildPayload();
      const blob    = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/minigames/tap/batch-play", blob);
      } else {
        fetch("/api/minigames/tap/batch-play", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), keepalive: true,
        }).catch(() => {});
      }
    };

    const onPageHide        = () => sendBatch();
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") sendBatch(); };
    const onBeforeUnload    = () => sendBatch();

    window.addEventListener("pagehide",         onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload",      onBeforeUnload);

    return () => {
      window.removeEventListener("pagehide",         onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload",      onBeforeUnload);
      // unmount 時は試行のみ（完了保証なし）
      flushTaps();
    };
  }, [flushTaps]);

  // ── コンボ・フィーバー ──
  const resetComboTimer = () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), 1200);
  };

  const startFever = () => {
    if (fever) return;
    setFever(true);
    setFeverTimer(10);
    if (feverIntervalRef.current) clearInterval(feverIntervalRef.current);
    feverIntervalRef.current = setInterval(() => {
      setFeverTimer(t => {
        if (t <= 1) { clearInterval(feverIntervalRef.current!); setFever(false); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── メインタップ処理（バッチ版） ──
  const handleTap = () => {
    const effectiveRemaining = optimisticRemaining ?? (status?.taps_remaining ?? 0);
    if (!userId || !status || effectiveRemaining <= 0) return;

    const now      = Date.now();
    const newCombo = (now - lastTapTime) < 1200 ? combo + 1 : 1;
    setCombo(newCombo);
    setLastTapTime(now);
    maxComboInBatchRef.current = Math.max(maxComboInBatchRef.current, newCombo);
    resetComboTimer();
    if (newCombo === 50) startFever();

    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 100);

    // 即時フロートエフェクト（演出のみ・金額なし）
    const id = floatIdRef.current++;
    const x  = 40 + Math.random() * 20;
    setFloats(prev => [...prev, { id, text: "⛏️", color: "text-white/50", x }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 700);

    // 楽観的残数更新（0未満にしない）
    setOptimisticRemaining(r => Math.max(0, (r ?? (status?.taps_remaining ?? 0)) - 1));

    // バッチ蓄積
    if (!batchStartRef.current) batchStartRef.current = now;
    pendingTapsRef.current++;

    if (pendingTapsRef.current >= 10) {
      flushTaps();
    } else {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => flushTaps(), 2000);
    }
  };

  const comboMultiplier    = combo >= 100 ? 1.5 : combo >= 50 ? 1.2 : combo >= 20 ? 1.1 : 1.0;
  const effectiveRemaining = optimisticRemaining ?? (status?.taps_remaining ?? 0);

  // ── パスワードゲート（早期リターン） ──
  if (!tapAuthed) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] gap-4">
      <div className="text-4xl mb-2">⛏️</div>
      <h1 className="text-white font-bold text-xl">Tap Mining</h1>
      <p className="text-white/40 text-sm">パスワードを入力してください</p>
      <input
        type="password"
        value={tapPw}
        onChange={e => { setTapPw(e.target.value); setTapPwError(false); }}
        onKeyDown={e => { if (e.key === "Enter") tryAuth(); }}
        className="border border-white/20 bg-white/5 text-white rounded-xl px-4 py-2 text-sm w-64 text-center"
        placeholder="パスワード"
        autoFocus
      />
      {tapPwError && <p className="text-red-400 text-xs">パスワードが違います</p>}
      <button
        onClick={tryAuth}
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold"
      >
        入室する
      </button>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-md mx-auto relative overflow-hidden ${rareEffect ? "animate-pulse" : ""}`}>

      {/* ルール説明モーダル */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">⛏️ Tap Miningとは？</h2>
            <div className="text-sm text-white/70 space-y-3">
              <div>
                <p className="font-bold text-white mb-1">■ 基本ルール</p>
                <p>・1タップ = 1BP消費</p>
                <p>・1日最大500回まで</p>
                <p>・毎日リセット</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ 報酬</p>
                <p>・BPまたはEPがランダムで獲得できます</p>
                <p>・最低でも0.1BPは必ずもらえます</p>
                <p>・ごく稀に大量EPが当たることもあります</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ ポイント</p>
                <p>・EPはアプリ内ポイントです（換金不可）</p>
                <p>・運が良いと大当たりも…？</p>
              </div>
            </div>
            <button
              onClick={() => { localStorage.setItem("tap_help_seen", "1"); setShowHelp(false); }}
              className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold text-sm"
            >
              OK、はじめる！
            </button>
          </div>
        </div>
      )}

      {/* レア演出オーバーレイ */}
      {rareEffect && (
        <div className="fixed inset-0 bg-yellow-400/20 z-50 pointer-events-none flex items-center justify-center">
          <div className="text-4xl font-black text-yellow-400 animate-bounce">✨ RARE! EP獲得！</div>
        </div>
      )}

      {/* Ticker */}
      {tickerEvents.length > 0 && (
        <div className="fixed top-0 left-0 right-0 bg-black/80 text-yellow-400 text-xs py-1 px-4 z-40 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            {tickerEvents.map((e, i) => (
              <span key={i} className="mr-8">
                🎉 {e.masked_name} が {e.reward}EP を獲得！
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/mini-games" className="text-white/40 text-sm">← Arcade</Link>
        <h1 className="font-bold text-lg">⛏️ Tap Mining</h1>
        <button onClick={() => setShowHelp(true)} className="text-white/40 text-lg w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">?</button>
      </div>

      {/* ステータスバー */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">今日のBP</p>
          <p className="font-bold text-purple-400">{status?.today_bp ?? 0}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">今日のEP</p>
          <p className="font-bold text-yellow-400">{status?.today_ep ?? 0}</p>
        </div>
      </div>

      {/* コンボ表示 */}
      <div className="text-center mb-4">
        {combo >= 20 && (
          <div className="text-sm font-bold text-orange-400 animate-pulse">
            🔥 {combo} COMBO! × {comboMultiplier}
          </div>
        )}
        {fever && (
          <div className="text-sm font-bold text-red-400">
            ⚡ FEVER! {feverTimer}s
          </div>
        )}
      </div>

      {/* メインタップボタン */}
      <div className="relative flex items-center justify-center my-8">
        {floats.map(f => (
          <div
            key={f.id}
            className={`absolute text-sm font-bold ${f.color} pointer-events-none animate-bounce`}
            style={{ left: `${f.x}%`, top: "-20px" }}
          >
            {f.text}
          </div>
        ))}
        <button
          onClick={handleTap}
          disabled={!userId || !status || effectiveRemaining <= 0}
          className={`
            w-48 h-48 rounded-full font-black text-2xl transition-all duration-100 select-none
            ${isTapping ? "scale-90" : "scale-100"}
            ${fever
              ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]"
              : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            }
            ${(!userId || !status || effectiveRemaining <= 0) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-90"}
          `}
        >
          {effectiveRemaining <= 0 ? "🔒" : "⛏️"}
          <div className="text-sm font-normal mt-1">
            {effectiveRemaining <= 0 ? "明日また来てね" : "TAP!"}
          </div>
        </button>
      </div>

      {/* 上限メッセージ */}
      {effectiveRemaining <= 0 && (
        <div className="bg-white/5 rounded-xl p-4 text-center text-sm text-white/50 mb-4">
          本日のタップ上限に達しました🎉<br/>明日リセットされます
        </div>
      )}

      {/* 今日の記録 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-white/60 mb-3">📊 今日の記録</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">タップ数</span>
            <span>{status?.today_taps ?? 0} / 500</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">最大コンボ</span>
            <span>{status?.today_max_combo ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">獲得BP</span>
            <span className="text-purple-400">{status?.today_bp ?? 0} BP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">獲得EP</span>
            <span className="text-yellow-400">{status?.today_ep ?? 0} EP</span>
          </div>
        </div>
      </div>

      {/* 累計記録 */}
      <div className="text-center text-xs text-white/20">
        総タップ数: {status?.total_taps ?? 0} / 最大コンボ: {status?.max_combo ?? 0}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/mini-games/tap/page.tsx
git commit -m "feat: rewrite tap/page.tsx — batch processing + password gate + remove unimplemented daily bonus UI"
```

---

## Task 5: 動作確認

- [ ] **Step 1: 開発サーバー起動**

```bash
npm run dev
```

- [ ] **Step 2: パスワードゲート確認**

`http://localhost:3000/mini-games/tap` を開く
- パスワード入力欄が表示されること
- `nagoya01@` 入力 → 入室できること
- 誤パスワード → エラーメッセージが出ること
- ブラウザを閉じて再度開くとゲートが表示されること（sessionStorage リセット）

- [ ] **Step 3: バッチ動作確認**

DevTools の Network タブを開く
- タップを10回 → `/api/minigames/tap/batch-play` に1回のリクエストが飛ぶこと
- 2秒待機後にリクエストが飛ぶこと（デバウンス）
- リクエストボディ: `tapCount >= 1`, `userId` が入っていること
- レスポンス: `ok: true`, `tapsRemaining` が返ること

- [ ] **Step 4: optimisticRemaining 確認**

タップするたびに残り数がすぐ減ること（APIレスポンス待ちなし）
flush後に実残数で補正されること（大きくズレていたら修正される）

- [ ] **Step 5: デイリーボーナスUIが削除されていることを確認**

ページ内に「デイリーボーナス」セクションが存在しないこと

- [ ] **Step 6: GASに tap_batch_play が届くことを確認**

GASのApps Script エディタで実行ログを確認、または Google Sheets の `tap_batch_logs` シートに行が追加されることを確認

- [ ] **Step 7: 最終コミット（不要なら省略可）**

```bash
git add .
git commit -m "chore: final cleanup after tap batch implementation"
git push origin main
```
