# Admin Finance Page 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin` 最下部にパスワードロック付きゲートウェイを追加し、解錠後に `/admin/finance` ページへ遷移。finance ページではユーザー詳細・アフィリエイト履歴・紹介ツリー（ドラッグ&ドロップ再紐づけ付き）を一括管理できる。

**Architecture:** GAS に `wallet_ledger_all` / `ref_reassign` アクションを追加し、Next.js API ルートがプロキシ。finance ページは sessionStorage トークンで保護。タブ切り替え式の 3 コンポーネント構成。

**Tech Stack:** Google Apps Script (GAS), Next.js 14 App Router, TypeScript, Tailwind CSS dark theme, Node.js crypto (HMAC-SHA256), HTML5 Drag API, SVG + foreignObject

---

## ファイル構成

**新規作成:**
```
gas/Code.gs                                    (GAS に 2 アクション追加)
app/api/admin/finance-unlock/route.ts
app/api/admin/verify-finance-token/route.ts
app/api/admin/wallet-ledger/route.ts
app/api/admin/ref-reassign/route.ts
app/admin/finance/page.tsx
app/admin/finance/UsersTab.tsx
app/admin/finance/AffiliateTab.tsx
app/admin/finance/TreeTab.tsx
```

**変更:**
```
app/admin/page.tsx    (最下部にゲートウェイセクション追加)
.env.local            (FINANCE_UNLOCK_PASS / FINANCE_HMAC_SECRET を追記)
```

---

## Task 1: GAS — wallet_ledger_all / ref_reassign アクション追加

**Files:**
- Modify: `gas/Code.gs` (行 1428〜1429 の間 — `ref_tree_build` の `return` 直後、`send_test_mail` の前に挿入)

### GAS への挿入方針

`ref_tree_build` アクションブロックの最後の行は：
```
    return json_({ ok: true, l1_count: l1s.length, rows: out.length });
  }
```

この直後（`send_test_mail` のコメントブロック手前）に下記 2 アクションを挿入する。

- [ ] **Step 1: `wallet_ledger_all` アクションを挿入**

`gas/Code.gs` の以下の文字列を検索して Edit ツールで置換：

```
    return json_({ ok: true, l1_count: l1s.length, rows: out.length });
  }

  // =========================================================
  // ✅ send_test_mail
```

置換後：

```
    return json_({ ok: true, l1_count: l1s.length, rows: out.length });
  }

  // =========================================================
  // ✅ wallet_ledger_all（管理：wallet_ledger シート全行を返す）
  // - finance ページのユーザー詳細・アフィリエイトタブで使用
  // =========================================================
  if (action === "wallet_ledger_all") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const led = ss.getSheetByName("wallet_ledger");
    if (!led) return json_({ ok: true, items: [] });

    const ledValues = getValuesSafe_(led);
    if (ledValues.length < 2) return json_({ ok: true, items: [] });

    const ledHeader = ledValues[0];
    const ledIdx = indexMap_(ledHeader);
    const items = ledValues.slice(1).map(function(r) {
      return {
        ts:       str_(r[ledIdx["ts"]]),
        kind:     str_(r[ledIdx["kind"]]),
        login_id: str_(r[ledIdx["login_id"]]),
        email:    str_(r[ledIdx["email"]]),
        amount:   num_(r[ledIdx["amount"]]),
        memo:     str_(r[ledIdx["memo"]]),
      };
    }).filter(function(it) { return it.login_id || it.kind; });

    return json_({ ok: true, items: items });
  }

  // =========================================================
  // ✅ ref_reassign（管理：紹介者の変更 + referrer_2〜5 再計算）
  // - targetLoginId の referrer_login_id を newReferrerLoginId に変更
  // - referrer_2〜5 / ref_path を再計算して更新
  // - ref_events に監査ログを記録
  // - 制約: target 不在 / 自己紹介 / 循環参照はエラー
  // =========================================================
  if (action === "ref_reassign") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const targetLoginId    = str_(body.targetLoginId);
    const newReferrerLoginId = str_(body.newReferrerLoginId);
    const note             = str_(body.note) || "admin_finance_drag";

    if (!targetLoginId) {
      return json_({ ok: false, error: "missing_targetLoginId" });
    }
    if (newReferrerLoginId && targetLoginId === newReferrerLoginId) {
      return json_({ ok: false, error: "self_referral" });
    }

    const rrSheet = getOrCreateSheet_();
    ensureCols_(rrSheet, getValuesSafe_(rrSheet)[0], [
      "login_id", "referrer_login_id",
      "referrer_2_login_id", "referrer_3_login_id",
      "referrer_4_login_id", "referrer_5_login_id", "ref_path"
    ]);

    const rrValues = getValuesSafe_(rrSheet);
    const rrHeader = rrValues[0];
    const rrIdx    = indexMap_(rrHeader);

    // target の行インデックスを探す（1-based）
    let targetRowIndex = -1;
    for (let ri = 1; ri < rrValues.length; ri++) {
      if (str_(rrValues[ri][rrIdx["login_id"]]) === targetLoginId) {
        targetRowIndex = ri + 1;
        break;
      }
    }
    if (targetRowIndex === -1) {
      return json_({ ok: false, error: "target_not_found" });
    }

    // 循環参照チェック: newReferrer の既存チェーンを上に辿り targetLoginId が出たらNG
    if (newReferrerLoginId) {
      const rrVisited = new Set();
      let rrCur = newReferrerLoginId;
      while (rrCur && !rrVisited.has(rrCur)) {
        if (rrCur === targetLoginId) {
          return json_({ ok: false, error: "circular_reference" });
        }
        rrVisited.add(rrCur);
        let rrNext = null;
        for (let ri = 1; ri < rrValues.length; ri++) {
          if (str_(rrValues[ri][rrIdx["login_id"]]) === rrCur) {
            rrNext = str_(rrValues[ri][rrIdx["referrer_login_id"]]) || null;
            break;
          }
        }
        rrCur = rrNext;
      }
    }

    // 新チェーン構築: newReferrerLoginId → その referrer を順に辿る（最大5段）
    const newChain = [];
    if (newReferrerLoginId) {
      newChain.push(newReferrerLoginId);
      const chainVisited = new Set([newReferrerLoginId]);
      let chainCur = newReferrerLoginId;
      while (newChain.length < 5) {
        let chainNext = null;
        for (let ri = 1; ri < rrValues.length; ri++) {
          if (str_(rrValues[ri][rrIdx["login_id"]]) === chainCur) {
            chainNext = str_(rrValues[ri][rrIdx["referrer_login_id"]]) || null;
            break;
          }
        }
        if (!chainNext || chainVisited.has(chainNext)) break;
        chainVisited.add(chainNext);
        newChain.push(chainNext);
        chainCur = chainNext;
      }
    }

    // ref_path = "target > ref1 > ref2 > ..."
    const refPathParts = [targetLoginId].concat(newChain);
    const newRefPath = refPathParts.join(" > ");

    // シートに書き込む
    const writeCols = [
      "referrer_login_id", "referrer_2_login_id", "referrer_3_login_id",
      "referrer_4_login_id", "referrer_5_login_id", "ref_path"
    ];
    const writeVals = [
      newChain[0] || "", newChain[1] || "", newChain[2] || "",
      newChain[3] || "", newChain[4] || "", newRefPath
    ];
    for (let ci = 0; ci < writeCols.length; ci++) {
      if (rrIdx[writeCols[ci]] !== undefined) {
        rrSheet.getRange(targetRowIndex, rrIdx[writeCols[ci]] + 1).setValue(writeVals[ci]);
      }
    }

    // 監査ログ
    appendRefEvent_({
      new_login_id:       targetLoginId,
      new_email:          "",
      used_ref_code:      "",
      ref1_login_id:      newChain[0] || "",
      ref2_login_id:      newChain[1] || "",
      ref3_login_id:      newChain[2] || "",
      note:               note,
    });

    return json_({ ok: true, targetLoginId: targetLoginId, newReferrerLoginId: newReferrerLoginId });
  }

  // =========================================================
  // ✅ send_test_mail
```

- [ ] **Step 2: GAS 構文チェック**

```bash
node -e "
const fs = require('fs');
const code = fs.readFileSync('gas/Code.gs', 'utf8');
try { new Function(code); console.log('SYNTAX OK'); }
catch(e) { console.error('SYNTAX ERROR:', e.message); process.exit(1); }
"
```

Expected: `SYNTAX OK`

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add wallet_ledger_all and ref_reassign admin actions"
```

---

## Task 2: 認証 API ルート (finance-unlock / verify-finance-token)

**Files:**
- Create: `app/api/admin/finance-unlock/route.ts`
- Create: `app/api/admin/verify-finance-token/route.ts`

### 環境変数の準備

`.env.local` に以下を追記（実際の値は管理者が設定）：
```
FINANCE_UNLOCK_PASS=your_finance_password_here
FINANCE_HMAC_SECRET=your_random_secret_here
```

- [ ] **Step 1: `app/api/admin/finance-unlock/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { password } = body;

    const PASS   = process.env.FINANCE_UNLOCK_PASS;
    const SECRET = process.env.FINANCE_HMAC_SECRET;

    if (!PASS || !SECRET) {
      return NextResponse.json(
        { ok: false, error: "not_configured" },
        { status: 500 }
      );
    }

    if (!password || password !== PASS) {
      return NextResponse.json(
        { ok: false, error: "invalid_password" },
        { status: 401 }
      );
    }

    const timestamp = Date.now().toString();
    const hmac      = createHmac("sha256", SECRET).update(timestamp).digest("hex");
    const token     = `${timestamp}.${hmac}`;

    return NextResponse.json({ ok: true, token });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: `app/api/admin/verify-finance-token/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { token } = body;

    const SECRET = process.env.FINANCE_HMAC_SECRET;
    if (!SECRET) {
      return NextResponse.json(
        { ok: false, error: "not_configured" },
        { status: 500 }
      );
    }
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, valid: false });
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
      return NextResponse.json({ ok: false, valid: false });
    }

    const [timestamp, hmac] = parts;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return NextResponse.json({ ok: false, valid: false });
    }
    if (Date.now() - ts > TOKEN_TTL_MS) {
      return NextResponse.json({ ok: false, valid: false, reason: "expired" });
    }

    const expected = createHmac("sha256", SECRET).update(timestamp).digest("hex");
    let valid = false;
    try {
      valid = timingSafeEqual(
        Buffer.from(hmac.padEnd(64, "0"), "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      valid = false;
    }

    return NextResponse.json({ ok: valid, valid });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: dev サーバーで動作確認**

dev サーバーが起動済みの前提。ターミナルで：

```bash
# 間違ったパスワード → 401
curl -s -X POST http://localhost:3000/api/admin/finance-unlock \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}' \
  -u "$ADMIN_USER:$ADMIN_PASS"
# Expected: {"ok":false,"error":"invalid_password"}

# 正しいパスワード → token が返る
curl -s -X POST http://localhost:3000/api/admin/finance-unlock \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$(grep FINANCE_UNLOCK_PASS .env.local | cut -d= -f2)\"}" \
  -u "$ADMIN_USER:$ADMIN_PASS"
# Expected: {"ok":true,"token":"<timestamp>.<hmac>"}
```

得られた token で verify も確認：

```bash
TOKEN="<上記で得たtoken>"
curl -s -X POST http://localhost:3000/api/admin/verify-finance-token \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" \
  -u "$ADMIN_USER:$ADMIN_PASS"
# Expected: {"ok":true,"valid":true}
```

- [ ] **Step 4: コミット**

```bash
git add app/api/admin/finance-unlock/route.ts app/api/admin/verify-finance-token/route.ts
git commit -m "feat(api): add finance-unlock and verify-finance-token routes"
```

---

## Task 3: プロキシ API ルート (wallet-ledger / ref-reassign)

**Files:**
- Create: `app/api/admin/wallet-ledger/route.ts`
- Create: `app/api/admin/ref-reassign/route.ts`

- [ ] **Step 1: `app/api/admin/wallet-ledger/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env" },
        { status: 500 }
      );
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "wallet_ledger_all", adminKey }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: `app/api/admin/ref-reassign/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { targetLoginId, newReferrerLoginId, note } = body;

    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env" },
        { status: 500 }
      );
    }
    if (!targetLoginId) {
      return NextResponse.json(
        { ok: false, error: "missing_targetLoginId" },
        { status: 400 }
      );
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "ref_reassign",
        adminKey,
        targetLoginId,
        newReferrerLoginId: newReferrerLoginId ?? "",
        note: note ?? "admin_finance_drag",
      }),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: TypeScript エラー確認**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: エラーなし（または既存エラーのみ）

- [ ] **Step 4: コミット**

```bash
git add app/api/admin/wallet-ledger/route.ts app/api/admin/ref-reassign/route.ts
git commit -m "feat(api): add wallet-ledger and ref-reassign proxy routes"
```

---

## Task 4: Admin ページ — ゲートウェイセクション追加

**Files:**
- Modify: `app/admin/page.tsx`

admin ページ最下部の footer の直前に財務管理ゲートウェイセクションを追加する。

- [ ] **Step 1: state を追加**

`app/admin/page.tsx` の `// --- Rumble管理 ---` のコメントブロックの直前（state 宣言エリアの末尾付近）に以下を追加：

以下の文字列を検索：
```
  // --- Rumble管理 ---
  const [forceEntryUserId, setForceEntryUserId] = useState("");
```

置換後：
```
  // --- Finance ゲートウェイ ---
  const [financePass, setFinancePass]   = useState("");
  const [financeBusy, setFinanceBusy]   = useState(false);
  const [financeErr,  setFinanceErr]    = useState<string | null>(null);

  // --- Rumble管理 ---
  const [forceEntryUserId, setForceEntryUserId] = useState("");
```

- [ ] **Step 2: ハンドラを追加**

`handleRewardDistribute` 関数の直後（`// ── ページネーション ──` の前）に追加：

以下の文字列を検索：
```
  // ── ページネーション ──────────────────────────────────────
  const totalPages = Math.ceil(membersTotal / PAGE_SIZE);
```

置換後：
```
  // ── Finance ゲートウェイ ─────────────────────────────────
  const handleFinanceUnlock = async () => {
    if (!financePass.trim() || financeBusy) return;
    setFinanceBusy(true); setFinanceErr(null);
    try {
      const res  = await fetch("/api/admin/finance-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: financePass }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "unlock_failed");
      sessionStorage.setItem("finance_token", json.token);
      window.location.href = "/admin/finance";
    } catch (e: any) {
      setFinanceErr(String(e?.message ?? e));
    } finally {
      setFinanceBusy(false);
    }
  };

  // ── ページネーション ──────────────────────────────────────
  const totalPages = Math.ceil(membersTotal / PAGE_SIZE);
```

- [ ] **Step 3: JSX ゲートウェイセクションを追加**

footer の直前に追加する。以下の文字列を検索：
```
        <footer className="mt-8 text-center text-xs text-zinc-600">© LIFAI</footer>
```

置換後：
```
        {/* ═══ 財務管理ゲートウェイ ════════════════════════ */}
        <section className="mt-10 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <p className="mb-1 text-lg font-semibold text-zinc-200">🔒 財務管理</p>
          <p className="mb-4 text-xs text-zinc-500">
            パスワードを入力して財務管理ページへ進んでください。ブラウザを閉じると再認証が必要です。
          </p>
          {financeErr && (
            <div className="mb-3 rounded-lg bg-red-900/50 px-4 py-2 text-sm font-bold text-red-300">
              {financeErr === "invalid_password" ? "パスワードが違います" : financeErr}
            </div>
          )}
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="財務パスワード"
              value={financePass}
              onChange={e => setFinancePass(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleFinanceUnlock(); }}
              className="w-56 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleFinanceUnlock}
              disabled={financeBusy || !financePass.trim()}
              className={clsx(
                "rounded-lg px-5 py-2 text-sm font-bold transition",
                financeBusy || !financePass.trim()
                  ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                  : "bg-amber-500 text-black hover:bg-amber-600"
              )}
            >
              {financeBusy ? "確認中…" : "財務管理へ →"}
            </button>
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-zinc-600">© LIFAI</footer>
```

- [ ] **Step 4: ブラウザで動作確認**

1. `http://localhost:3000/admin` を開く（Basic Auth）
2. ページ最下部に「🔒 財務管理」セクションが表示されている
3. 間違ったパスワードを入力 → エラーメッセージ表示
4. 正しいパスワードを入力 → `/admin/finance` へ遷移（404 になるのは正常、次タスクで実装）

- [ ] **Step 5: コミット**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add finance gateway section to admin page"
```

---

## Task 5: Finance ページシェル (`app/admin/finance/page.tsx`)

**Files:**
- Create: `app/admin/finance/page.tsx`

トークン検証 → タブ切り替え UI。タブコンポーネントは次タスクで作成するので、このタスクではプレースホルダーを使う。

- [ ] **Step 1: `app/admin/finance/page.tsx` を作成**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UsersTab from "./UsersTab";
import AffiliateTab from "./AffiliateTab";
import TreeTab from "./TreeTab";

type Tab = "users" | "affiliate" | "tree";

export default function FinancePage() {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("users");

  useEffect(() => {
    const token = sessionStorage.getItem("finance_token");
    if (!token) { router.replace("/admin"); return; }

    fetch("/api/admin/verify-finance-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(json => {
        if (json?.valid) { setVerified(true); }
        else { router.replace("/admin"); }
      })
      .catch(() => router.replace("/admin"));
  }, [router]);

  if (!verified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-400">認証確認中…</p>
      </main>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "users",     label: "ユーザー詳細" },
    { key: "affiliate", label: "アフィリエイト" },
    { key: "tree",      label: "紹介ツリー" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        {/* ヘッダー */}
        <header className="mb-6 flex items-center gap-4">
          <a
            href="/admin"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            ← admin に戻る
          </a>
          <h1 className="text-xl font-bold text-white">財務管理</h1>
        </header>

        {/* タブナビ */}
        <div className="mb-6 flex gap-1 rounded-xl bg-zinc-900 p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={[
                "rounded-lg px-5 py-2 text-sm font-semibold transition",
                activeTab === t.key
                  ? "bg-amber-500 text-black"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        {activeTab === "users"     && <UsersTab />}
        {activeTab === "affiliate" && <AffiliateTab />}
        {activeTab === "tree"      && <TreeTab />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: プレースホルダーコンポーネントを仮作成（ビルドエラー回避）**

次タスクで置き換えるので、ファイルが存在しない場合のみ作成：

`app/admin/finance/UsersTab.tsx`:
```typescript
export default function UsersTab() {
  return <div className="text-zinc-400">ユーザー詳細（実装予定）</div>;
}
```

`app/admin/finance/AffiliateTab.tsx`:
```typescript
export default function AffiliateTab() {
  return <div className="text-zinc-400">アフィリエイト（実装予定）</div>;
}
```

`app/admin/finance/TreeTab.tsx`:
```typescript
export default function TreeTab() {
  return <div className="text-zinc-400">紹介ツリー（実装予定）</div>;
}
```

- [ ] **Step 3: ブラウザで動作確認**

1. `/admin` の財務管理ゲートウェイで正しいパスワードを入力
2. `/admin/finance` に遷移し「認証確認中…」がすぐに「ユーザー詳細（実装予定）」に変わる
3. タブを切り替えて表示が変わることを確認
4. 直接 `/admin/finance` を URL 入力（token なし）→ `/admin` にリダイレクトされる

- [ ] **Step 4: コミット**

```bash
git add app/admin/finance/
git commit -m "feat(finance): add finance page shell with tab navigation and token guard"
```

---

## Task 6: UsersTab — ユーザー詳細タブ

**Files:**
- Modify: `app/admin/finance/UsersTab.tsx` (Task 5 のプレースホルダーを置き換え)

- [ ] **Step 1: `UsersTab.tsx` を完全実装**

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";

type AdminUser = {
  login_id: string;
  email?: string;
  name?: string;
  plan?: string;
  status?: string;
  created_at?: string;
  bp_balance?: number;
  ep_balance?: number;
  expected_paid?: number;
  actually_paid?: number;
  payment_status?: string;
  invoice_id?: string;
  order_id?: string;
  bp_granted_at?: string;
  bp_grant_plan?: string;
  referrer_login_id?: string;
  referrer_2_login_id?: string;
  referrer_3_login_id?: string;
  referrer_4_login_id?: string;
  referrer_5_login_id?: string;
  ref_path?: string;
  affiliate_granted_at?: string;
  rowIndex?: number;
  [k: string]: any;
};

type LedgerItem = {
  ts: string;
  kind: string;
  login_id: string;
  email: string;
  amount: number;
  memo: string;
};

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 py-2">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-right text-xs text-zinc-200 break-all">{value ?? "—"}</span>
    </div>
  );
}

export default function UsersTab() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [ledger,  setLedger]  = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [query,   setQuery]   = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/list", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/admin/wallet-ledger", { cache: "no-store" }).then(r => r.json()),
    ])
      .then(([listJson, ledgerJson]) => {
        if (!listJson?.ok) throw new Error(listJson?.error ?? "list_failed");
        const arr = Array.isArray(listJson.items) ? listJson.items
          : Array.isArray(listJson.rows) ? listJson.rows : [];
        setUsers(arr);
        setLedger(Array.isArray(ledgerJson?.items) ? ledgerJson.items : []);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.trim().toLowerCase();
    return users.filter(u =>
      (u.login_id ?? "").toLowerCase().includes(q) ||
      (u.email    ?? "").toLowerCase().includes(q) ||
      (u.name     ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  const userLedger = useMemo(() => {
    if (!selected) return [];
    return ledger
      .filter(l => l.login_id === selected.login_id)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [ledger, selected]);

  return (
    <div className="flex gap-4">
      {/* 左ペイン: ユーザー一覧 */}
      <div className={clsx("flex flex-col", selected ? "w-1/2" : "w-full")}>
        <div className="mb-3">
          <input
            type="text"
            placeholder="login_id / メール / 名前で検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {err && (
          <div className="mb-3 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>
        )}

        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">login_id</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">名前</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">プラン</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">ステータス</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">EP</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">BP</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">紹介報酬</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr
                    key={u.login_id}
                    onClick={() => setSelected(u === selected ? null : u)}
                    className={clsx(
                      "cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/50",
                      selected?.login_id === u.login_id && "bg-zinc-800"
                    )}
                  >
                    <td className="px-3 py-2 text-xs font-mono text-zinc-300">{u.login_id}</td>
                    <td className="px-3 py-2 text-xs text-zinc-200">{u.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">{u.plan ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        u.status === "approved"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-amber-900/60 text-amber-300"
                      )}>
                        {u.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-200">{(u.ep_balance ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-200">{(u.bp_balance ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{u.affiliate_granted_at ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-600">{filtered.length} / {users.length} 件</p>
      </div>

      {/* 右ペイン: ドロワー */}
      {selected && (
        <div className="w-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-4 overflow-y-auto max-h-[80vh]">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-white font-mono">{selected.login_id}</p>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ✕ 閉じる
            </button>
          </div>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">基本情報</p>
            <Row label="メール"       value={selected.email} />
            <Row label="名前"         value={selected.name} />
            <Row label="プラン"       value={selected.plan} />
            <Row label="ステータス"   value={selected.status} />
            <Row label="登録日時"     value={fmt(selected.created_at)} />
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">決済状況</p>
            <Row label="想定金額"     value={selected.expected_paid != null ? `${selected.expected_paid} USDT` : undefined} />
            <Row label="実際の入金"   value={selected.actually_paid  != null ? `${selected.actually_paid} USDT` : undefined} />
            <Row label="支払ステータス" value={selected.payment_status} />
            <Row label="invoice_id"  value={selected.invoice_id} />
            <Row label="order_id"    value={selected.order_id} />
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">BP / EP</p>
            <Row label="EP残高"       value={`${(selected.ep_balance ?? 0).toLocaleString()} EP`} />
            <Row label="BP残高"       value={`${(selected.bp_balance ?? 0).toLocaleString()} BP`} />
            <Row label="BP付与日"     value={fmt(selected.bp_granted_at)} />
            <Row label="BP付与プラン" value={selected.bp_grant_plan} />
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">紹介情報</p>
            <Row label="紹介者 L1"    value={selected.referrer_login_id} />
            <Row label="紹介者 L2"    value={selected.referrer_2_login_id} />
            <Row label="紹介者 L3"    value={selected.referrer_3_login_id} />
            <Row label="紹介者 L4"    value={selected.referrer_4_login_id} />
            <Row label="紹介者 L5"    value={selected.referrer_5_login_id} />
            <Row label="ref_path"    value={selected.ref_path} />
            <Row label="紹介報酬付与" value={fmt(selected.affiliate_granted_at)} />
          </section>

          <section>
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">
              Wallet 動き（{userLedger.length} 件）
            </p>
            {userLedger.length === 0 ? (
              <p className="text-xs text-zinc-600">履歴なし</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-left">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400">日時</th>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400">kind</th>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400 text-right">amount</th>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400">memo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userLedger.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="px-2 py-1.5 text-[10px] text-zinc-400 whitespace-nowrap">{fmt(l.ts)}</td>
                        <td className="px-2 py-1.5 text-[10px] text-zinc-300">{l.kind}</td>
                        <td className={clsx(
                          "px-2 py-1.5 text-[10px] font-bold text-right",
                          l.amount >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {l.amount >= 0 ? "+" : ""}{l.amount.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] text-zinc-500 max-w-[120px] truncate">{l.memo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ブラウザで確認**

1. `/admin/finance` を開き「ユーザー詳細」タブを選択
2. ユーザー一覧が表示される
3. 検索バーで login_id / メール / 名前を入力 → リアルタイムフィルタ
4. 行をクリック → 右ドロワーが展開され詳細・Wallet 履歴が表示

- [ ] **Step 3: コミット**

```bash
git add app/admin/finance/UsersTab.tsx
git commit -m "feat(finance): implement UsersTab with search and wallet drawer"
```

---

## Task 7: AffiliateTab — アフィリエイト履歴タブ

**Files:**
- Modify: `app/admin/finance/AffiliateTab.tsx` (プレースホルダーを置き換え)

- [ ] **Step 1: `AffiliateTab.tsx` を完全実装**

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";

type LedgerItem = {
  ts: string;
  kind: string;
  login_id: string;
  email: string;
  amount: number;
  memo: string;
};

type AffiliateMeta = {
  from?: string;
  level?: number;
  amount_usd?: number;
  rate_pct?: number;
  reward_jpy?: number;
};

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function parseMeta(memo: string): AffiliateMeta {
  try { return JSON.parse(memo) as AffiliateMeta; } catch { return {}; }
}

export default function AffiliateTab() {
  const [ledger,  setLedger]  = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [filterId, setFilterId]    = useState("");
  const [filterLvl, setFilterLvl]  = useState("");

  useEffect(() => {
    fetch("/api/admin/wallet-ledger", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        setLedger(Array.isArray(json.items) ? json.items : []);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const affiliateRows = useMemo(
    () => ledger.filter(l => l.kind === "affiliate_reward")
         .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    [ledger]
  );

  const filtered = useMemo(() => {
    let rows = affiliateRows;
    if (filterId.trim()) {
      const q = filterId.trim().toLowerCase();
      rows = rows.filter(r => r.login_id.toLowerCase().includes(q));
    }
    if (filterLvl) {
      const lvl = Number(filterLvl);
      rows = rows.filter(r => parseMeta(r.memo).level === lvl);
    }
    return rows;
  }, [affiliateRows, filterId, filterLvl]);

  const totalEp    = useMemo(() => affiliateRows.reduce((s, r) => s + r.amount, 0), [affiliateRows]);
  const uniqueIds  = useMemo(() => new Set(affiliateRows.map(r => r.login_id)).size, [affiliateRows]);
  const lastDate   = useMemo(() => affiliateRows[0]?.ts ?? "", [affiliateRows]);

  return (
    <div>
      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      {/* サマリーカード */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "総付与 EP",       value: `${totalEp.toLocaleString()} EP` },
          { label: "対象ユーザー数",  value: `${uniqueIds} 人` },
          { label: "最終付与日",      value: fmt(lastDate) },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-1 text-xs text-zinc-400">{c.label}</p>
            <p className="text-lg font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* フィルタ */}
      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="受取人 login_id で絞り込み"
          value={filterId}
          onChange={e => setFilterId(e.target.value)}
          className="w-56 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <select
          value={filterLvl}
          onChange={e => setFilterLvl(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">全レベル</option>
          {[1,2,3,4,5].map(l => (
            <option key={l} value={l}>L{l}</option>
          ))}
        </select>
        <span className="flex items-center text-xs text-zinc-500">{filtered.length} 件</span>
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">対象なし</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400">日時</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400">受取人</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400">送出元</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-center">Lv</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">USD額</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">EP付与</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">料率</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const meta = parseMeta(l.memo);
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                    <td className="px-3 py-2 text-xs text-zinc-400 whitespace-nowrap">{fmt(l.ts)}</td>
                    <td className="px-3 py-2 text-xs font-mono text-zinc-200">{l.login_id}</td>
                    <td className="px-3 py-2 text-xs font-mono text-zinc-400">{meta.from ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      {meta.level != null ? (
                        <span className="rounded-full bg-indigo-900/60 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          L{meta.level}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-300">
                      {meta.amount_usd != null ? `$${meta.amount_usd}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold text-right text-emerald-400">
                      +{l.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-400">
                      {meta.rate_pct != null ? `${meta.rate_pct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ブラウザで確認**

1. 「アフィリエイト」タブを選択
2. サマリーカード 3 枚が表示される（affiliate_reward が 0 件の場合はすべて 0）
3. login_id フィルタ・レベルフィルタが機能する

- [ ] **Step 3: コミット**

```bash
git add app/admin/finance/AffiliateTab.tsx
git commit -m "feat(finance): implement AffiliateTab with summary cards and level filter"
```

---

## Task 8: TreeTab — 紹介ツリータブ（SVG + D&D）

**Files:**
- Modify: `app/admin/finance/TreeTab.tsx` (プレースホルダーを置き換え)

SVGツリーのレイアウトは BFS ベースの簡易実装。ノード幅 180px・高さ 72px、レベル間距離 130px、兄弟間距離 30px。ドラッグ中はドロップ候補ノードをハイライト。

- [ ] **Step 1: `TreeTab.tsx` を完全実装**

```typescript
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UserNode = {
  login_id: string;
  name?: string;
  plan?: string;
  ep_balance?: number;
  referrer_login_id?: string;
  status?: string;
  [k: string]: any;
};

type LayoutNode = UserNode & {
  x: number;
  y: number;
  children: string[];
};

const NODE_W  = 180;
const NODE_H  = 72;
const LEVEL_H = 130;
const SIBLING_GAP = 30;

function buildTree(users: UserNode[], rootId: string | null): Map<string, LayoutNode> {
  const map = new Map<string, UserNode>();
  users.forEach(u => map.set(u.login_id, u));

  const childrenMap = new Map<string, string[]>();
  users.forEach(u => {
    const pid = u.referrer_login_id ?? "";
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(u.login_id);
  });

  // BFS from root(s)
  const roots = rootId
    ? [rootId]
    : users.filter(u => !u.referrer_login_id).map(u => u.login_id).slice(0, 50);

  const layoutMap = new Map<string, LayoutNode>();
  const levels: string[][] = [];
  const queue = roots.map(id => ({ id, level: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0 && layoutMap.size < 50) {
    const { id, level } = queue.shift()!;
    if (visited.has(id) || !map.has(id)) continue;
    visited.add(id);

    if (!levels[level]) levels[level] = [];
    levels[level].push(id);

    const children = (childrenMap.get(id) ?? []).filter(c => !visited.has(c));
    layoutMap.set(id, { ...map.get(id)!, x: 0, y: level * LEVEL_H, children });
    children.forEach(c => queue.push({ id: c, level: level + 1 }));
  }

  // Assign X positions level by level
  levels.forEach((ids) => {
    const totalW = ids.length * NODE_W + (ids.length - 1) * SIBLING_GAP;
    const startX = -totalW / 2;
    ids.forEach((id, i) => {
      const node = layoutMap.get(id);
      if (node) node.x = startX + i * (NODE_W + SIBLING_GAP);
    });
  });

  return layoutMap;
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cy = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
}

export default function TreeTab() {
  const [users,    setUsers]    = useState<UserNode[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState<string | null>(null);
  const [rootSearch, setRootSearch] = useState("");
  const [rootId,   setRootId]   = useState<string | null>(null);
  const [dragId,   setDragId]   = useState<string | null>(null);
  const [overId,   setOverId]   = useState<string | null>(null);
  const [modal,    setModal]    = useState<{ target: string; newParent: string } | null>(null);
  const [busy,     setBusy]     = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    fetch("/api/admin/list", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        const arr: UserNode[] = Array.isArray(json.items) ? json.items
          : Array.isArray(json.rows) ? json.rows : [];
        setUsers(arr);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const layoutMap = useMemo(() => buildTree(users, rootId), [users, rootId]);

  // SVG viewport calc
  const allNodes = Array.from(layoutMap.values());
  const xs = allNodes.map(n => n.x);
  const ys = allNodes.map(n => n.y);
  const minX = Math.min(...xs, 0) - 20;
  const maxX = Math.max(...xs, 0) + NODE_W + 20;
  const minY = Math.min(...ys, 0) - 20;
  const maxY = Math.max(...ys, 0) + NODE_H + 20;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnd   = () => { setDragId(null); setOverId(null); };
  const handleDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setOverId(id); };
  const handleDrop      = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setModal({ target: dragId, newParent: targetId });
    setDragId(null); setOverId(null);
  };

  const handleConfirm = async () => {
    if (!modal) return;
    setBusy(true); setFeedback(null);
    try {
      const res  = await fetch("/api/admin/ref-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLoginId: modal.target, newReferrerLoginId: modal.newParent }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "reassign_failed");
      setFeedback(`✅ ${modal.target} の紹介者を ${modal.newParent} に変更しました`);
      setModal(null);
      load();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setFeedback(`❌ ${
        msg === "circular_reference" ? "循環参照になるため変更できません"
        : msg === "target_not_found" ? "対象ユーザーが見つかりません"
        : msg === "self_referral"    ? "自分自身には紹介できません"
        : msg
      }`);
      setModal(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* ツールバー */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ルートユーザーの login_id を入力"
          value={rootSearch}
          onChange={e => setRootSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { setRootId(rootSearch.trim() || null); } }}
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={() => setRootId(rootSearch.trim() || null)}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-600"
        >
          表示
        </button>
        {rootId && (
          <button
            onClick={() => { setRootId(null); setRootSearch(""); }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            全体表示
          </button>
        )}
        <span className="text-xs text-zinc-500">{layoutMap.size} ノード（最大 50）</span>
        <span className="text-xs text-zinc-500">ノードをドラッグして別のノードへドロップすると紹介者を変更できます</span>
      </div>

      {feedback && (
        <div className={[
          "mb-4 rounded-lg px-4 py-2 text-sm font-bold",
          feedback.startsWith("✅") ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"
        ].join(" ")}>
          {feedback}
        </div>
      )}

      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-zinc-800" />
      ) : layoutMap.size === 0 ? (
        <p className="text-sm text-zinc-500">ユーザーが見つかりません</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <svg
            width={svgW}
            height={svgH}
            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            style={{ display: "block" }}
          >
            {/* エッジ */}
            {allNodes.map(node =>
              node.children.map(childId => {
                const child = layoutMap.get(childId);
                if (!child) return null;
                return (
                  <path
                    key={`${node.login_id}-${childId}`}
                    d={cubicBezier(
                      node.x + NODE_W / 2, node.y + NODE_H,
                      child.x + NODE_W / 2, child.y
                    )}
                    fill="none"
                    stroke="#52525b"
                    strokeWidth={1.5}
                  />
                );
              })
            )}

            {/* ノード */}
            {allNodes.map(node => {
              const isOver  = overId === node.login_id && dragId !== node.login_id;
              const isDragging = dragId === node.login_id;
              return (
                <foreignObject
                  key={node.login_id}
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                >
                  <div
                    draggable
                    onDragStart={() => handleDragStart(node.login_id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleDragOver(e, node.login_id)}
                    onDrop={e => handleDrop(e, node.login_id)}
                    style={{
                      width: NODE_W,
                      height: NODE_H,
                      boxSizing: "border-box",
                      padding: "8px",
                      borderRadius: "10px",
                      border: isOver ? "2px solid #f59e0b"
                             : isDragging ? "2px dashed #6b7280"
                             : "1px solid #3f3f46",
                      background: isOver ? "#292524"
                                : isDragging ? "#1c1c1e"
                                : "#18181b",
                      cursor: "grab",
                      userSelect: "none",
                      opacity: isDragging ? 0.5 : 1,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: "bold", color: "#e4e4e7", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {node.login_id}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {node.name ?? ""} / {node.plan ?? "—"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#34d399" }}>
                      EP: {(node.ep_balance ?? 0).toLocaleString()}
                    </p>
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>
      )}

      {/* 確認モーダル */}
      {modal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: "#18181b", border: "1px solid #3f3f46",
              borderRadius: 12, padding: 24, maxWidth: 400, width: "90%",
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ color: "#fff", fontWeight: "bold", marginBottom: 8 }}>紹介者を変更しますか？</p>
            <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 4 }}>
              <span style={{ color: "#f59e0b", fontFamily: "monospace" }}>{modal.target}</span> の紹介者を
            </p>
            <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 20 }}>
              <span style={{ color: "#34d399", fontFamily: "monospace" }}>{modal.newParent}</span> に変更します。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setModal(null)}
                disabled={busy}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid #52525b",
                  background: "transparent", color: "#a1a1aa", cursor: "pointer", fontSize: 14,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#f59e0b", color: "#000", fontWeight: "bold",
                  cursor: busy ? "not-allowed" : "pointer", fontSize: 14,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "変更中…" : "変更する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ブラウザで確認**

1. 「紹介ツリー」タブを選択
2. SVGツリーが表示される（ノードがなければ紹介者のいないユーザーがルートになる）
3. login_id を入力して「表示」→ そのユーザーがルートのツリーを表示
4. ノードをドラッグして別のノードにドロップ → 確認モーダルが表示
5. 「変更する」→ 成功メッセージ・ツリー再描画
6. 循環参照になる場合 → エラーメッセージ表示

- [ ] **Step 3: コミット**

```bash
git add app/admin/finance/TreeTab.tsx
git commit -m "feat(finance): implement TreeTab with SVG layout and drag-and-drop reassignment"
```

---

## 最終確認チェックリスト

- [ ] `/admin` 最下部にゲートウェイが表示される
- [ ] 間違ったパスワード → エラーメッセージ（リダイレクトなし）
- [ ] 正しいパスワード → `/admin/finance` に遷移
- [ ] 直接 `/admin/finance` アクセス（token なし）→ `/admin` へリダイレクト
- [ ] ブラウザを閉じて再度 `/admin/finance` → リダイレクト（sessionStorage リセット）
- [ ] ユーザー詳細タブ: 一覧・検索・ドロワー・Wallet 履歴
- [ ] アフィリエイトタブ: サマリーカード・テーブル・フィルタ
- [ ] 紹介ツリータブ: SVG 表示・D&D で紹介者変更・循環参照エラー
- [ ] `npx tsc --noEmit` エラーなし

---

## 環境変数メモ

`.env.local` に追記が必要：
```
FINANCE_UNLOCK_PASS=（管理者が設定するパスワード）
FINANCE_HMAC_SECRET=（openssl rand -hex 32 などで生成するランダム文字列）
```
