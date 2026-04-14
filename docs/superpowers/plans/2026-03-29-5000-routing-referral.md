# /5000 Routing + Referral Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route /5000 group users to a dedicated Google Spreadsheet for all data, and implement a 5-level referral commission system calculated at admin approval time.

**Architecture:** Extend `AuthState` with `group?: string`. When `group === "5000"` is present in API call bodies, GAS routes all reads/writes to the `SPREADSHEET_5000_ID` spreadsheet instead of the main one. Admin approval for /5000 generates login credentials, a unique referral code, traverses the referral chain up to 5 levels, and writes commissions to monthly ledger sheets.

**Tech Stack:** Next.js 14 App Router, TypeScript, Google Apps Script, Google Sheets. No test framework configured — verify with `npm run build` for TS and manual GAS deployment for GAS changes.

**CRITICAL RULE:** Every change to existing files must be additive only. Never delete or restructure existing code. Existing LIFAI users must be completely unaffected.

---

## File Map

**Modified files:**
- `app/lib/auth.ts` — add `group?: string` to `AuthState`
- `app/api/auth/login/route.ts` — forward `group` from body to GAS
- `app/api/me/route.ts` — accept + forward `group` from body to GAS
- `app/api/wallet/balance/route.ts` — accept + forward `group` from body to GAS
- `app/top/page.tsx` — pass `group` in `/api/me` and `/api/wallet/balance` calls
- `app/membership/page.tsx` — pass `group` in `/api/wallet/balance` call
- `app/music/page.tsx` — pass `group` in `/api/me` call
- `app/music/pro/page.tsx` — pass `group` in `/api/me` call
- `app/market/create/page.tsx` — pass `group` in `/api/wallet/balance` GET call
- `middleware.ts` — add `/5000/admin` and `/api/5000/admin` to Basic Auth protection
- `gas/Code.gs` — add `getAppliesSheet5000_()`, `generateRefCode5000_()`, `getLedgerSheet5000_()` helpers; add group routing to `login`/`me`/`get_balance`; add `admin_list_5000` and `admin_approve_5000` actions

**New files:**
- `app/5000/login/page.tsx` — dark-theme login page, sends `group: "5000"`, stores in auth, redirects to /top
- `app/api/5000/admin/list/route.ts` — fetches /5000 applicants from GAS
- `app/api/5000/admin/approve/route.ts` — triggers GAS `admin_approve_5000`
- `app/5000/admin/page.tsx` — /5000 admin panel (separate from existing /admin)

---

## Task 1: Add `group` to AuthState + Create /5000/login Page

**Files:**
- Modify: `app/lib/auth.ts`
- Create: `app/5000/login/page.tsx`

- [ ] **Step 1: Add `group?: string` to AuthState in auth.ts**

In `app/lib/auth.ts`, change:
```typescript
export type AuthState = {
  status: AuthStatus;
  id: string;
  // 将来API化したら token を使う想定（今はモック）
  token?: string;
  plan?: string; // /api/me 取得後にキャッシュ（sessionStorage消滅時のフォールバック用）
  updatedAt: number;
};
```
To:
```typescript
export type AuthState = {
  status: AuthStatus;
  id: string;
  // 将来API化したら token を使う想定（今はモック）
  token?: string;
  plan?: string; // /api/me 取得後にキャッシュ（sessionStorage消滅時のフォールバック用）
  group?: string; // 追加: "5000" | undefined — /5000グループのルーティング用
  updatedAt: number;
};
```

No other changes to auth.ts.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds (no new type errors introduced)

- [ ] **Step 3: Create /5000/login page**

Create `app/5000/login/page.tsx`:
```tsx
// app/5000/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuth, setAuthSecret } from "@/app/lib/auth";

export default function Login5000Page() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    setLoading(true);
    try {
      const trimmedId = id.trim();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmedId, code: pw, group: "5000" }),
      })
        .then((r) => r.json())
        .catch(() => null);

      if (!res) {
        setErr("サーバーエラーが発生しました。しばらく待ってから再度お試しください。");
        return;
      }

      if (res.ok) {
        setAuth({
          status: "approved",
          id: trimmedId,
          token: res.token ?? pw,
          group: "5000",
        });
        setAuthSecret(pw);
        router.push("/top");
        return;
      }

      if (res.reason === "pending") {
        setAuth({ status: "pending", id: trimmedId, group: "5000" });
        router.push("/pending");
        return;
      }

      setErr("IDまたはパスワードが違います。");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !id.trim() || !pw;

  return (
    <main
      style={{ background: "#0A0A0A" }}
      className="relative min-h-screen overflow-hidden text-white"
    >
      {/* 背景グラデーション */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 10% 0%, rgba(108,99,255,0.18), transparent 60%), radial-gradient(900px 600px at 110% 0%, rgba(0,212,255,0.12), transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[480px] px-4 py-12">
        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="text-center">
            <div
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: "#6C63FF" }}
            >
              LIFAI /5000
            </div>
            <div className="mt-2 text-sm text-white/50">
              発行されたIDとパスワードを入力してください
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ログインID"
              autoComplete="username"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/30"
            />

            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="パスワード"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) onSubmit();
              }}
            />

            {err && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {err}
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={disabled}
              className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={
                disabled
                  ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
                  : {
                      background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
                      color: "#fff",
                    }
              }
            >
              {loading ? "確認中..." : "ログイン"}
            </button>

            <div className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              不明な場合は担当者へお問い合わせください。
            </div>
          </div>
        </div>

        <div
          className="mt-6 text-center text-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          © LIFAI
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth.ts app/5000/login/page.tsx
git commit -m "feat: add group field to AuthState + /5000/login page"
```

---

## Task 2: API Routes — Forward `group` to GAS

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/me/route.ts`
- Modify: `app/api/wallet/balance/route.ts`

- [ ] **Step 1: Update /api/auth/login to forward group**

In `app/api/auth/login/route.ts`, change the destructuring line:
```typescript
const { id, code } = await req.json().catch(() => ({}));
```
To:
```typescript
const { id, code, group } = await req.json().catch(() => ({}));
```

And change the GAS body from:
```typescript
body: JSON.stringify({
  action: "login",
  id,
  code,
}),
```
To:
```typescript
body: JSON.stringify({
  action: "login",
  id,
  code,
  group: group || "",
}),
```

- [ ] **Step 2: Update /api/me to accept and forward group**

In `app/api/me/route.ts`, change the `MeRequest` type:
```typescript
type MeRequest = {
  id?: string;
  code?: string;
};
```
To:
```typescript
type MeRequest = {
  id?: string;
  code?: string;
  group?: string;
};
```

Change `safeReadJson` return type reference to pick up the new field (no change needed there — it casts via `as MeRequest`).

Change `callGasMe` signature from:
```typescript
async function callGasMe(gasUrl: string, gasKey: string, id: string, code: string): Promise<GasMeResponse> {
```
To:
```typescript
async function callGasMe(gasUrl: string, gasKey: string, id: string, code: string, group: string): Promise<GasMeResponse> {
```

Inside `callGasMe`, change the GAS POST body from:
```typescript
body: JSON.stringify({ action: "me", id, code }),
```
To:
```typescript
body: JSON.stringify({ action: "me", id, code, group }),
```

In the `POST` handler, change:
```typescript
const id = str(body.id).trim();
const code = str(body.code).trim();
```
To:
```typescript
const id = str(body.id).trim();
const code = str(body.code).trim();
const group = str(body.group).trim();
```

And change the call from:
```typescript
const gasRes = await callGasMe(env.gasUrl, env.gasKey, id, code);
```
To:
```typescript
const gasRes = await callGasMe(env.gasUrl, env.gasKey, id, code, group);
```

- [ ] **Step 3: Update /api/wallet/balance to accept and forward group**

In `app/api/wallet/balance/route.ts`, change the body destructure from:
```typescript
const { id } = await req.json().catch(() => ({}));
```
To:
```typescript
const { id, group } = await req.json().catch(() => ({}));
```

Change the GAS POST body from:
```typescript
body: JSON.stringify({
  action: "get_balance",
  id,
}),
```
To:
```typescript
body: JSON.stringify({
  action: "get_balance",
  id,
  group: group || "",
}),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/login/route.ts app/api/me/route.ts app/api/wallet/balance/route.ts
git commit -m "feat: forward group param from API routes to GAS"
```

---

## Task 3: Existing Pages — Pass `group` in API Calls

**Files:**
- Modify: `app/top/page.tsx`
- Modify: `app/membership/page.tsx`
- Modify: `app/music/page.tsx`
- Modify: `app/music/pro/page.tsx`
- Modify: `app/market/create/page.tsx`

- [ ] **Step 1: Update top/page.tsx — BalanceBadge**

In `app/top/page.tsx`, inside the `BalanceBadge` component, find the fetch call to `/api/wallet/balance`:
```typescript
body: JSON.stringify({ id }),
```
Change to:
```typescript
body: JSON.stringify({ id, group: (auth as any)?.group || "" }),
```

- [ ] **Step 2: Update top/page.tsx — ReferralCard**

In `app/top/page.tsx`, inside the `ReferralCard` component, find the fetch call to `/api/me`:
```typescript
body: JSON.stringify({ id, code }),
```
Change to:
```typescript
body: JSON.stringify({ id, code, group: (auth as any)?.group || "" }),
```

- [ ] **Step 3: Update top/page.tsx — trackEvent wallet call**

In `app/top/page.tsx`, inside the `AppHomePage` component, find the wallet/balance call used for trackEvent (inside the `useEffect` that calls `trackEvent`):
```typescript
body: JSON.stringify({ id }),
```
Change to:
```typescript
body: JSON.stringify({ id, group: auth?.group || "" }),
```

- [ ] **Step 4: Update membership/page.tsx**

In `app/membership/page.tsx`, find the `/api/wallet/balance` fetch call:
```typescript
body: JSON.stringify({ id: userId }),
```
Change to (note: this page reads auth from localStorage directly, so read group the same way):
```typescript
body: JSON.stringify({ id: userId, group: (() => { try { const a = JSON.parse(localStorage.getItem("addval_auth_v1") || "{}"); return a?.group || ""; } catch { return ""; } })() }),
```

- [ ] **Step 5: Update music/page.tsx**

In `app/music/page.tsx`, find the `/api/me` fetch call:
```typescript
body: JSON.stringify({ id, code }),
```
Change to:
```typescript
body: JSON.stringify({ id, code, group: (auth as any)?.group || "" }),
```

Note: `auth` is read from `getAuth()` earlier in the same `useEffect`. Verify the variable is named `auth` at the point of the change (it may be named differently). If the local variable is named differently, adjust accordingly by reading from `getAuth()?.group || ""`.

- [ ] **Step 6: Update music/pro/page.tsx**

In `app/music/pro/page.tsx`, find the `/api/me` fetch call (around line 276):
```typescript
body: JSON.stringify({ id, code }),
```
Change to:
```typescript
body: JSON.stringify({ id, code, group: (getAuth() as any)?.group || "" }),
```

Ensure `getAuth` is imported at the top of the file. If not already imported, add it to the existing import from `@/app/lib/auth`.

- [ ] **Step 7: Update market/create/page.tsx**

In `app/market/create/page.tsx`, find the wallet/balance GET fetch (around line 53):
```typescript
`/api/wallet/balance?id=${encodeURIComponent(myId)}&code=${encodeURIComponent(myCode)}`
```
Change to:
```typescript
`/api/wallet/balance?id=${encodeURIComponent(myId)}&code=${encodeURIComponent(myCode)}&group=${encodeURIComponent((() => { try { const a = JSON.parse(localStorage.getItem("addval_auth_v1") || "{}"); return a?.group || ""; } catch { return ""; } })())}`
```

Also update `/api/wallet/balance/route.ts` to handle `group` from GET query params. Add a GET handler after the existing POST handler:
```typescript
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    const group = url.searchParams.get("group") || "";

    const gasBaseUrl = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;

    if (!gasBaseUrl || !key) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY"] },
        { status: 500 }
      );
    }
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    const hasQuery = gasBaseUrl.includes("?");
    const gasUrl = `${gasBaseUrl}${hasQuery ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const r = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "get_balance",
        id,
        group: group || "",
      }),
    });

    const text = await r.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add app/top/page.tsx app/membership/page.tsx app/music/page.tsx app/music/pro/page.tsx app/market/create/page.tsx app/api/wallet/balance/route.ts
git commit -m "feat: pass group param from existing pages to API calls"
```

---

## Task 4: Middleware — Protect /5000/admin Routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add /5000/admin protection to middleware**

In `middleware.ts`, change the `isProtected` check from:
```typescript
const isProtected =
  pathname.startsWith("/admin") ||
  pathname.startsWith("/api/admin") ||
  pathname.startsWith("/note-generator") ||
  pathname.startsWith("/api/note");
```
To:
```typescript
const isProtected =
  pathname.startsWith("/admin") ||
  pathname.startsWith("/api/admin") ||
  pathname.startsWith("/5000/admin") ||
  pathname.startsWith("/api/5000/admin") ||
  pathname.startsWith("/note-generator") ||
  pathname.startsWith("/api/note");
```

Also update the `matcher` config from:
```typescript
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/note-generator/:path*", "/note-generator", "/api/note/:path*"],
};
```
To:
```typescript
export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/5000/admin/:path*",
    "/5000/admin",
    "/api/5000/admin/:path*",
    "/note-generator/:path*",
    "/note-generator",
    "/api/note/:path*",
  ],
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Basic Auth protection for /5000/admin routes"
```

---

## Task 5: GAS Phase 1-B — /5000 Sheet Routing for login/me/get_balance

**Files:**
- Modify: `gas/Code.gs`

This task adds helper functions and routes `login`, `me`, and `get_balance` to the /5000 spreadsheet when `body.group === "5000"`.

**All changes are additive. The existing action blocks are modified minimally — only adding a `targetSheet` local variable and replacing `sheet` usage within those blocks.**

- [ ] **Step 1: Add helper functions at the bottom of Code.gs (before the final closing)**

Add these three functions near the end of `gas/Code.gs`, before the last utility functions (e.g., before the `str_` / `num_` helpers area, or at the very end):

```javascript
// ==============================
// ✅ /5000 スプレッドシートのappliesシートを返す（group:"5000" ルーティング用）
// ==============================
function getAppliesSheet5000_() {
  var ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
  if (!ssId) throw new Error("SPREADSHEET_5000_ID not set");
  var ss5000 = SpreadsheetApp.openById(ssId);
  var s = ss5000.getSheetByName("applies");
  if (!s) throw new Error("applies sheet not found in SPREADSHEET_5000_ID");
  return s;
}

// ==============================
// ✅ /5000 紹介コード生成（"5K" + 6文字：紛らわしい文字除外）
// ==============================
function generateRefCode5000_(applySheet, idx) {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var allRows = applySheet.getDataRange().getValues();
  var existing = allRows.map(function(r) { return str_(r[idx["my_ref_code"]] || ""); });
  var code;
  var maxTries = 200;
  var tries = 0;
  do {
    code = "5K";
    for (var i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    tries++;
  } while (existing.indexOf(code) >= 0 && tries < maxTries);
  return code;
}

// ==============================
// ✅ /5000 月別台帳シートを取得または作成
// yearMonth 形式: "2026_03"
// ==============================
function getLedgerSheet5000_(ss5000, yearMonth) {
  var name = "ledger_" + yearMonth;
  var s = ss5000.getSheetByName(name);
  if (!s) {
    s = ss5000.insertSheet(name);
    s.appendRow(["created_at", "to_login_id", "type", "amount_usd", "from_apply_id", "level", "memo"]);
  }
  return s;
}
```

- [ ] **Step 2: Add group routing to the `login` action**

In `gas/Code.gs`, find the `login` action block which begins with:
```javascript
if (action === "login") {
  const id = str_(body.id);
  const code = str_(body.code);

  if (!id || !code) {
    return json_({ ok: false, reason: "invalid" });
  }

  let values = sheet.getDataRange().getValues();
  let header = values[0];

  // ✅ 必要列保証（壊さない）
  ensureCols_(sheet, header, ["login_id", "pw_hash", "email", "status"]);

  values = sheet.getDataRange().getValues();
  header = values[0];
```

Insert these two lines immediately after `const code = str_(body.code);` and before the `if (!id || !code)` check:
```javascript
  const group_login = str_(body.group);
  const targetSheet_login = group_login === "5000" ? getAppliesSheet5000_() : sheet;
```

Then replace every occurrence of `sheet` with `targetSheet_login` within this `if (action === "login")` block only. The block ends at the `return json_({ ok: true });` line (line ~2783). The replacements are:

- `sheet.getDataRange().getValues()` → `targetSheet_login.getDataRange().getValues()` (two occurrences)
- `ensureCols_(sheet, header, ...)` → `ensureCols_(targetSheet_login, header, ...)`

Do NOT change any `sheet` references outside this block.

The final result of the login block should look like:
```javascript
if (action === "login") {
  const id = str_(body.id);
  const code = str_(body.code);
  const group_login = str_(body.group);
  const targetSheet_login = group_login === "5000" ? getAppliesSheet5000_() : sheet;

  if (!id || !code) {
    return json_({ ok: false, reason: "invalid" });
  }

  let values = targetSheet_login.getDataRange().getValues();
  let header = values[0];

  // ✅ 必要列保証（壊さない）
  ensureCols_(targetSheet_login, header, ["login_id", "pw_hash", "email", "status"]);

  values = targetSheet_login.getDataRange().getValues();
  header = values[0];

  const idx = indexMap_(header);
  const rows = values.slice(1);

  let hit = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowIndex = i + 2;

    const loginId = str_(r[idx["login_id"]]);
    const email = str_(r[idx["email"]]);

    if (id === loginId || id === email) {
      hit = { r: r, rowIndex: rowIndex };
      break;
    }
  }

  if (!hit) return json_({ ok: false, reason: "invalid" });

  const status = str_(hit.r[idx["status"]]);
  if (status !== "approved") return json_({ ok: false, reason: "pending" });

  const loginId = str_(hit.r[idx["login_id"]]);
  const pwHashSaved = str_(hit.r[idx["pw_hash"]]);

  if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

  const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
  if (pwHashInput !== pwHashSaved) return json_({ ok: false, reason: "invalid" });

  return json_({ ok: true });
}
```

- [ ] **Step 3: Add group routing to the `me` action**

Find the `me` action block (starts around line 2647). Insert immediately after `const code = str_(body.code);`:
```javascript
  const group_me = str_(body.group);
  const targetSheet_me = group_me === "5000" ? getAppliesSheet5000_() : sheet;
```

Replace all `sheet` usages within this `if (action === "me")` block with `targetSheet_me`. The sheet is used in:
- `sheet.getDataRange().getValues()` (twice)
- `ensureCols_(sheet, header, [...])`

Do NOT change any `sheet` references outside this block.

The resulting me block should use `targetSheet_me` in exactly those three places, with all other logic unchanged.

- [ ] **Step 4: Add group routing to the `get_balance` action**

Find the `get_balance` action block (starts around line 1377). Insert immediately after `const id = str_(body.id);`:
```javascript
  const group_bal = str_(body.group);
  const targetSheet_bal = group_bal === "5000" ? getAppliesSheet5000_() : sheet;
```

Replace all `sheet` usages within this `if (action === "get_balance")` block with `targetSheet_bal`. The sheet is used in:
- `sheet.getDataRange().getValues()`
- `ensureCols_(sheet, header, [...])`
- Second `sheet.getDataRange().getValues()` after ensureCols_

Do NOT change any `sheet` references outside this block.

- [ ] **Step 5: Deploy GAS and verify Phase 1-B**

1. Copy the full contents of `gas/Code.gs` into the GAS editor
2. Deploy as a new version (Deploy → Manage deployments → New version)
3. Manual test: send a POST to the GAS webapp URL with:
   ```json
   { "action": "login", "id": "TEST_ID", "code": "TEST_PW", "group": "5000" }
   ```
   Expected: `{ "ok": false, "reason": "invalid" }` (not an "unauthorized" or error, meaning the /5000 sheet was reached)
4. Verify the main LIFAI login still works (send same request without `group` — should use main sheet)

- [ ] **Step 6: Commit**

```bash
git add gas/Code.gs
git commit -m "feat: GAS group routing for login/me/get_balance + helper functions"
```

---

## Task 6: GAS Phase 2-A — admin_list_5000 + admin_approve_5000 Actions

**Files:**
- Modify: `gas/Code.gs`

This task adds two new GAS actions. Both actions are completely new additions — no existing code is modified.

- [ ] **Step 1: Add admin_list_5000 action to handle_()**

In `gas/Code.gs`, find the line just before `// actionが不明` (the fallthrough at the end of `handle_()`, around line 2786):
```javascript
  // actionが不明
  return json_({ ok: false, error: "bad_action" });
```

Insert the following new action block immediately before that line:

```javascript
  // =========================================================
  // admin_list_5000（/5000スプレッドシートの申請一覧を返す）
  // =========================================================
  if (action === "admin_list_5000") {
    const adminKey_5000list = str_(body.adminKey);
    if (adminKey_5000list !== ADMIN_SECRET) {
      return json_({ ok: false, error: "forbidden" });
    }

    const ssId_list = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_list) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss5000_list = SpreadsheetApp.openById(ssId_list);
    const applySheet_list = ss5000_list.getSheetByName("applies");
    if (!applySheet_list) return json_({ ok: true, rows: [] });

    const allValues = applySheet_list.getDataRange().getValues();
    if (allValues.length < 2) return json_({ ok: true, rows: [] });

    const listHeader = allValues[0];
    const rows = allValues.slice(1).map(function(r, i) {
      var obj = {};
      listHeader.forEach(function(h, j) { obj[String(h)] = str_(r[j]); });
      obj["_rowIndex"] = i + 2;
      return obj;
    });

    return json_({ ok: true, rows: rows });
  }

  // =========================================================
  // admin_approve_5000（/5000申請を承認 + 紹介報酬計算）
  // =========================================================
  if (action === "admin_approve_5000") {
    const adminKey_5000 = str_(body.adminKey);
    if (adminKey_5000 !== ADMIN_SECRET) {
      return json_({ ok: false, error: "forbidden" });
    }

    const applyId_5000 = str_(body.applyId);
    if (!applyId_5000) return json_({ ok: false, error: "applyId required" });

    const ssId_5000 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_5000) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss5000 = SpreadsheetApp.openById(ssId_5000);
    const applySheet_5000 = ss5000.getSheetByName("applies");
    if (!applySheet_5000) return json_({ ok: false, error: "applies sheet not found" });

    // 必要列を保証（壊さない）
    let header_5000 = applySheet_5000.getDataRange().getValues()[0];
    ensureCols_(applySheet_5000, header_5000, [
      "apply_id", "plan", "email", "name", "status", "ref_id",
      "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error"
    ]);
    // ensureCols_ 後はヘッダーを再取得
    var lastCol_5000 = applySheet_5000.getLastColumn();
    header_5000 = applySheet_5000.getRange(1, 1, 1, lastCol_5000).getValues()[0];
    var idx_5000 = indexMap_(header_5000);

    // applyId で行を検索
    var allData_5000 = applySheet_5000.getDataRange().getValues();
    var targetRow_5000 = -1;
    for (var ri = 1; ri < allData_5000.length; ri++) {
      if (str_(allData_5000[ri][idx_5000["apply_id"]]) === applyId_5000) {
        targetRow_5000 = ri + 1; // 1-indexed for getRange
        break;
      }
    }
    if (targetRow_5000 < 0) return json_({ ok: false, error: "applyId not found" });

    // 既に approved 済みなら OK を返す（冪等）
    var curStatus_5000 = str_(applySheet_5000.getRange(targetRow_5000, idx_5000["status"] + 1).getValue());
    if (curStatus_5000 === "approved") {
      return json_({
        ok: true,
        already: true,
        loginId: str_(applySheet_5000.getRange(targetRow_5000, idx_5000["login_id"] + 1).getValue())
      });
    }

    var email_5000 = str_(applySheet_5000.getRange(targetRow_5000, idx_5000["email"] + 1).getValue());
    if (!email_5000) return json_({ ok: false, error: "no_email" });

    // login_id 生成（未設定の場合のみ）
    var loginId_5000 = str_(applySheet_5000.getRange(targetRow_5000, idx_5000["login_id"] + 1).getValue());
    if (!loginId_5000) {
      loginId_5000 = "5k_" + randChars_(6);
      applySheet_5000.getRange(targetRow_5000, idx_5000["login_id"] + 1).setValue(loginId_5000);
    }

    // my_ref_code 生成（未設定の場合のみ）
    var myRefCode_5000 = str_(applySheet_5000.getRange(targetRow_5000, idx_5000["my_ref_code"] + 1).getValue());
    if (!myRefCode_5000) {
      myRefCode_5000 = generateRefCode5000_(applySheet_5000, idx_5000);
      applySheet_5000.getRange(targetRow_5000, idx_5000["my_ref_code"] + 1).setValue(myRefCode_5000);
    }

    // リセットトークン生成
    var token_5000 = genResetToken_();
    var expires_5000 = new Date(Date.now() + 72 * 60 * 60 * 1000);
    applySheet_5000.getRange(targetRow_5000, idx_5000["reset_token"] + 1).setValue(token_5000);
    applySheet_5000.getRange(targetRow_5000, idx_5000["reset_expires"] + 1).setValue(expires_5000);
    applySheet_5000.getRange(targetRow_5000, idx_5000["reset_used_at"] + 1).setValue("");

    // ステータスを approved に更新
    applySheet_5000.getRange(targetRow_5000, idx_5000["status"] + 1).setValue("approved");

    // パスワードリセットメール送信（二重送信防止）
    var sentAt_5000 = applySheet_5000.getRange(targetRow_5000, idx_5000["reset_sent_at"] + 1).getValue();
    var resetSent_5000 = false;
    if (!sentAt_5000) {
      try {
        sendResetMail_(email_5000, loginId_5000, token_5000);
        applySheet_5000.getRange(targetRow_5000, idx_5000["reset_sent_at"] + 1).setValue(new Date());
        if (idx_5000["mail_error"] !== undefined) {
          applySheet_5000.getRange(targetRow_5000, idx_5000["mail_error"] + 1).setValue("");
        }
        resetSent_5000 = true;
        Logger.log("[admin_approve_5000] mail sent OK: to=" + email_5000 + " loginId=" + loginId_5000);
      } catch (mailErr_5000) {
        var mailErrMsg_5000 = String(mailErr_5000);
        Logger.log("[admin_approve_5000] mail FAILED: " + mailErrMsg_5000);
        if (idx_5000["mail_error"] !== undefined) {
          applySheet_5000.getRange(targetRow_5000, idx_5000["mail_error"] + 1).setValue(mailErrMsg_5000);
        }
        return json_({ ok: false, error: "mail_failed: " + mailErrMsg_5000 });
      }
    } else {
      resetSent_5000 = true;
    }

    // ========================================
    // 紹介チェーン遡り（最大5段）+ 月別台帳記録
    // ========================================
    var planStr_5000 = str_(applySheet_5000.getRange(targetRow_5000, idx_5000["plan"] + 1).getValue());
    var planAmountMap = { "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 };
    var entryAmount_5000 = planAmountMap[planStr_5000] || 0;

    var refRates_5000 = [0.10, 0.05, 0.02, 0.02, 0.01];
    var yearMonth_5000 = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy_MM");
    var ledgerSheet_5000 = getLedgerSheet5000_(ss5000, yearMonth_5000);

    var referralResults_5000 = [];
    var currentRefCode_5000 = str_(applySheet_5000.getRange(targetRow_5000, idx_5000["ref_id"] + 1).getValue());

    for (var lvl = 1; lvl <= 5 && currentRefCode_5000; lvl++) {
      // my_ref_code が currentRefCode_5000 に一致する行を探す
      var chainData = applySheet_5000.getDataRange().getValues();
      var referrerLoginId_5000 = "";
      var referrerRefId_5000 = "";

      for (var ci = 1; ci < chainData.length; ci++) {
        var rowRefCode = str_(chainData[ci][idx_5000["my_ref_code"]]);
        if (rowRefCode === currentRefCode_5000) {
          referrerLoginId_5000 = str_(chainData[ci][idx_5000["login_id"]]);
          referrerRefId_5000 = str_(chainData[ci][idx_5000["ref_id"]]);
          break;
        }
      }

      if (!referrerLoginId_5000) break; // 紹介者が見つからない or ルート到達

      if (entryAmount_5000 > 0) {
        var rate_5000 = refRates_5000[lvl - 1];
        var commission_5000 = Math.round(entryAmount_5000 * rate_5000 * 100) / 100;
        var levelSuffix = lvl === 1 ? "st" : lvl === 2 ? "nd" : lvl === 3 ? "rd" : "th";
        var memo_5000 = "$" + entryAmount_5000 + " plan " + lvl + levelSuffix + " level " + Math.round(rate_5000 * 100) + "%";

        ledgerSheet_5000.appendRow([
          new Date(),
          referrerLoginId_5000,
          "referral_entry",
          commission_5000,
          applyId_5000,
          lvl,
          memo_5000
        ]);
        referralResults_5000.push({ level: lvl, to: referrerLoginId_5000, amount: commission_5000 });
        Logger.log("[admin_approve_5000] referral lvl=" + lvl + " to=" + referrerLoginId_5000 + " amount=" + commission_5000);
      }

      currentRefCode_5000 = referrerRefId_5000;
    }

    return json_({
      ok: true,
      loginId: loginId_5000,
      myRefCode: myRefCode_5000,
      resetSent: resetSent_5000,
      referralResults: referralResults_5000
    });
  }
```

- [ ] **Step 2: Deploy GAS and verify**

1. Copy the full contents of `gas/Code.gs` into the GAS editor and deploy as a new version
2. Manual test of `admin_list_5000`:
   - Send GET: `GAS_URL?action=admin_list_5000&key=YOUR_KEY&adminKey=YOUR_ADMIN_KEY`
   - Expected: `{ "ok": true, "rows": [...] }` (may be empty array if no applies yet)
3. Manual test of `admin_approve_5000` (use a test apply from the /5000 sheet):
   - Send POST with `{ "action": "admin_approve_5000", "adminKey": "...", "applyId": "5000_..." }`
   - Expected: `{ "ok": true, "loginId": "5k_...", "myRefCode": "5K...", "resetSent": true, "referralResults": [...] }`
4. Verify the main LIFAI `admin_approve` action still works (no regression)

- [ ] **Step 3: Commit**

```bash
git add gas/Code.gs
git commit -m "feat: GAS admin_list_5000 + admin_approve_5000 with referral chain"
```

---

## Task 7: /5000/admin Page + API Routes

**Files:**
- Create: `app/api/5000/admin/list/route.ts`
- Create: `app/api/5000/admin/approve/route.ts`
- Create: `app/5000/admin/page.tsx`

- [ ] **Step 1: Create /api/5000/admin/list/route.ts**

```typescript
// app/api/5000/admin/list/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const base = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
        { status: 500 }
      );
    }

    const url =
      `${base}?action=admin_list_5000` +
      `&key=${encodeURIComponent(key)}` +
      `&adminKey=${encodeURIComponent(adminKey)}`;

    const res = await fetch(url, { method: "GET", cache: "no-store" });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create /api/5000/admin/approve/route.ts**

```typescript
// app/api/5000/admin/approve/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const applyId = String(body?.applyId || "");

    const base = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
        { status: 500 }
      );
    }

    if (!applyId) {
      return NextResponse.json({ ok: false, error: "applyId required" }, { status: 400 });
    }

    const hasQuery = base.includes("?");
    const gasUrl = `${base}${hasQuery ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "admin_approve_5000",
        adminKey,
        applyId,
      }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create /5000/admin/page.tsx**

```tsx
// app/5000/admin/page.tsx
"use client";

import { useEffect, useState } from "react";

type ApplyRow = {
  apply_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  ref_id: string;
  created_at: string;
  login_id?: string;
  my_ref_code?: string;
  _rowIndex: string;
  [key: string]: string | undefined;
};

export default function Admin5000Page() {
  const [rows, setRows] = useState<ApplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/5000/admin/list", { cache: "no-store" });
      const data: any = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        setRows(data.rows || []);
      } else {
        setErr(data.error || "fetch failed");
      }
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (applyId: string) => {
    if (!applyId) return;
    setApproving(applyId);
    setMessages((m) => ({ ...m, [applyId]: "承認中..." }));
    try {
      const res = await fetch("/api/5000/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyId }),
      });
      const data: any = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        const msg = data.already
          ? `承認済み (loginId: ${data.loginId})`
          : `承認完了 (loginId: ${data.loginId}, refCode: ${data.myRefCode}, mail: ${data.resetSent ? "送信済" : "失敗"}, referralResults: ${JSON.stringify(data.referralResults)})`;
        setMessages((m) => ({ ...m, [applyId]: msg }));
        await load();
      } else {
        setMessages((m) => ({ ...m, [applyId]: `エラー: ${data.error || "unknown"}` }));
      }
    } catch (e: any) {
      setMessages((m) => ({ ...m, [applyId]: `エラー: ${String(e)}` }));
    } finally {
      setApproving(null);
    }
  };

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const other = rows.filter((r) => r.status !== "pending" && r.status !== "approved");

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold" style={{ color: "#6C63FF" }}>
            LIFAI /5000 管理パネル
          </h1>
          <button
            onClick={load}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            更新
          </button>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-white/50">読み込み中...</p>
        )}
        {err && (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
            エラー: {err}
          </div>
        )}

        {!loading && !err && (
          <>
            <section className="mt-8">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                承認待ち ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-white/30">承認待ちの申請はありません</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-2 px-3 text-left text-white/50 font-medium">申請ID</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">氏名</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">メール</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">プラン</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">紹介コード</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">日時</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((row) => (
                        <tr key={row.apply_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-xs text-white/60">{row.apply_id}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3 text-white/70">{row.email}</td>
                          <td className="py-2 px-3">
                            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                              ${row.plan}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-white/60">{row.ref_id || "—"}</td>
                          <td className="py-2 px-3 text-xs text-white/40">{row.created_at}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => approve(row.apply_id)}
                              disabled={approving === row.apply_id}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                              style={
                                approving === row.apply_id
                                  ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                                  : { background: "linear-gradient(135deg, #6C63FF, #00D4FF)", color: "#fff" }
                              }
                            >
                              {approving === row.apply_id ? "承認中..." : "承認"}
                            </button>
                            {messages[row.apply_id] && (
                              <p className="mt-1 text-[10px] text-white/50 max-w-xs break-all">
                                {messages[row.apply_id]}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                承認済み ({approved.length})
              </h2>
              {approved.length === 0 ? (
                <p className="mt-3 text-sm text-white/30">承認済みの申請はありません</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-2 px-3 text-left text-white/50 font-medium">ログインID</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">氏名</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">メール</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">プラン</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">紹介コード</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">申請ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approved.map((row) => (
                        <tr key={row.apply_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-xs text-cyan-400">{row.login_id || "—"}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3 text-white/70">{row.email}</td>
                          <td className="py-2 px-3">
                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                              ${row.plan}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-purple-300">{row.my_ref_code || "—"}</td>
                          <td className="py-2 px-3 font-mono text-xs text-white/40">{row.apply_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {other.length > 0 && (
              <section className="mt-10">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                  その他 ({other.length})
                </h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-2 px-3 text-left text-white/50 font-medium">申請ID</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">ステータス</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">氏名</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">メール</th>
                      </tr>
                    </thead>
                    <tbody>
                      {other.map((row) => (
                        <tr key={row.apply_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-xs text-white/40">{row.apply_id}</td>
                          <td className="py-2 px-3 text-xs text-yellow-400">{row.status}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3 text-white/70">{row.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Verify middleware protects /5000/admin**

Start dev server (`npm run dev`), navigate to `http://localhost:3000/5000/admin` without credentials. Expected: browser shows 401 Unauthorized dialog.

- [ ] **Step 6: Commit**

```bash
git add app/api/5000/admin/list/route.ts app/api/5000/admin/approve/route.ts app/5000/admin/page.tsx
git commit -m "feat: /5000/admin page + API routes (list + approve)"
```

---

## End-to-End Verification Checklist

After all tasks are complete, verify the following manually:

**Phase 1 — Routing:**
- [ ] Existing LIFAI users can still log in via `/login` (no group in auth state, uses main sheet)
- [ ] `/5000/login` page renders with dark theme
- [ ] A /5000 user can log in via `/5000/login` → redirected to `/top`
- [ ] After /5000 login, `localStorage.getItem("addval_auth_v1")` contains `"group":"5000"`
- [ ] `/top` page loads for /5000 user, `BalanceBadge` shows balance from /5000 sheet
- [ ] `/top` page shows referral code from /5000 sheet (once approved and `my_ref_code` is set)

**Phase 2 — Admin + Referral:**
- [ ] `/5000/admin` is protected by Basic Auth
- [ ] Pending applies from /5000 sheet appear in `/5000/admin`
- [ ] Clicking approve generates `loginId`, `my_ref_code`, sends reset email
- [ ] After approving an applicant with a valid `ref_id`, the monthly `ledger_YYYY_MM` sheet is created and contains a row for level 1 commission
- [ ] Approving the same applicant twice returns `{ already: true }` (idempotent)
- [ ] Main LIFAI `/admin` still works and approves from the main sheet (no regression)
