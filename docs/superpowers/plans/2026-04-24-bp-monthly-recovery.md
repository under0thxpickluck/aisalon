# BP月次回復 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TOPページ表示時にGASへ問い合わせ、30日に1回 bp_balance を最大 cap×50% 回復させる。

**Architecture:** GASに `monthly_bp_recover` actionを追加（`daily_login_bonus` と同パターン）。Next.jsに `/api/wallet/recover` proxyルートを新規作成。TOPページのuseEffectから呼び出す。通常ユーザーは `applies` シート、/5000ユーザーは `applies_5000` シートを `group` パラメータで振り分ける。

**Tech Stack:** Google Apps Script (GAS), Next.js 14 App Router, TypeScript

---

## ファイル構成

| 操作 | ファイル | 変更内容 |
|---|---|---|
| Modify | `gas/Code.gs` | `get_balance` に `bp_cap` 追加、`monthly_bp_recover` action追加 |
| Create | `app/api/wallet/recover/route.ts` | GAS proxyルート（POSTのみ） |
| Modify | `app/top/page.tsx` | useEffectに recover 呼び出し追加 |
| Modify | `app/membership/page.tsx` | PLAN_BP_CAP のキーをGAS実値に修正 |

---

## Task 1: GAS — `get_balance` に `bp_cap` を追加

**Files:**
- Modify: `gas/Code.gs` (line 1490–1502)

- [ ] **Step 1: `get_balance` の return 直前に bp_cap 計算を追加**

`gas/Code.gs` の以下の箇所を編集する（line 1490 付近）：

変更前：
```javascript
    const bpRaw   = hit.r[idx["bp_balance"]];
    const epRaw   = hit.r[idx["ep_balance"]];
    const planRaw = hit.r[idx["plan"]];

    const bp = Number(bpRaw || 0);
    const ep = Number(epRaw || 0);

    return json_({
      ok:   true,
      bp:   Number.isFinite(bp) ? bp : 0,
      ep:   Number.isFinite(ep) ? ep : 0,
      plan: str_(planRaw),
    });
  }
```

変更後：
```javascript
    const bpRaw   = hit.r[idx["bp_balance"]];
    const epRaw   = hit.r[idx["ep_balance"]];
    const planRaw = hit.r[idx["plan"]];

    const bp = Number(bpRaw || 0);
    const ep = Number(epRaw || 0);

    const BP_CAP_MAP_BAL      = { "34":300, "57":600, "114":1200, "567":6000, "1134":12000 };
    const BP_CAP_MAP_BAL_5000 = { "500":1000, "2000":4000, "3000":8000, "5000":10000 };
    const capMap_bal = group_bal === "5000" ? BP_CAP_MAP_BAL_5000 : BP_CAP_MAP_BAL;
    const bpCap_bal  = capMap_bal[str_(planRaw)] ?? 0;

    return json_({
      ok:     true,
      bp:     Number.isFinite(bp) ? bp : 0,
      ep:     Number.isFinite(ep) ? ep : 0,
      plan:   str_(planRaw),
      bp_cap: bpCap_bal,
    });
  }
```

- [ ] **Step 2: 動作確認（手動）**

GAS エディタから `doPost` をテスト実行、または Next.js dev サーバー起動後に `/api/wallet/balance` を叩いて `bp_cap` フィールドが含まれることを確認。

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): get_balance レスポンスに bp_cap フィールドを追加"
```

---

## Task 2: GAS — `monthly_bp_recover` action を追加

**Files:**
- Modify: `gas/Code.gs` (line 1740 の直後、`get_missions` ブロックの前に挿入)

- [ ] **Step 1: `monthly_bp_recover` action を挿入**

`gas/Code.gs` の line 1740 (`return json_({ ok: true, bp_earned: bpEarned, streak: streak, bp_balance: newBp }); }`) の直後、line 1742 (`// get_missions`) の直前に以下を追加する：

```javascript
  // =========================================================
  // monthly_bp_recover（月次BP回復：30日に1回）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - group:"5000" で applies_5000 シートに振り分け
  // - bp_last_reset_at で30日経過チェック（空 = 初回 = 即回復）
  // - 回復量 = min(cap×50%, max(0, cap - currentBp))
  // - cap超えの場合は回復量0だがbp_last_reset_atは更新する
  // =========================================================
  if (action === "monthly_bp_recover") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId_rec = str_(body.loginId);
    const group_rec   = str_(body.group);
    if (!loginId_rec) return json_({ ok: false, error: "loginId_required" });

    const targetSheet_rec = group_rec === "5000" ? getAppliesSheet5000_() : sheet;

    let values_rec = targetSheet_rec.getDataRange().getValues();
    let header_rec = values_rec[0];

    ensureCols_(targetSheet_rec, header_rec, [
      "login_id", "bp_balance", "bp_last_reset_at", "plan",
    ]);

    values_rec = targetSheet_rec.getDataRange().getValues();
    header_rec = values_rec[0];

    const idx_rec  = indexMap_(header_rec);
    const rows_rec = values_rec.slice(1);

    let hitRowIndex_rec = 0;
    let hitEmail_rec    = "";

    for (let i = 0; i < rows_rec.length; i++) {
      if (str_(rows_rec[i][idx_rec["login_id"]]) === loginId_rec) {
        hitRowIndex_rec = i + 2;
        hitEmail_rec    = str_(rows_rec[i][idx_rec["email"]] || "");
        break;
      }
    }

    if (!hitRowIndex_rec) return json_({ ok: false, error: "not_found" });

    // 前回回復日チェック（30日 = 30 * 24 * 60 * 60 * 1000 ms）
    const lastResetRaw_rec = targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_last_reset_at"] + 1).getValue();
    if (lastResetRaw_rec) {
      const elapsed_rec = Date.now() - new Date(lastResetRaw_rec).getTime();
      if (elapsed_rec < 30 * 24 * 60 * 60 * 1000) {
        return json_({ ok: false, reason: "already_recovered" });
      }
    }

    // plan → bp_cap
    const plan_rec = str_(targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["plan"] + 1).getValue());
    const BP_CAP_MAP_REC      = { "34":300, "57":600, "114":1200, "567":6000, "1134":12000 };
    const BP_CAP_MAP_REC_5000 = { "500":1000, "2000":4000, "3000":8000, "5000":10000 };
    const capMap_rec = group_rec === "5000" ? BP_CAP_MAP_REC_5000 : BP_CAP_MAP_REC;
    const bpCap_rec  = capMap_rec[plan_rec] ?? 0;
    if (!bpCap_rec) return json_({ ok: false, reason: "unknown_plan" });

    // 回復量計算
    const currentBp_rec = Number(targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_balance"] + 1).getValue() || 0);
    const recover_rec   = Math.min(Math.floor(bpCap_rec * 0.5), Math.max(0, bpCap_rec - currentBp_rec));

    // bp_last_reset_at は回復量0でも更新（次の30日サイクルを開始）
    targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_last_reset_at"] + 1).setValue(new Date());

    if (recover_rec === 0) {
      return json_({ ok: true, bp_recovered: 0, bp_balance: currentBp_rec });
    }

    const newBp_rec = currentBp_rec + recover_rec;
    targetSheet_rec.getRange(hitRowIndex_rec, idx_rec["bp_balance"] + 1).setValue(newBp_rec);

    appendWalletLedger_({
      kind:     "monthly_recover",
      login_id: loginId_rec,
      email:    hitEmail_rec,
      amount:   recover_rec,
      memo:     "月次BP回復（cap=" + bpCap_rec + "）",
    });

    return json_({ ok: true, bp_recovered: recover_rec, bp_balance: newBp_rec });
  }
```

- [ ] **Step 2: 変数名衝突がないことを目視確認**

GASはグローバルスコープがないが、同一 `doPost` 関数内では変数名が衝突する。`loginId_rec` / `group_rec` / `targetSheet_rec` などサフィックス `_rec` を付けているので他のactionと衝突しないことを確認。

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): monthly_bp_recover action を追加（30日ごとにBP回復）"
```

---

## Task 3: Next.js — `/api/wallet/recover/route.ts` を新規作成

**Files:**
- Create: `app/api/wallet/recover/route.ts`

- [ ] **Step 1: ファイルを作成**

```typescript
// app/api/wallet/recover/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const loginId = String(body?.loginId ?? "");
  const group   = String(body?.group   ?? "");

  if (!loginId) {
    return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
  }

  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;

  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      cache:   "no-store",
      body:    JSON.stringify({
        action:   "monthly_bp_recover",
        adminKey: gasAdminKey,
        loginId,
        group,
      }),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし（出力なし）

- [ ] **Step 3: コミット**

```bash
git add app/api/wallet/recover/route.ts
git commit -m "feat: /api/wallet/recover ルートを新規追加（GAS monthly_bp_recover proxy）"
```

---

## Task 4: Next.js — `app/top/page.tsx` に recover 呼び出しを追加

**Files:**
- Modify: `app/top/page.tsx`

- [ ] **Step 1: daily_login_bonus の fetch ブロックの直後に recover 呼び出しを追加**

`app/top/page.tsx` の以下の箇所を探す（既存コード）：

```typescript
    // ログインボーナス
    const loginId = (a as any)?.loginId ?? (a as any)?.login_id ?? (a as any)?.id ?? "";
    if (loginId) {
      fetch("/api/daily-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.bp_earned > 0) {
            setLoginBonus({ bp_earned: data.bp_earned, streak: data.streak });
          }
        })
        .catch(() => {});
    }
  }, [router]);
```

このブロックの `fetch("/api/daily-login", ...)` の後（`.catch(() => {});` と `}` の間）に以下を追加する：

```typescript
    // ログインボーナス
    const loginId = (a as any)?.loginId ?? (a as any)?.login_id ?? (a as any)?.id ?? "";
    if (loginId) {
      fetch("/api/daily-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.bp_earned > 0) {
            setLoginBonus({ bp_earned: data.bp_earned, streak: data.streak });
          }
        })
        .catch(() => {});

      // 月次BP回復チェック（30日に1回、サイレント失敗）
      fetch("/api/wallet/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, group: (a as any)?.group || "" }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.bp_recovered > 0) {
            setBalanceTrigger((n) => n + 1);
          }
        })
        .catch(() => {});
    }
  }, [router]);
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし（出力なし）

- [ ] **Step 3: コミット**

```bash
git add app/top/page.tsx
git commit -m "feat(top): TOPページ表示時に月次BP回復チェックを呼び出す"
```

---

## Task 5: Next.js — `app/membership/page.tsx` の PLAN_BP_CAP を修正

**Files:**
- Modify: `app/membership/page.tsx` (line 14–21)

- [ ] **Step 1: PLAN_BP_CAP のキーと値をGAS実値に合わせて修正**

変更前：
```typescript
const PLAN_BP_CAP: Record<string, number> = {
  "30":   300,
  "50":   600,
  "100":  1500,
  "500":  8000,
  "1000": 20000,
};
```

変更後：
```typescript
// 通常プラン（GAS planToGrant_ の実値に合わせる）
const PLAN_BP_CAP: Record<string, number> = {
  "34":   300,
  "57":   600,
  "114":  1200,
  "567":  6000,
  "1134": 12000,
  // /5000プラン
  "500":  1000,
  "2000": 4000,
  "3000": 8000,
  "5000": 10000,
};
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし（出力なし）

- [ ] **Step 3: コミット**

```bash
git add app/membership/page.tsx
git commit -m "fix(membership): PLAN_BP_CAP をGAS実値に修正し/5000プランを追加"
```

---

## 動作確認手順

実装完了後、以下の順で確認する。

1. `npm run dev` でdev server起動
2. `/top` にログイン済みでアクセス
3. ブラウザDevTools > Network タブで `/api/wallet/recover` のリクエスト・レスポンスを確認
   - 初回: `{ ok: true, bp_recovered: N, bp_balance: M }` が返る（N > 0 の場合はWALLET残高が更新される）
   - 再アクセス: `{ ok: false, reason: "already_recovered" }` が返る（30日以内の二重回復防止）
4. GAS スプレッドシートの `applies` シートで `bp_last_reset_at` 列が更新されていることを確認
5. `wallet_ledger` シートに `monthly_recover` の行が追加されていることを確認
6. `/5000` ユーザーでログインして同様に確認（`applies_5000` シートが更新される）
