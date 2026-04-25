# 音楽生成履歴・占い診断結果 サーバー管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 音楽生成履歴（music2）と占い診断結果（fortune）をGASスプレッドシートで管理し、PCとスマホなど複数デバイスで同じデータを表示できるようにする

**Architecture:** GASに `music_history`・`fortune_results` シートと合計4アクションを追加。Next.jsに `/api/music/history`・`/api/fortune/result` ルートを追加。フロントはサーバーを正とし、localStorageをキャッシュ兼オフラインフォールバックとして併用する。既存ロジックは変更せず、上位レイヤーでサーバー連携を追加する（構造を壊さない）。

**Tech Stack:** Google Apps Script (GAS), Google Sheets, Next.js 14 App Router, TypeScript

---

## 現状の履歴データ構造（変更なし）

```typescript
type MusicHistoryEntry = {
  jobId: string;       // 一意キー（重複排除に使用）
  title: string;
  audioUrl: string;
  downloadUrl: string;
  lyrics: string;
  createdAt: string;   // ISO string
  expiresAt?: string;  // ISO string（31日後）
};
```

`saveToHistory()` は生成完了時に2箇所から呼ばれる（page.tsx 355行・438行）。

---

## ファイル構成

| 操作 | ファイル | 内容 |
|------|----------|------|
| 修正 | `gas/Code.gs` | `music_history_save` / `music_history_list` / `fortune_result_save` / `fortune_result_get` アクション追加（追記のみ） |
| 新規 | `app/api/music/history/route.ts` | GET（一覧）/ POST（保存）エンドポイント |
| 修正 | `app/music2/page.tsx` | 初回ロード時にサーバー取得・生成完了時にサーバー保存 |
| 新規 | `app/api/fortune/result/route.ts` | GET（取得）/ POST（保存）エンドポイント |
| 修正 | `app/fortune/page.tsx` | 初回ロード時にサーバー取得・診断完了時にサーバー保存 |

---

## Task 1: GAS に `music_history` シートと2アクションを追加する

**Files:**
- Modify: `gas/Code.gs`（末尾付近のアクションルーター + 末尾に関数追加）

### 追加するシート構成

シート名: `music_history`
列: `id`, `user_id`, `job_id`, `title`, `audio_url`, `download_url`, `lyrics`, `created_at`, `expires_at`

### Step 1: アクションルーターに2行追加する

GASの `doPost` / `handleAction_` のルーター部分（`action === 'music_boost_status'` などが並んでいる箇所、5737行付近）に以下を追加:

```javascript
    if (action === 'music_history_save') return musicHistorySave_(body);
    if (action === 'music_history_list') return musicHistoryList_(body);
```

- [ ] **Step 2: ヘルパー関数と2アクション関数をファイル末尾に追加する**

`gas/Code.gs` の末尾（最後の `}` の後）に以下を追記:

```javascript
// ============================================================
// MUSIC HISTORY（音楽生成履歴 サーバー管理）
// 追加日: 2026-04 / 既存コードへの変更なし・追記のみ
// ============================================================

function getMusicHistorySheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("music_history");
  if (!sheet) {
    sheet = ss.insertSheet("music_history");
    sheet.appendRow([
      "id", "user_id", "job_id", "title",
      "audio_url", "download_url", "lyrics",
      "created_at", "expires_at"
    ]);
  }
  return sheet;
}

// action: music_history_save
// body: { userId, jobId, title, audioUrl, downloadUrl, lyrics, createdAt, expiresAt }
function musicHistorySave_(body) {
  var userId      = String(body.userId      || "");
  var jobId       = String(body.jobId       || "");
  var title       = String(body.title       || "");
  var audioUrl    = String(body.audioUrl    || "");
  var downloadUrl = String(body.downloadUrl || "");
  var lyrics      = String(body.lyrics      || "");
  var createdAt   = String(body.createdAt   || new Date().toISOString());
  var expiresAt   = String(body.expiresAt   || "");

  if (!userId || !jobId) return json_({ ok: false, error: "userId_and_jobId_required" });

  var sheet   = getMusicHistorySheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // 同一 job_id が既にあれば上書き（冪等性）
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId &&
        String(data[i][idx["job_id"]])  === jobId) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, idx["title"]        + 1).setValue(title);
      sheet.getRange(rowNum, idx["audio_url"]    + 1).setValue(audioUrl);
      sheet.getRange(rowNum, idx["download_url"] + 1).setValue(downloadUrl);
      sheet.getRange(rowNum, idx["lyrics"]       + 1).setValue(lyrics);
      sheet.getRange(rowNum, idx["expires_at"]   + 1).setValue(expiresAt);
      SpreadsheetApp.flush();
      return json_({ ok: true, action: "updated" });
    }
  }

  // 新規追加
  var id = Utilities.getUuid();
  sheet.appendRow([
    id, userId, jobId, title,
    audioUrl, downloadUrl, lyrics,
    createdAt, expiresAt
  ]);
  SpreadsheetApp.flush();
  return json_({ ok: true, action: "created" });
}

// action: music_history_list
// body: { userId, limit? }
// 返却: 最新50件（expires_at が過去のものは除外）
function musicHistoryList_(body) {
  var userId = String(body.userId || "");
  var limit  = Math.min(Number(body.limit || 50), 50);

  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet   = getMusicHistorySheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) return json_({ ok: true, items: [] });

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var nowIso = new Date().toISOString();
  var items  = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) !== userId) continue;
    var expiresAt = String(data[i][idx["expires_at"]] || "");
    if (expiresAt && expiresAt < nowIso) continue; // 有効期限切れをスキップ
    items.push({
      jobId:       String(data[i][idx["job_id"]]),
      title:       String(data[i][idx["title"]]),
      audioUrl:    String(data[i][idx["audio_url"]]),
      downloadUrl: String(data[i][idx["download_url"]]),
      lyrics:      String(data[i][idx["lyrics"]]),
      createdAt:   String(data[i][idx["created_at"]]),
      expiresAt:   expiresAt,
    });
  }

  // created_at 降順で最新 limit 件
  items.sort(function(a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
  return json_({ ok: true, items: items.slice(0, limit) });
}
```

- [ ] **Step 3: コミットする**

```bash
git add gas/Code.gs
git commit -m "feat(music): 音楽履歴サーバー管理 GAS側追加（music_history_save / music_history_list）"
```

---

## Task 2: Next.js API ルート `/api/music/history` を新規作成する

**Files:**
- Create: `app/api/music/history/route.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
import { NextRequest, NextResponse } from "next/server";

const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_KEY = process.env.GAS_API_KEY!;

// GET /api/music/history?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "music_history_list", userId }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}

// POST /api/music/history
// body: { userId, jobId, title, audioUrl, downloadUrl, lyrics, createdAt, expiresAt }
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.userId || !body.jobId) {
    return NextResponse.json({ ok: false, error: "userId_and_jobId_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "music_history_save", ...body }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 2: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

エラーなし（既存の jest 関連エラーは無視）。

- [ ] **Step 3: コミットする**

```bash
git add app/api/music/history/route.ts
git commit -m "feat(music): /api/music/history エンドポイント追加（GET/POST）"
```

---

## Task 3: `app/music2/page.tsx` にサーバー連携を追加する

**Files:**
- Modify: `app/music2/page.tsx`

変更は3箇所のみ。既存の `saveToHistory` / `loadHistory` は変更しない。

### 変更1: サーバー保存ヘルパー関数を追加（ファイル先頭の関数群に追記）

`saveToHistory` 関数（135行）の直後に以下を追加:

```typescript
// サーバーに履歴を保存（fire-and-forget）
async function saveToServer(entry: MusicHistoryEntry, userId: string): Promise<void> {
  try {
    await fetch("/api/music/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        jobId:       entry.jobId,
        title:       entry.title,
        audioUrl:    entry.audioUrl,
        downloadUrl: entry.downloadUrl,
        lyrics:      entry.lyrics,
        createdAt:   entry.createdAt,
        expiresAt:   entry.expiresAt ?? "",
      }),
    });
  } catch {
    // サーバー保存失敗はサイレントに無視（localStorage に保存済みなので問題なし）
  }
}

// サーバーから履歴を取得してlocalStorageとマージ（jobId で重複排除、createdAt降順）
async function fetchAndMergeHistory(userId: string): Promise<MusicHistoryEntry[]> {
  try {
    const res  = await fetch(`/api/music/history?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (!data.ok) return loadHistory();
    const serverItems: MusicHistoryEntry[] = data.items ?? [];
    const local  = loadHistory();
    const merged = new Map<string, MusicHistoryEntry>();
    // ローカルを先に入れてサーバーで上書き（サーバーが正）
    local.forEach((e)  => merged.set(e.jobId, e));
    serverItems.forEach((e) => merged.set(e.jobId, e));
    const result = Array.from(merged.values())
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .slice(0, 50);
    // マージ結果をlocalStorageにキャッシュ
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch {
    return loadHistory(); // サーバー取得失敗時はlocalStorage fallback
  }
}
```

### 変更2: 初回ロード時にサーバーから取得する

`setHistory(loadHistory())` が呼ばれている箇所（254行付近）を以下に変更:

変更前:
```typescript
    setHistory(loadHistory());
```

変更後:
```typescript
    // まずlocalStorageを即時表示（高速表示）してからサーバーマージ
    setHistory(loadHistory());
    fetchAndMergeHistory(id).then(setHistory).catch(() => {});
```

`id` はその直後で定義される `auth.id` などを使う。変更前後の行を確認してから適切な変数名を使うこと。

### 変更3: 生成完了時にサーバーに保存する（2箇所）

`saveToHistory({...})` が呼ばれる2箇所（355行付近・438行付近）のそれぞれで、`updated` を取得した直後に `saveToServer` を呼ぶ:

**355行付近（パターン1）:**

変更前:
```typescript
              const updated = saveToHistory({
                jobId:       jid,
                title:       rData.title || "無題",
                audioUrl:    rData.audioUrl,
                downloadUrl: rData.downloadUrl ?? rData.audioUrl,
                lyrics:      rData.displayLyrics ?? rData.lyrics ?? "",
                createdAt:   new Date().toISOString(),
              });
              setHistory(updated);
```

変更後:
```typescript
              const updated = saveToHistory({
                jobId:       jid,
                title:       rData.title || "無題",
                audioUrl:    rData.audioUrl,
                downloadUrl: rData.downloadUrl ?? rData.audioUrl,
                lyrics:      rData.displayLyrics ?? rData.lyrics ?? "",
                createdAt:   new Date().toISOString(),
              });
              setHistory(updated);
              if (userId) saveToServer(updated[0], userId).catch(() => {});
```

**438行付近（パターン2）:**

変更前:
```typescript
          const updated = saveToHistory({
            jobId: predictionId,
            title,
            audioUrl: data.outputUrl,
            downloadUrl: data.outputUrl,
            lyrics: "",
            createdAt: new Date().toISOString(),
          });
          setHistory(updated);
```

変更後:
```typescript
          const updated = saveToHistory({
            jobId: predictionId,
            title,
            audioUrl: data.outputUrl,
            downloadUrl: data.outputUrl,
            lyrics: "",
            createdAt: new Date().toISOString(),
          });
          setHistory(updated);
          if (userId) saveToServer(updated[0], userId).catch(() => {});
```

**`userId` 変数について:** `music2/page.tsx` ではコンポーネント内に `userId` 相当の変数が存在するはず。実装時に実際の変数名を確認してから使うこと（`loginId` や `auth?.id` などの可能性あり）。

- [ ] **Step 4: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: コミットする**

```bash
git add app/music2/page.tsx
git commit -m "feat(music): music2 履歴をサーバー管理に対応（サーバー優先・localStorage fallback）"
```

---

## Task 4: 占い診断結果（`dango_result`）をサーバー管理する

**Files:**
- Modify: `gas/Code.gs`（Task 1 で追加したブロックの末尾に追記）
- Create: `app/api/fortune/result/route.ts`
- Modify: `app/fortune/page.tsx`

### 背景

`app/fortune/page.tsx` は診断結果を `localStorage['dango_result']` にのみ保存する。スマホ・PC間で診断結果が共有されないため、別デバイスでは毎回再診断が必要になる。

`StoredDiagnosis` 型:
```typescript
interface StoredDiagnosis {
  finalLabel: string;
  mainId: string;
  mainLabel: string;
  subId: string;
  subLabel: string;
  subPattern: string;
}
```

`loginId` は `localStorage['addval_auth_v1'].id` から取得（ページ内の `openFortune` 関数で既に取得済みのパターンを参照）。

---

### Step 1: GAS に `fortune_results` シートと2アクションを追加する

Task 1 で追加した `// MUSIC HISTORY` ブロックの末尾（`}` の後）に以下を追記:

```javascript
// ============================================================
// FORTUNE RESULTS（占い診断結果 サーバー管理）
// 追加日: 2026-04 / 既存コードへの変更なし・追記のみ
// ============================================================

function getFortuneResultsSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("fortune_results");
  if (!sheet) {
    sheet = ss.insertSheet("fortune_results");
    sheet.appendRow([
      "user_id", "result_json", "created_at", "updated_at"
    ]);
  }
  return sheet;
}

// action: fortune_result_save
// body: { userId, result }  — result は StoredDiagnosis オブジェクト
function fortuneResultSave_(body) {
  var userId     = String(body.userId || "");
  var resultJson = JSON.stringify(body.result || {});
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet   = getFortuneResultsSheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length < 1) return json_({ ok: false, error: "sheet_error" });
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var nowIso = new Date().toISOString();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, idx["result_json"] + 1).setValue(resultJson);
      sheet.getRange(rowNum, idx["updated_at"]  + 1).setValue(nowIso);
      SpreadsheetApp.flush();
      return json_({ ok: true, action: "updated" });
    }
  }

  sheet.appendRow([userId, resultJson, nowIso, nowIso]);
  SpreadsheetApp.flush();
  return json_({ ok: true, action: "created" });
}

// action: fortune_result_get
// body: { userId }
function fortuneResultGet_(body) {
  var userId = String(body.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });

  var sheet   = getFortuneResultsSheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) return json_({ ok: true, result: null });
  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx["user_id"]]) === userId) {
      try {
        var result = JSON.parse(String(data[i][idx["result_json"]] || "null"));
        return json_({ ok: true, result: result });
      } catch(e) {
        return json_({ ok: true, result: null });
      }
    }
  }
  return json_({ ok: true, result: null });
}
```

そして Task 1 で追加したアクションルーターの2行（`music_history_save` / `music_history_list`）の直後に以下を追加:

```javascript
    if (action === 'fortune_result_save') return fortuneResultSave_(body);
    if (action === 'fortune_result_get')  return fortuneResultGet_(body);
```

- [ ] **Step 2: コミットする**

```bash
git add gas/Code.gs
git commit -m "feat(fortune): 占い診断結果サーバー管理 GAS側追加（fortune_result_save / fortune_result_get）"
```

---

### Step 3: Next.js API ルート `/api/fortune/result` を新規作成する

`app/api/fortune/result/route.ts` を以下の内容で作成:

```typescript
import { NextRequest, NextResponse } from "next/server";

const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_KEY = process.env.GAS_API_KEY!;

// GET /api/fortune/result?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "fortune_result_get", userId }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}

// POST /api/fortune/result
// body: { userId, result }
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.userId || !body.result) {
    return NextResponse.json({ ok: false, error: "userId_and_result_required" }, { status: 400 });
  }

  const res = await fetch(`${GAS_URL}?key=${GAS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "fortune_result_save", ...body }),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 4: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: コミットする**

```bash
git add app/api/fortune/result/route.ts
git commit -m "feat(fortune): /api/fortune/result エンドポイント追加（GET/POST）"
```

---

### Step 6: `app/fortune/page.tsx` にサーバー連携を追加する

変更は3箇所のみ。既存の `localStorage.setItem(LS_RESULT, ...)` と `localStorage.getItem(LS_RESULT)` は変更しない。

**変更1: `loginId` 取得ヘルパーを定数定義ブロックの直後（56行の `LS_FORTUNE` 定義の後）に追加する**

```typescript
// ─── Server Sync Helpers ──────────────────────────────────────────────────────
function getLoginIdFromStorage(): string {
  try {
    const raw = localStorage.getItem('addval_auth_v1');
    if (raw) {
      const auth = JSON.parse(raw);
      if (auth?.id) return String(auth.id);
    }
  } catch { /* ignore */ }
  return '';
}

async function saveFortuneResultToServer(loginId: string, result: StoredDiagnosis): Promise<void> {
  try {
    await fetch('/api/fortune/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loginId, result }),
    });
  } catch { /* サーバー保存失敗はサイレントに無視 */ }
}

async function fetchFortuneResultFromServer(loginId: string): Promise<StoredDiagnosis | null> {
  try {
    const res  = await fetch(`/api/fortune/result?userId=${encodeURIComponent(loginId)}`);
    const data = await res.json();
    if (data.ok && data.result) return data.result as StoredDiagnosis;
  } catch { /* ignore */ }
  return null;
}
```

**変更2: 初回ロード時にサーバーから取得してマージする**

`setView('home')` の直前（419行）、Stored diagnosis ブロック（410〜417行）を以下に変更:

変更前:
```typescript
      // Stored diagnosis
      try {
        const raw = localStorage.getItem(LS_RESULT);
        if (raw) {
          const s: StoredDiagnosis = JSON.parse(raw);
          setStored(s);
        }
      } catch { /* ignore */ }

      setView('home');
```

変更後:
```typescript
      // Stored diagnosis — localStorage を即時表示してからサーバーマージ
      let localDiag: StoredDiagnosis | null = null;
      try {
        const raw = localStorage.getItem(LS_RESULT);
        if (raw) localDiag = JSON.parse(raw);
      } catch { /* ignore */ }
      if (localDiag) setStored(localDiag);

      setView('home');

      // サーバーから取得してマージ（loginId があれば）
      const loginId = getLoginIdFromStorage();
      if (loginId) {
        fetchFortuneResultFromServer(loginId).then((serverResult) => {
          if (serverResult) {
            localStorage.setItem(LS_RESULT, JSON.stringify(serverResult));
            setStored(serverResult);
          }
        }).catch(() => {});
      }
```

**変更3: 診断完了時にサーバーに保存する**

`pickAnswer` 関数内の `localStorage.setItem(LS_RESULT, ...)` の直後（442行）に以下を追加:

変更前:
```typescript
    // All answered — run diagnosis
    const r = runDiagnosis(newAnswers, installId, diagConfig);
    localStorage.setItem(LS_RESULT, JSON.stringify(r));
    setStored(r);
    setDisplayDiag(r);
    setView('result');
```

変更後:
```typescript
    // All answered — run diagnosis
    const r = runDiagnosis(newAnswers, installId, diagConfig);
    localStorage.setItem(LS_RESULT, JSON.stringify(r));
    setStored(r);
    setDisplayDiag(r);
    setView('result');
    const lid = getLoginIdFromStorage();
    if (lid) saveFortuneResultToServer(lid, r).catch(() => {});
```

- [ ] **Step 7: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: コミットする**

```bash
git add app/fortune/page.tsx
git commit -m "feat(fortune): 占い診断結果をサーバー管理に対応（サーバー優先・localStorage fallback）"
```

---

## 設計上の重要ポイント

| 項目 | 設計方針 |
|------|----------|
| サーバーが正 | 複数デバイスで同じ履歴・診断結果を表示するためサーバーを正とする |
| localStorage はキャッシュ | 高速表示とオフライン対応のため残す |
| 初回表示は2段階 | localStorage で即時表示 → サーバーデータで更新（ちらつきなし） |
| 保存はfire-and-forget | サーバー保存失敗はサイレントに無視（UX阻害しない） |
| 冪等性 | 同一 `userId` の診断結果は上書き（ユーザーごと1件） |
| 有効期限 | サーバー側でも `expires_at` チェック（音楽履歴のみ・31日） |
| 既存コード変更なし | `saveToHistory` / `loadHistory` / `runDiagnosis` は変更せず上位で連携 |

---

## 注意事項

- `userId` は `music2/page.tsx` 内の実際の変数名を確認してから使うこと（`id`、`loginId`、`userId` などが混在している可能性あり）
- GASデプロイ後にスプレッドシートに `music_history` / `fortune_results` シートが自動作成されることを確認
- 既存の `localStorage` キャッシュは自動的にサーバーデータでマージ・上書きされるため、移行作業は不要
- 占い診断結果はユーザーごとに1件のみ保持（再診断すると上書き）
