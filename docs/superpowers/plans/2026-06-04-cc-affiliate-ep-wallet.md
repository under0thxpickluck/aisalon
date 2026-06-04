# CC決済アフィリエイト報酬・EPウォレットログ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Square CC購入のアフィリエイト報酬を管理者確認後に手動付与できる仕組みを構築し、EPウォレットログ・ポップアップ通知を追加する

**Architecture:** GAS に計算・付与ロジックを追加 → Next.js API ルートで中継 → 管理画面に付与待ちタブ → ユーザーのtopページにEP通知ポップアップ

**Tech Stack:** Google Apps Script, Next.js 14 (App Router), TypeScript, React

---

## File Map

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | 変更 | Part1〜4・6全GAS変更 |
| `app/api/square/webhook/route.ts` | 変更 | amount_cents をGASに渡す |
| `app/api/admin/cc-affiliate-pending/route.ts` | 新規 | 付与待ちリスト取得 |
| `app/api/admin/cc-affiliate-grant/route.ts` | 新規 | 管理者付与実行 |
| `app/api/ep-notification-clear/route.ts` | 新規 | EP通知クリア |
| `app/api/me/route.ts` | 変更 | ep_notification フィールド追加 |
| `app/admin/finance/CcPendingTab.tsx` | 新規 | CC付与待ちタブUI |
| `app/admin/finance/page.tsx` | 変更 | CC付与待ちタブ追加 |
| `app/admin/finance/AffiliateTab.tsx` | 変更 | kind フィルタ更新 |
| `app/admin/finance/MonthlyTab.tsx` | 変更 | ヘッダー文言更新 |
| `app/top/page.tsx` | 変更 | EP獲得ポップアップ追加 |

---

## Task 1: GAS — EP grant ログ + 1段アフィリエイト集計

**Files:**
- Modify: `gas/Code.gs` (approveRowCore_ 付近 line ~4894、affiliate_monthly_summary line ~1778)

- [ ] **Step 1: ep_grant wallet_ledger 記録を追加**

`gas/Code.gs` の line 4894 (`epAdded = Number.isFinite(g.ep) ? g.ep : 0;`) の直後に追加：

```javascript
        bpGranted = true;
        bpAdded = Number.isFinite(g.bp) ? g.bp : 0;
        epAdded = Number.isFinite(g.ep) ? g.ep : 0;
        // ✅ EP付与をwallet_ledgerに記録
        if (epAdded > 0) {
          try {
            appendWalletLedger_({
              kind:     "ep_grant",
              login_id: loginId,
              email:    email,
              amount:   epAdded,
              memo:     "plan:" + plan,
            });
          } catch (eg) {}
        }
```

- [ ] **Step 2: affiliate_monthly_summary のループを L1のみ20%に変更**

`gas/Code.gs` の line ~1778 の `for (let lvl = 0; lvl < 5; lvl++)` ブロック全体を以下に置き換え：

```javascript
      // L1のみ 20% 固定
      var refL1 = str_(r[amIdx["referrer_login_id"]]);
      if (refL1) {
        var rewardEpL1 = Math.floor(amountJpy * 20 / 100 * epPerJpy);
        var entryL1 = ensureReferrer(refL1);
        entryL1.levels[0].initial_usd += amountUsd;
        entryL1.levels[0].initial_ep  += rewardEpL1;
        entryL1.levels[0].total_ep    += rewardEpL1;
        if (childLoginId && entryL1.levels[0].initial_sources.indexOf(childLoginId) === -1) {
          entryL1.levels[0].initial_sources.push(childLoginId);
        }
      }
```

- [ ] **Step 3: MonthlyTab のヘッダー文言を更新**

`app/admin/finance/MonthlyTab.tsx` line 173 の `（L1:10%〜L5:1%）` を `（L1:20%）` に変更。
line 159 の `CC決済（内部課金）列は Stripe 連携後に有効化されます。現在は表示のみ（—）。` を削除。

- [ ] **Step 4: TypeScript チェック**

```bash
cd C:/Users/unite/aisalon/aisalon && npx tsc --noEmit --skipLibCheck 2>&1
```
期待値: `error TS2688: Cannot find type definition file for 'jest'.` のみ（既存エラー）

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs app/admin/finance/MonthlyTab.tsx
git commit -m "feat(affiliate): EP grant logging + L1-only 20% affiliate structure"
```

---

## Task 2: GAS — Square CC affiliate キュー積み

**Files:**
- Modify: `gas/Code.gs` (square_grant_bp line ~2109)
- Modify: `app/api/square/webhook/route.ts` (amount_cents を追加)

- [ ] **Step 1: Square webhook から amount_cents を GAS に渡す**

`app/api/square/webhook/route.ts` line 157〜164 の body を変更：

```typescript
        body: JSON.stringify({
          action: "square_grant_bp",
          user_id: userId,
          bp_amount: bpAmount,
          square_payment_id: paymentId,
          pack_id: packId,
          amount_cents: amountCents ?? 0,
          note: `amount_cents:${amountCents} order_id:${orderId}`,
          isTest,
        }),
```

- [ ] **Step 2: square_grant_bp に CC affiliate キュー積みを追加**

`gas/Code.gs` の `appendWalletLedger_({kind:"square_bp_purchase",...})` の直後（line ~2117 の後）に追加：

```javascript
    // ✅ CC affiliate キューに積む（EP付与は管理者が手動実行）
    try {
      var amountCents_sq = Number(body.amount_cents || 0);
      if (amountCents_sq > 0) {
        var pendingSheet_sq = getOrCreateSheetByName_(
          SpreadsheetApp.getActiveSpreadsheet(),
          "cc_affiliate_pending",
          ["ts","square_payment_id","payer_login_id","referrer_login_id",
           "referrer_email","amount_usd","reward_ep","status","granted_at"]
        );
        // 冪等性チェック
        var pendingData_sq = pendingSheet_sq.getDataRange().getValues();
        var pendingIdx_sq  = indexMap_(pendingData_sq[0]);
        var alreadyQueued  = false;
        for (var pqi = 1; pqi < pendingData_sq.length; pqi++) {
          if (str_(pendingData_sq[pqi][pendingIdx_sq["square_payment_id"]]) === paymentId_sq) {
            alreadyQueued = true;
            break;
          }
        }
        if (!alreadyQueued) {
          // 購入者の referrer_login_id を取得
          var buyerRefLoginId = "";
          var buyerRefEmail   = "";
          var sqValues_ref    = targetSheet_sq.getDataRange().getValues();
          var sqHeader_ref    = sqValues_ref[0];
          ensureCols_(targetSheet_sq, sqHeader_ref, ["login_id","referrer_login_id","email"]);
          sqValues_ref  = targetSheet_sq.getDataRange().getValues();
          sqHeader_ref  = sqValues_ref[0];
          var sqIdx_ref = indexMap_(sqHeader_ref);
          for (var rfi = 1; rfi < sqValues_ref.length; rfi++) {
            if (str_(sqValues_ref[rfi][sqIdx_ref["login_id"]]) === userId_sq) {
              buyerRefLoginId = str_(sqValues_ref[rfi][sqIdx_ref["referrer_login_id"]]);
              break;
            }
          }
          if (buyerRefLoginId) {
            // referrer の email を取得
            for (var rfe = 1; rfe < sqValues_ref.length; rfe++) {
              if (str_(sqValues_ref[rfe][sqIdx_ref["login_id"]]) === buyerRefLoginId) {
                buyerRefEmail = str_(sqValues_ref[rfe][sqIdx_ref["email"]]);
                break;
              }
            }
            var settings_sq  = getSystemSettings_();
            var amountUsd_sq = amountCents_sq / 100;
            var rewardEp_sq  = Math.floor(amountUsd_sq * settings_sq.usdToJpy * 0.05 * settings_sq.epPerJpy);
            pendingSheet_sq.appendRow([
              new Date(),
              paymentId_sq,
              userId_sq,
              buyerRefLoginId,
              buyerRefEmail,
              amountUsd_sq,
              rewardEp_sq,
              "pending",
              ""
            ]);
            Logger.log("[cc_affiliate_queue] queued: payer=" + userId_sq
              + " referrer=" + buyerRefLoginId + " ep=" + rewardEp_sq);
          }
        }
      }
    } catch (ecc) {
      Logger.log("[cc_affiliate_queue] error: " + String(ecc));
    }
```

- [ ] **Step 3: cc_affiliate_pending_list GAS アクションを追加**

`gas/Code.gs` の `square_grant_bp` ブロック終了後に追加：

```javascript
  // =========================================================
  // cc_affiliate_pending_list（管理：CC付与待ちリスト）
  // =========================================================
  if (action === "cc_affiliate_pending_list") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }
    var pendingSheet_l = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("cc_affiliate_pending");
    if (!pendingSheet_l) return json_({ ok: true, items: [] });
    var pData_l    = pendingSheet_l.getDataRange().getValues();
    var pHeaders_l = pData_l[0];
    var pIdx_l     = indexMap_(pHeaders_l);
    var items_l    = [];
    for (var li = 1; li < pData_l.length; li++) {
      var row_l = pData_l[li];
      var status_l = str_(row_l[pIdx_l["status"]]);
      var ts_l = row_l[pIdx_l["ts"]];
      items_l.push({
        square_payment_id: str_(row_l[pIdx_l["square_payment_id"]]),
        payer_login_id:    str_(row_l[pIdx_l["payer_login_id"]]),
        referrer_login_id: str_(row_l[pIdx_l["referrer_login_id"]]),
        referrer_email:    str_(row_l[pIdx_l["referrer_email"]]),
        amount_usd:        Number(row_l[pIdx_l["amount_usd"]] || 0),
        reward_ep:         Number(row_l[pIdx_l["reward_ep"]]  || 0),
        status:            status_l,
        ts:                ts_l ? new Date(ts_l).toISOString() : "",
        granted_at:        row_l[pIdx_l["granted_at"]] ? new Date(row_l[pIdx_l["granted_at"]]).toISOString() : "",
      });
    }
    return json_({ ok: true, items: items_l });
  }
```

- [ ] **Step 4: TypeScript チェック**

```bash
cd C:/Users/unite/aisalon/aisalon && npx tsc --noEmit --skipLibCheck 2>&1
```
期待値: jest エラーのみ

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs app/api/square/webhook/route.ts
git commit -m "feat(cc-affiliate): queue CC affiliate rewards for manual admin grant"
```

---

## Task 3: GAS — cc_affiliate_grant + ep_notification_clear + me 拡張 + CC月次

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1: cc_affiliate_grant アクションを追加**

`cc_affiliate_pending_list` ブロックの直後に追加：

```javascript
  // =========================================================
  // cc_affiliate_grant（管理：CC付与待ちを実際にEP付与）
  // =========================================================
  if (action === "cc_affiliate_grant") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }
    var paymentId_g = str_(body.payment_id);
    if (!paymentId_g) return json_({ ok: false, error: "payment_id_required" });

    var pendingSheet_g = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("cc_affiliate_pending");
    if (!pendingSheet_g) return json_({ ok: false, error: "pending_sheet_not_found" });

    var pData_g    = pendingSheet_g.getDataRange().getValues();
    var pHeaders_g = pData_g[0];
    var pIdx_g     = indexMap_(pHeaders_g);

    var targetRow_g = -1;
    var record_g    = null;
    for (var gi = 1; gi < pData_g.length; gi++) {
      if (str_(pData_g[gi][pIdx_g["square_payment_id"]]) === paymentId_g) {
        targetRow_g = gi + 1;
        record_g    = pData_g[gi];
        break;
      }
    }
    if (targetRow_g === -1) return json_({ ok: false, error: "payment_not_found" });
    if (str_(record_g[pIdx_g["status"]]) !== "pending") return json_({ ok: false, error: "already_granted" });

    var refLoginId_g  = str_(record_g[pIdx_g["referrer_login_id"]]);
    var refEmail_g    = str_(record_g[pIdx_g["referrer_email"]]);
    var rewardEp_g    = Number(record_g[pIdx_g["reward_ep"]]  || 0);
    var amountUsd_g   = Number(record_g[pIdx_g["amount_usd"]] || 0);
    var payerLoginId_g = str_(record_g[pIdx_g["payer_login_id"]]);

    // applies シートで紹介者行を探す
    var appValues_g = sheet.getDataRange().getValues();
    var appHeader_g = appValues_g[0];
    ensureCols_(sheet, appHeader_g, ["login_id","ep_balance","ep_notification"]);
    appValues_g = sheet.getDataRange().getValues();
    appHeader_g = appValues_g[0];
    var appIdx_g = indexMap_(appHeader_g);

    var refRow_g = -1;
    for (var agi = 1; agi < appValues_g.length; agi++) {
      if (str_(appValues_g[agi][appIdx_g["login_id"]]) === refLoginId_g) {
        refRow_g = agi + 1;
        break;
      }
    }
    if (refRow_g === -1) return json_({ ok: false, error: "referrer_not_found" });

    // ep_balance 加算
    var curEp_g = Number(sheet.getRange(refRow_g, appIdx_g["ep_balance"] + 1).getValue() || 0);
    sheet.getRange(refRow_g, appIdx_g["ep_balance"] + 1).setValue(curEp_g + rewardEp_g);

    // wallet_ledger 記録
    appendWalletLedger_({
      kind:     "cc_affiliate_reward",
      login_id: refLoginId_g,
      email:    refEmail_g,
      amount:   rewardEp_g,
      memo:     JSON.stringify({
        from:              payerLoginId_g,
        level:             1,
        amount_usd:        amountUsd_g,
        rate_pct:          5,
        square_payment_id: paymentId_g,
      }),
    });

    // ep_notification 加算（未読通知）
    var curNotif_g = Number(sheet.getRange(refRow_g, appIdx_g["ep_notification"] + 1).getValue() || 0);
    sheet.getRange(refRow_g, appIdx_g["ep_notification"] + 1).setValue(curNotif_g + rewardEp_g);

    // pending record を granted に更新
    pendingSheet_g.getRange(targetRow_g, pIdx_g["status"]     + 1).setValue("granted");
    pendingSheet_g.getRange(targetRow_g, pIdx_g["granted_at"] + 1).setValue(new Date());

    Logger.log("[cc_affiliate_grant] granted: referrer=" + refLoginId_g + " ep=" + rewardEp_g);
    return json_({ ok: true, reward_ep: rewardEp_g, referrer_login_id: refLoginId_g });
  }
```

- [ ] **Step 2: ep_notification_clear アクションを追加**

`cc_affiliate_grant` ブロックの直後に追加：

```javascript
  // =========================================================
  // ep_notification_clear（ユーザー：EP通知を既読にする）
  // =========================================================
  if (action === "ep_notification_clear") {
    var id_enc  = str_(body.id);
    var code_enc = str_(body.code);
    if (!id_enc || !code_enc) return json_({ ok: false, error: "invalid" });

    var encValues = sheet.getDataRange().getValues();
    var encHeader = encValues[0];
    ensureCols_(sheet, encHeader, ["login_id","pw_hash","ep_notification"]);
    encValues = sheet.getDataRange().getValues();
    encHeader = encValues[0];
    var encIdx = indexMap_(encHeader);

    for (var ei = 1; ei < encValues.length; ei++) {
      var encRow     = encValues[ei];
      var encLoginId = str_(encRow[encIdx["login_id"]]);
      var encEmail   = str_(encRow[encIdx["email"] !== undefined ? encIdx["email"] : -1] || "");
      if (id_enc !== encLoginId && id_enc !== encEmail) continue;
      var encPwHash  = str_(encRow[encIdx["pw_hash"]]);
      if (!encPwHash) return json_({ ok: false, error: "invalid" });
      var encPwCheck = hmacSha256Hex_(SECRET, encLoginId + ":" + code_enc);
      if (encPwCheck !== encPwHash) return json_({ ok: false, error: "invalid" });
      sheet.getRange(ei + 1, encIdx["ep_notification"] + 1).setValue(0);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: "not_found" });
  }
```

- [ ] **Step 3: me アクションに ep_notification を追加**

GAS `me` アクションの `ensureCols_` リスト（line ~3675）に `"ep_notification"` を追加：

```javascript
    ensureCols_(targetSheet_me, header, [
      "login_id",
      "pw_hash",
      "email",
      "status",
      "plan",
      "my_ref_code",
      "ref_path",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ep_notification",
    ]);
```

me アクションの return（line ~3734）に追加：

```javascript
    return json_({
      ok: true,
      login_id: loginId,
      email: email,
      status: status,
      plan: str_(hit.r[idx["plan"]]),
      my_ref_code: str_(hit.r[idx["my_ref_code"]]),
      ref_path: str_(hit.r[idx["ref_path"]]),
      referrer_login_id: str_(hit.r[idx["referrer_login_id"]]),
      referrer_2_login_id: str_(hit.r[idx["referrer_2_login_id"]]),
      referrer_3_login_id: str_(hit.r[idx["referrer_3_login_id"]]),
      ep_notification: Number(hit.r[idx["ep_notification"]] || 0),
    });
```

- [ ] **Step 4: MonthlyTab CC集計（Phase 2）を有効化**

`gas/Code.gs` の Phase 2 コメントアウトブロック全体（`/*` 〜 `*/`）を以下に置き換え：

```javascript
    // --- CC affiliate rewards from wallet_ledger ---
    var wlSheet_cc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("wallet_ledger");
    if (wlSheet_cc) {
      var wlValues_cc = getValuesSafe_(wlSheet_cc);
      if (wlValues_cc.length > 1) {
        var wlHeader_cc = wlValues_cc[0];
        var wlIdx_cc    = indexMap_(wlHeader_cc);
        for (var wli = 1; wli < wlValues_cc.length; wli++) {
          var wlRow = wlValues_cc[wli];
          if (str_(wlRow[wlIdx_cc["kind"]]) !== "cc_affiliate_reward") continue;
          var wlTs = wlRow[wlIdx_cc["ts"]];
          if (!wlTs) continue;
          var wlDate = new Date(wlTs);
          if (isNaN(wlDate.getTime())) continue;
          if (wlDate < startUtc || wlDate >= endUtc) continue;
          var wlRefId = str_(wlRow[wlIdx_cc["login_id"]]);
          if (!wlRefId) continue;
          var wlEp  = Number(wlRow[wlIdx_cc["amount"]] || 0);
          var wlUsd = 0;
          try {
            var wlMemo = JSON.parse(str_(wlRow[wlIdx_cc["memo"]]));
            wlUsd = Number(wlMemo.amount_usd || 0);
          } catch (ej) {}
          var wlEntry = ensureReferrer(wlRefId);
          wlEntry.levels[0].cc_usd   += wlUsd;
          wlEntry.levels[0].cc_ep    += wlEp;
          wlEntry.levels[0].total_ep += wlEp;
        }
      }
    }
```

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): cc_affiliate_grant, ep_notification_clear, me ep_notification, CC monthly aggregation"
```

---

## Task 4: API ルート — cc-affiliate-pending / cc-affiliate-grant / ep-notification-clear

**Files:**
- Create: `app/api/admin/cc-affiliate-pending/route.ts`
- Create: `app/api/admin/cc-affiliate-grant/route.ts`
- Create: `app/api/ep-notification-clear/route.ts`

- [ ] **Step 1: cc-affiliate-pending API ルートを作成**

```typescript
// app/api/admin/cc-affiliate-pending/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;
    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "cc_affiliate_pending_list", adminKey }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: cc-affiliate-grant API ルートを作成**

```typescript
// app/api/admin/cc-affiliate-grant/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;
    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    const body       = await req.json().catch(() => ({} as any));
    const payment_id = String(body?.payment_id ?? "").trim();
    if (!payment_id) {
      return NextResponse.json({ ok: false, error: "payment_id_required" }, { status: 400 });
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "cc_affiliate_grant", adminKey, payment_id }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: ep-notification-clear API ルートを作成**

```typescript
// app/api/ep-notification-clear/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const base   = process.env.GAS_WEBAPP_URL!;
    const key    = process.env.GAS_API_KEY!;
    if (!base || !key) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    const body = await req.json().catch(() => ({} as any));
    const id   = String(body?.id   ?? "").trim();
    const code = String(body?.code ?? "").trim();
    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "id_and_code_required" }, { status: 400 });
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "ep_notification_clear", id, code }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 4: TypeScript チェック**

```bash
cd C:/Users/unite/aisalon/aisalon && npx tsc --noEmit --skipLibCheck 2>&1
```
期待値: jest エラーのみ

- [ ] **Step 5: コミット**

```bash
git add app/api/admin/cc-affiliate-pending/route.ts app/api/admin/cc-affiliate-grant/route.ts app/api/ep-notification-clear/route.ts
git commit -m "feat(api): cc-affiliate-pending, cc-affiliate-grant, ep-notification-clear routes"
```

---

## Task 5: 管理UI — CcPendingTab + finance/page + AffiliateTab

**Files:**
- Create: `app/admin/finance/CcPendingTab.tsx`
- Modify: `app/admin/finance/page.tsx`
- Modify: `app/admin/finance/AffiliateTab.tsx`

- [ ] **Step 1: CcPendingTab.tsx を作成**

```typescript
// app/admin/finance/CcPendingTab.tsx
"use client";

import { useEffect, useState } from "react";

type PendingItem = {
  square_payment_id: string;
  payer_login_id:    string;
  referrer_login_id: string;
  referrer_email:    string;
  amount_usd:        number;
  reward_ep:         number;
  status:            string;
  ts:                string;
  granted_at:        string;
};

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function CcPendingTab() {
  const [items,   setItems]   = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [filter,  setFilter]  = useState<"all" | "pending" | "granted">("pending");

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch("/api/admin/cc-affiliate-pending", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        setItems(Array.isArray(json.items) ? json.items : []);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grant = async (payment_id: string) => {
    if (!window.confirm(`payment_id: ${payment_id} のEPを付与しますか？`)) return;
    setGrantingId(payment_id);
    try {
      const res  = await fetch("/api/admin/cc-affiliate-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "grant failed");
      alert(`付与完了: ${data.reward_ep} EP → ${data.referrer_login_id}`);
      load();
    } catch (e: any) {
      alert("エラー: " + String(e?.message ?? e));
    } finally {
      setGrantingId(null);
    }
  };

  const filtered = items.filter(i => filter === "all" || i.status === filter);
  const pendingCount = items.filter(i => i.status === "pending").length;

  return (
    <div>
      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      <div className="mb-4 flex items-center gap-3">
        {(["pending","granted","all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg px-4 py-1.5 text-xs font-bold transition",
              filter === f ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200",
            ].join(" ")}
          >
            {f === "pending" ? `未付与 (${pendingCount})` : f === "granted" ? "付与済み" : "全件"}
          </button>
        ))}
        <button onClick={load} className="ml-auto rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
          更新
        </button>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">対象なし</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-bold">日時</th>
                <th className="px-3 py-2 font-bold">購入者</th>
                <th className="px-3 py-2 font-bold">紹介者</th>
                <th className="px-3 py-2 font-bold text-right">USD額</th>
                <th className="px-3 py-2 font-bold text-right">付与予定EP</th>
                <th className="px-3 py-2 font-bold text-center">状態</th>
                <th className="px-3 py-2 font-bold text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.square_payment_id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                  <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmt(item.ts)}</td>
                  <td className="px-3 py-2 font-mono text-zinc-200">{item.payer_login_id}</td>
                  <td className="px-3 py-2 font-mono text-zinc-200">{item.referrer_login_id}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">${item.amount_usd.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-400">+{item.reward_ep.toLocaleString()} EP</td>
                  <td className="px-3 py-2 text-center">
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      item.status === "pending" ? "bg-amber-900/60 text-amber-300" : "bg-emerald-900/60 text-emerald-300",
                    ].join(" ")}>
                      {item.status === "pending" ? "未付与" : "付与済み"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.status === "pending" ? (
                      <button
                        onClick={() => grant(item.square_payment_id)}
                        disabled={grantingId === item.square_payment_id}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {grantingId === item.square_payment_id ? "付与中…" : "付与"}
                      </button>
                    ) : (
                      <span className="text-zinc-600 text-[10px]">{fmt(item.granted_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: finance/page.tsx に CC付与待ちタブを追加**

```typescript
// app/admin/finance/page.tsx
"use client";

import { useState } from "react";
import UsersTab from "./UsersTab";
import AffiliateTab from "./AffiliateTab";
import TreeTab from "./TreeTab";
import MonthlyTab from "./MonthlyTab";
import CcPendingTab from "./CcPendingTab";

type Tab = "users" | "affiliate" | "tree" | "monthly" | "cc_pending";

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  const tabs: { key: Tab; label: string }[] = [
    { key: "users",      label: "ユーザー詳細" },
    { key: "affiliate",  label: "アフィリエイト" },
    { key: "tree",       label: "紹介ツリー" },
    { key: "monthly",    label: "月次集計" },
    { key: "cc_pending", label: "CC付与待ち" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <header className="mb-6 flex items-center gap-4">
          <a
            href="/admin"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            ← admin に戻る
          </a>
          <h1 className="text-xl font-bold text-white">財務管理</h1>
        </header>

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

        {activeTab === "users"      && <UsersTab />}
        {activeTab === "affiliate"  && <AffiliateTab />}
        {activeTab === "tree"       && <TreeTab />}
        {activeTab === "monthly"    && <MonthlyTab />}
        {activeTab === "cc_pending" && <CcPendingTab />}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: AffiliateTab の kind フィルタを更新**

`app/admin/finance/AffiliateTab.tsx` line 51：

```typescript
    () => ledger.filter(l => l.kind === "affiliate_reward" || l.kind === "cc_affiliate_reward")
```

- [ ] **Step 4: TypeScript チェック**

```bash
cd C:/Users/unite/aisalon/aisalon && npx tsc --noEmit --skipLibCheck 2>&1
```
期待値: jest エラーのみ

- [ ] **Step 5: コミット**

```bash
git add app/admin/finance/CcPendingTab.tsx app/admin/finance/page.tsx app/admin/finance/AffiliateTab.tsx
git commit -m "feat(admin): CC付与待ちタブ追加、AffiliateTab kind フィルタ更新"
```

---

## Task 6: /api/me 拡張 + TOP ページ EP 通知ポップアップ

**Files:**
- Modify: `app/api/me/route.ts`
- Modify: `app/top/page.tsx`

- [ ] **Step 1: /api/me の型と返却値に ep_notification を追加**

`app/api/me/route.ts` の `GasMeResponse` 型を更新（ok:true の場合）：

```typescript
type GasMeResponse =
  | {
      ok: true;
      login_id: string;
      email: string;
      status: string;
      plan: string;
      my_ref_code: string;
      ref_path?: string;
      referrer_login_id?: string;
      referrer_2_login_id?: string;
      referrer_3_login_id?: string;
      ep_notification?: number;
    }
  | {
      ok: false;
      reason?: "invalid" | "pending";
      error?: string;
    };
```

`callGasMe` の return（ok:true 分岐）に追加：

```typescript
      return {
        ok: true,
        login_id:            str(data.login_id),
        email:               str(data.email),
        status:              str(data.status),
        plan:                str(data.plan),
        my_ref_code:         str(data.my_ref_code),
        ref_path:            str(data.ref_path),
        referrer_login_id:   str(data.referrer_login_id),
        referrer_2_login_id: str(data.referrer_2_login_id),
        referrer_3_login_id: str(data.referrer_3_login_id),
        ep_notification:     typeof data.ep_notification === "number" ? data.ep_notification : 0,
      };
```

- [ ] **Step 2: /top ページに EP 通知ポップアップを追加**

`app/top/page.tsx` の既存通知 state（`bpGrantModal` の近く）に追加：

```typescript
  // EP獲得通知（CCアフィリエイト付与後）
  const [epNotification, setEpNotification] = useState<{ amount: number } | null>(null);
```

既存の `useEffect` 内（`api/user/pending-bp` チェックと同じブロック）に追記：

```typescript
    if (id && code) {
      // 既存の pending-bp チェック...
      
      // EP通知チェック
      (async () => {
        try {
          const meRes = await fetch("/api/me", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ id, code }),
          });
          const meData = await meRes.json().catch(() => ({ ok: false }));
          if (meData.ok && meData.me?.ep_notification > 0) {
            setEpNotification({ amount: meData.me.ep_notification });
          }
        } catch {
          // 通知失敗はサイレントに無視
        }
      })();
    }
```

EP通知モーダルの JSX を既存の `bpGrantModal` モーダルの直後に追加：

```tsx
      {/* EP獲得通知モーダル */}
      {epNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-zinc-900 p-8 text-center shadow-2xl">
            <div className="mb-2 text-4xl">🎉</div>
            <h2 className="mb-2 text-xl font-extrabold text-white">EP を獲得しました！</h2>
            <p className="mb-6 text-3xl font-black text-emerald-400">
              +{epNotification.amount.toLocaleString()} EP
            </p>
            <p className="mb-6 text-xs text-zinc-400">紹介アフィリエイト報酬として付与されました</p>
            <button
              onClick={async () => {
                setEpNotification(null);
                try {
                  const _id   = (auth as any)?.id || (auth as any)?.loginId || "";
                  const _code = getAuthSecret() || (auth as any)?.token || "";
                  await fetch("/api/ep-notification-clear", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: _id, code: _code }),
                  });
                } catch {}
              }}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-500"
            >
              確認
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 3: TypeScript チェック**

```bash
cd C:/Users/unite/aisalon/aisalon && npx tsc --noEmit --skipLibCheck 2>&1
```
期待値: jest エラーのみ

- [ ] **Step 4: コミット**

```bash
git add app/api/me/route.ts app/top/page.tsx
git commit -m "feat(ep-notification): /api/me ep_notification + TOP page EP popup"
```

---

## 最終確認 & プッシュ

- [ ] **Step 1: 全ファイルの最終 TypeScript チェック**

```bash
cd C:/Users/unite/aisalon/aisalon && npx tsc --noEmit --skipLibCheck 2>&1
```
期待値: `error TS2688: Cannot find type definition file for 'jest'.` のみ

- [ ] **Step 2: 変更ファイル確認**

```bash
git diff --stat HEAD~6 HEAD 2>&1
```
期待値: 11ファイル変更（gas/Code.gs, webhook/route.ts, 3 API routes, CcPendingTab.tsx, finance/page.tsx, AffiliateTab.tsx, MonthlyTab.tsx, /api/me/route.ts, /top/page.tsx）

- [ ] **Step 3: プッシュ**

```bash
git push origin main 2>&1
```
