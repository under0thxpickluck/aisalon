# /5000 決済〜自動承認フロー 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/5000` グループに NOWPayments 決済 → IPN 受信 → 自動承認フローを追加し、フォーム入力後に決済・自動でログイン情報発行まで完結させる。

**Architecture:** `/5000` 専用の独立した API ルート群（`/api/5000/nowpayments/*`）を新規作成し、既存の通常 LIFAI フローは一切変更しない。GAS に `approveRowCore5000_()` 共有関数を追加し、手動承認（admin）と自動承認（IPN）の両方から呼ぶ。

**Tech Stack:** Next.js 14 App Router, TypeScript, Google Apps Script, NOWPayments API (USDT/TRC20)

---

## ファイル構成

### 新規作成
| ファイル | 役割 |
|---|---|
| `app/api/5000/nowpayments/create/route.ts` | apply_id からplan取得→NOWPayments invoice作成 |
| `app/api/5000/nowpayments/ipn/route.ts` | IPN受信・署名検証・GAS payment_update_5000呼び出し |
| `app/api/5000/purchase-status/route.ts` | apply_id でステータス照会 |
| `app/api/5000/reset/resend/route.ts` | 認証メール再送 |
| `app/5000/purchase-status/page.tsx` | 購入状況確認ページ（ポーリング付き） |

### 変更（後方互換拡張のみ）
| ファイル | 変更内容 |
|---|---|
| `app/5000/apply/page.tsx` | Draft5000にplan追加、sessionStorageから初期値読み込み |
| `app/5000/confirm/page.tsx` | Draft5000にplan追加、決済ステップ追加（成功時にリダイレクト） |
| `app/5000/page.tsx` | handleCta()でplan をsessionStorageに保存 |
| `app/api/5000/apply/route.ts` | plan をbodyから受け取り（ハードコード"5000"を変更）、apply_id を返却 |
| `gas/Code.gs` | apply_5000拡張 + approveRowCore5000_追加 + payment_update_5000/get_apply_status_5000/reset_resend_5000追加 |

### 変更しないファイル
- `app/api/nowpayments/create/route.ts`（通常LIFAIの決済ルート）
- `app/api/nowpayments/ipn/route.ts`（通常LIFAIのIPN）
- `app/api/5000/admin/approve/route.ts`
- `app/5000/admin/page.tsx`
- `app/5000/login/page.tsx`
- その他すべての既存ファイル

---

## コンテキスト（全タスク共通）

**GAS Code.gs のヘルパー関数（定義済み・使用可）:**
- `ensureCols_(sheet, header, cols)` — 不足列をシートの右端に追加する
- `indexMap_(header)` — ヘッダー配列から `{ colName: index }` マップを返す
- `str_(v)` — 任意値を文字列に変換、null/undefined は `""`
- `randChars_(len)` — 紛らわしい文字を除いたランダム英数字文字列
- `genResetToken_()` — UUID + 16文字のランダム文字列でリセットトークン生成
- `sendResetMail_(to, loginId, token)` — パスワードリセットメール送信
- `generateRefCode5000_(applySheet, idx)` — 重複なしの `5K` + 6文字の紹介コード生成
- `getLedgerSheet5000_(ss5000, yearMonth)` — 月別台帳シート取得・自動生成
- `json_(obj)` — `ContentService.createTextOutput(JSON.stringify(obj))` を返す
- `getAppliesSheet5000_()` — /5000スプレッドシートの applies シートを返す

**GAS の apply_5000 アクションは Code.gs の行 464 から始まる。**
**GAS の admin_approve_5000 アクションは Code.gs の行 2825 から始まる。**
**GAS の handle_() 関数の最後の action 判定は `action === "admin_approve_5000"` の直後 (行 3003-3007)。**

**Draft5000 型は `app/5000/apply/page.tsx` と `app/5000/confirm/page.tsx` の両方で個別定義されている（共有モジュールなし）。両方に同じ変更が必要。**

**環境変数（`.env.local` に設定済み）:**
- `GAS_WEBAPP_URL` — GAS デプロイURL
- `GAS_API_KEY` — GAS APIキー
- `GAS_ADMIN_KEY` — GAS 管理者キー
- `NOWPAYMENTS_API_KEY` — NOWPayments APIキー
- `NOWPAYMENTS_IPN_SECRET` — IPN署名検証用シークレット
- `NEXT_PUBLIC_SITE_URL` — サイトURL（例: `https://lifai.vercel.app`）

**ビルド確認コマンド（テストスイートなし）:**
```bash
npm run build
```

---

## Task 1: フロント plan フィールド追加 + page.tsx CTA修正 + API route plan対応

**Files:**
- Modify: `app/5000/apply/page.tsx`
- Modify: `app/5000/confirm/page.tsx`
- Modify: `app/5000/page.tsx`
- Modify: `app/api/5000/apply/route.ts`

**背景:** 現在 `Draft5000` に `plan` フィールドがなく、API route が `plan: "5000"` をハードコードしている。ランディングページで選択したプランをフォーム→確認→API→GASまで伝播させる必要がある。

- [ ] **Step 1: `app/5000/apply/page.tsx` の Draft5000 に plan を追加し、sessionStorage から初期値を読み込む**

`Draft5000` 型と `EMPTY` に `plan: string` を追加し、useEffect でマウント時に `sessionStorage.getItem("5000_plan")` を読んで draft に設定する。

```typescript
// Draft5000 型の変更（既存型定義を置き換え）
type Draft5000 = {
  email: string;
  name: string;
  nameKana: string;
  ageBand: string;
  prefecture: string;
  city: string;
  job: string;
  refName: string;
  refId: string;
  applyId: string;
  plan: string; // 追加
};

const EMPTY: Draft5000 = {
  email: "", name: "", nameKana: "",
  ageBand: "", prefecture: "", city: "", job: "",
  refName: "", refId: "", applyId: "",
  plan: "", // 追加
};
```

useEffect を以下に変更：
```typescript
useEffect(() => {
  const d = loadDraft5000();
  if (!d.applyId) {
    d.applyId = `5000_${Date.now()}`;
  }
  // planが未設定の場合、sessionStorageから読む（/5000ページで選択したプラン）
  if (!d.plan) {
    d.plan = sessionStorage.getItem("5000_plan") || "5000";
  }
  saveDraft5000(d);
  setDraft(d);
}, []);
```

- [ ] **Step 2: `app/5000/confirm/page.tsx` の Draft5000 に plan を追加し、確認テーブルに表示する**

```typescript
// Draft5000 型の変更（既存型定義を置き換え）
type Draft5000 = {
  email: string; name: string; nameKana: string;
  ageBand: string; prefecture: string; city: string; job: string;
  refName: string; refId: string; applyId: string;
  plan: string; // 追加
};

const EMPTY: Draft5000 = {
  email: "", name: "", nameKana: "",
  ageBand: "", prefecture: "", city: "", job: "",
  refName: "", refId: "", applyId: "",
  plan: "", // 追加
};
```

確認テーブルの最初に plan 行を追加（`<Row title="プラン" value={...} />` の直前）：
```tsx
// <Row title="メールアドレス" value={draft.email} /> の前に挿入
<Row title="プラン" value={draft.plan ? `$${draft.plan} プラン` : "—"} />
```

- [ ] **Step 3: `app/5000/page.tsx` の handleCta() でプランを sessionStorage に保存する**

既存の `handleCta` 関数を以下に変更：
```typescript
function handleCta() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("5000_plan", selectedPlan);
  }
  router.push("/5000/apply");
}
```

- [ ] **Step 4: `app/api/5000/apply/route.ts` を plan 動的対応 + apply_id 返却に変更する**

型定義に `plan` を追加し、ハードコードされた `plan: "5000"` を `body.plan` に変更。レスポンスに `apply_id` を含める。

```typescript
import { NextResponse } from "next/server";

type Apply5000Payload = {
  applyId?: string;
  plan?: string;   // 追加
  email?: string;
  name?: string;
  nameKana?: string;
  ageBand?: string;
  prefecture?: string;
  city?: string;
  job?: string;
  refName?: string;
  refId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Apply5000Payload;

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const apiKey = process.env.GAS_API_KEY;

    if (!gasUrl) {
      return NextResponse.json(
        { ok: false, where: "env", error: "GAS_WEBAPP_URL missing" },
        { status: 500 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, where: "env", error: "GAS_API_KEY missing" },
        { status: 500 }
      );
    }

    const applyId = body.applyId || `5000_${Date.now()}`;

    const safePayload = {
      action: "apply_5000",
      group: "5000",
      plan: body.plan || "5000",  // ハードコード→動的
      applyId,
      email: body.email ?? "",
      name: body.name ?? "",
      nameKana: body.nameKana ?? "",
      discordId: "",
      ageBand: body.ageBand ?? "",
      prefecture: body.prefecture ?? "",
      city: body.city ?? "",
      job: body.job ?? "",
      refName: body.refName ?? "",
      refId: body.refId ?? "",
    };

    const url = `${gasUrl}?key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safePayload),
      cache: "no-store",
    });

    const text = await r.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const ok = r.ok && (parsed as any)?.ok !== false;
    return NextResponse.json(
      {
        ok,
        apply_id: ok ? applyId : undefined,  // 追加: 成功時にapply_idを返す
        gas: { httpStatus: r.status, parsed },
      },
      { status: r.ok ? 200 : 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, where: "api", error: String(err) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: ビルド確認**

```bash
npm run build
```

期待出力: エラーなし、全ページのルートが表示される。

- [ ] **Step 6: コミット**

```bash
git add app/5000/apply/page.tsx app/5000/confirm/page.tsx app/5000/page.tsx app/api/5000/apply/route.ts
git commit -m "feat: /5000フローにplanフィールド追加・CTA修正・API route plan動的対応"
```

---

## Task 2: GAS `apply_5000` 拡張（新列・pending_payment・expected_paid）

**Files:**
- Modify: `gas/Code.gs` (apply_5000 アクションブロック: 行464〜532)

**背景:** 現在の `apply_5000` は `status = "pending"` でスプレッドシートに保存するだけ。新しい決済フローでは `status = "pending_payment"` + `expected_paid` 列が必要。また、既存の `admin_approve_5000` が後に使う新列（`approved_at`, `paid_at` 等）も `ensureCols_` で保証しておく。

- [ ] **Step 1: apply_5000 アクションブロックの `ensureCols_` 呼び出しを拡張し、expected_paid・payment系列・approved_at を追加する**

現在のコード（行476〜484付近）でシートが作成された後、`ensureCols_` を呼んで不足列を保証する。現在は `ensureCols_` が呼ばれていないため、新規追加する。

既存の `sheet5000.appendRow(["created_at","apply_id","plan","email","name","name_kana","age_band","prefecture","city","job","ref_name","ref_id","status"]);` の後（行484の直後）に以下を追加：

```javascript
    // ✅ 新規作成時はヘッダー確定のためgetDataRangeが必要
    let header5000 = sheet5000.getDataRange().getValues()[0];
    ensureCols_(sheet5000, header5000, [
      "expected_paid", "payment_id", "payment_status", "actually_paid",
      "pay_currency", "paid_at", "approved_at", "last_ipn_at",
      "auto_approve_reason", "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error", "referral_processed_at"
    ]);
    // ensureCols_ 後にヘッダー再取得
    header5000 = sheet5000.getDataRange().getValues()[0];
    header5000.forEach(function(h, i) { idx5000[h] = i; });
```

また、`if (!sheet5000)` の外（既にシートがある場合）にも同じ `ensureCols_` が必要。現在のコードでは既存シートがあるとき `header5000` と `idx5000` を取得するだけなので、その直後に同じ `ensureCols_` 呼び出しを追加：

```javascript
    // 既存シートの場合も新列を保証（後方互換）
    ensureCols_(sheet5000, header5000, [
      "expected_paid", "payment_id", "payment_status", "actually_paid",
      "pay_currency", "paid_at", "approved_at", "last_ipn_at",
      "auto_approve_reason", "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error", "referral_processed_at"
    ]);
    // ensureCols_ 後にヘッダー再取得
    const lastCol5000 = sheet5000.getLastColumn();
    header5000 = sheet5000.getRange(1, 1, 1, lastCol5000).getValues()[0];
    header5000.forEach(function(h, i) { idx5000[h] = i; });
```

- [ ] **Step 2: 新規行追加時の値を expected_paid・status=pending_payment に変更する**

`newRow5000[idx5000["status"]] = "pending";` を以下に変更：

```javascript
    const planAmountMap5000 = { "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 };
    newRow5000[idx5000["status"]] = "pending_payment";  // "pending" → "pending_payment"
    if (idx5000["expected_paid"] !== undefined) {
      newRow5000[idx5000["expected_paid"]] = planAmountMap5000[plan] || 0;
    }
```

- [ ] **Step 3: 既存行更新時にも expected_paid・status を更新する（まだ pending_payment でない場合のみ）**

既存行更新ブロック（`} else {` の中）に以下を追加：

```javascript
    // 既存行更新時: expected_paid が未設定なら設定する
    if (idx5000["expected_paid"] !== undefined) {
      const existingExpected = sheet5000.getRange(targetRow5000, idx5000["expected_paid"] + 1).getValue();
      if (!existingExpected) {
        const planAmountMap5000b = { "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 };
        sheet5000.getRange(targetRow5000, idx5000["expected_paid"] + 1).setValue(planAmountMap5000b[plan] || 0);
      }
    }
    // status が pending なら pending_payment に更新
    const existingStatus5000 = str_(sheet5000.getRange(targetRow5000, idx5000["status"] + 1).getValue());
    if (existingStatus5000 === "pending") {
      sheet5000.getRange(targetRow5000, idx5000["status"] + 1).setValue("pending_payment");
    }
```

- [ ] **Step 4: 返り値に apply_id を追加する**

`return json_({ ok: true });` を以下に変更：

```javascript
    return json_({ ok: true, apply_id: applyId });
```

- [ ] **Step 5: GAS をデプロイして動作確認**

GAS エディタで「デプロイ → 既存のデプロイを管理 → 新しいバージョン」でデプロイ後、ローカルから以下のcurlで確認：

```bash
# apply_5000 に plan="2000" を渡してシートに expected_paid=2000 が入るか確認
curl -s -X POST http://localhost:3000/api/5000/apply \
  -H "Content-Type: application/json" \
  -d '{"plan":"2000","email":"test2@example.com","name":"テスト","nameKana":"テスト","ageBand":"30s","prefecture":"tokyo","city":"渋谷区","job":"other"}'
```

期待レスポンス: `{"ok":true,"apply_id":"5000_xxx","gas":{...}}`

- [ ] **Step 6: コミット**

```bash
git add gas/Code.gs
git commit -m "feat: GAS apply_5000 拡張（expected_paid・pending_payment・apply_id返却）"
```

---

## Task 3: GAS `approveRowCore5000_()` 関数化 + `admin_approve_5000` リファクタ

**Files:**
- Modify: `gas/Code.gs`

**背景:** 現在の承認ロジックは `admin_approve_5000` にインラインで書かれている。`payment_update_5000`（Task 4）からも同じロジックを呼ぶため、共有関数 `approveRowCore5000_` に切り出す。`admin_approve_5000` はその関数を呼ぶだけに変更する。

**新関数のシグネチャ:** `approveRowCore5000_(ss5000, applySheet, header, idx, rowIndex, reason)`
- `ss5000`: スプレッドシートオブジェクト（紹介チェーン用）
- `applySheet`: applies シートオブジェクト
- `header`: ヘッダー配列
- `idx`: `indexMap_` の返り値（列名→インデックス）
- `rowIndex`: 対象行の1-indexed行番号
- `reason`: 承認理由文字列（例: `"admin_manual"`, `"payment_finished"`）

**返り値:** `{ ok: true, already: boolean, loginId: string, myRefCode: string, resetSent: boolean, referralResults: array }`

- [ ] **Step 1: `approveRowCore5000_` 関数を Code.gs の末尾付近（行3007 の `// actionが不明` の前）に追加する**

```javascript
// =========================================================
// ✅ /5000 承認コア（admin_approve_5000 と payment_update_5000 から共通利用）
// - approved_at が既に設定済み または status="approved" → already:true で早期リターン（冪等）
// - reason: "admin_manual" | "payment_finished" など
// =========================================================
function approveRowCore5000_(ss5000, applySheet, header, idx, rowIndex, reason) {
  // --- 冪等チェック ---
  const approvedAt5000 = applySheet.getRange(rowIndex, idx["approved_at"] + 1).getValue();
  const curStatus5000 = str_(applySheet.getRange(rowIndex, idx["status"] + 1).getValue());
  if (approvedAt5000 || curStatus5000 === "approved") {
    return {
      ok: true, already: true,
      loginId: str_(applySheet.getRange(rowIndex, idx["login_id"] + 1).getValue()),
      myRefCode: str_(applySheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue()),
      resetSent: true,
      referralResults: []
    };
  }

  const email5000 = str_(applySheet.getRange(rowIndex, idx["email"] + 1).getValue());
  if (!email5000) return { ok: false, error: "no_email" };

  // --- login_id 生成（未設定の場合のみ）---
  let loginId5000 = str_(applySheet.getRange(rowIndex, idx["login_id"] + 1).getValue());
  if (!loginId5000) {
    loginId5000 = "5k_" + randChars_(6);
    applySheet.getRange(rowIndex, idx["login_id"] + 1).setValue(loginId5000);
  }

  // --- my_ref_code 生成（未設定の場合のみ）---
  let myRefCode5000 = str_(applySheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue());
  if (!myRefCode5000) {
    myRefCode5000 = generateRefCode5000_(applySheet, idx);
    applySheet.getRange(rowIndex, idx["my_ref_code"] + 1).setValue(myRefCode5000);
  }

  // --- リセットトークン生成 ---
  const token5000 = genResetToken_();
  const expires5000 = new Date(Date.now() + 72 * 60 * 60 * 1000);
  applySheet.getRange(rowIndex, idx["reset_token"] + 1).setValue(token5000);
  applySheet.getRange(rowIndex, idx["reset_expires"] + 1).setValue(expires5000);
  applySheet.getRange(rowIndex, idx["reset_used_at"] + 1).setValue("");

  // --- メール送信（二重送信防止）---
  const sentAt5000 = applySheet.getRange(rowIndex, idx["reset_sent_at"] + 1).getValue();
  let resetSent5000 = false;
  if (!sentAt5000) {
    try {
      sendResetMail_(email5000, loginId5000, token5000);
      applySheet.getRange(rowIndex, idx["reset_sent_at"] + 1).setValue(new Date());
      if (idx["mail_error"] !== undefined) {
        applySheet.getRange(rowIndex, idx["mail_error"] + 1).setValue("");
      }
      resetSent5000 = true;
      Logger.log("[approveRowCore5000_] mail sent: to=" + email5000 + " reason=" + reason);
    } catch (mailErr) {
      const mailErrMsg = String(mailErr);
      Logger.log("[approveRowCore5000_] mail FAILED: " + mailErrMsg);
      if (idx["mail_error"] !== undefined) {
        applySheet.getRange(rowIndex, idx["mail_error"] + 1).setValue(mailErrMsg);
      }
      return { ok: false, error: "mail_failed: " + mailErrMsg };
    }
  } else {
    // メール送信済み（GAS実行中断の救済）
    resetSent5000 = true;
  }

  // --- approved_at 記録 + status 更新 ---
  applySheet.getRange(rowIndex, idx["approved_at"] + 1).setValue(new Date());
  applySheet.getRange(rowIndex, idx["status"] + 1).setValue("approved");
  if (idx["auto_approve_reason"] !== undefined) {
    applySheet.getRange(rowIndex, idx["auto_approve_reason"] + 1).setValue(reason);
  }

  // --- 紹介チェーン遡り（最大5段・二重記録防止）---
  const referralAlreadyProcessed5000 = applySheet.getRange(rowIndex, idx["referral_processed_at"] + 1).getValue();
  const referralResults5000 = [];

  if (!referralAlreadyProcessed5000) {
    const planStr5000 = str_(applySheet.getRange(rowIndex, idx["plan"] + 1).getValue());
    const planAmountMap5000 = { "500": 500, "2000": 2000, "3000": 3000, "5000": 5000 };
    const entryAmount5000 = planAmountMap5000[planStr5000] || 0;
    const refRates5000 = [0.10, 0.05, 0.02, 0.02, 0.01];
    const yearMonth5000 = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy_MM");
    const ledgerSheet5000 = getLedgerSheet5000_(ss5000, yearMonth5000);

    const applyId5000 = str_(applySheet.getRange(rowIndex, idx["apply_id"] + 1).getValue());
    let currentRefCode5000 = str_(applySheet.getRange(rowIndex, idx["ref_id"] + 1).getValue());

    for (var lvl = 1; lvl <= 5 && currentRefCode5000; lvl++) {
      const chainData = applySheet.getDataRange().getValues();
      var referrerLoginId5000 = "";
      var referrerRefId5000 = "";
      for (var ci = 1; ci < chainData.length; ci++) {
        if (str_(chainData[ci][idx["my_ref_code"]]) === currentRefCode5000) {
          referrerLoginId5000 = str_(chainData[ci][idx["login_id"]]);
          referrerRefId5000 = str_(chainData[ci][idx["ref_id"]]);
          break;
        }
      }
      if (!referrerLoginId5000) break;
      if (entryAmount5000 > 0) {
        const rate5000 = refRates5000[lvl - 1];
        const commission5000 = Math.round(entryAmount5000 * rate5000 * 100) / 100;
        const levelSuffix = lvl === 1 ? "st" : lvl === 2 ? "nd" : lvl === 3 ? "rd" : "th";
        ledgerSheet5000.appendRow([
          new Date(), referrerLoginId5000, "referral_entry",
          commission5000, applyId5000, lvl,
          "$" + entryAmount5000 + " plan " + lvl + levelSuffix + " level " + Math.round(rate5000 * 100) + "%"
        ]);
        referralResults5000.push({ level: lvl, to: referrerLoginId5000, amount: commission5000 });
      }
      currentRefCode5000 = referrerRefId5000;
    }
    applySheet.getRange(rowIndex, idx["referral_processed_at"] + 1).setValue(new Date());
  }

  return {
    ok: true, already: false,
    loginId: loginId5000,
    myRefCode: myRefCode5000,
    resetSent: resetSent5000,
    referralResults: referralResults5000
  };
}
```

- [ ] **Step 2: `admin_approve_5000` アクションブロックを `approveRowCore5000_` を呼ぶだけに書き換える**

既存の `admin_approve_5000` のブロック（行2825〜3003）を以下に置き換える。`applyId` 検索と列保証は残し、承認処理は `approveRowCore5000_` に委譲する。

```javascript
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
      "my_ref_code", "mail_error", "referral_processed_at",
      "approved_at", "auto_approve_reason", "expected_paid",
      "payment_id", "payment_status", "actually_paid", "pay_currency",
      "paid_at", "last_ipn_at"
    ]);
    const lastCol_5000 = applySheet_5000.getLastColumn();
    header_5000 = applySheet_5000.getRange(1, 1, 1, lastCol_5000).getValues()[0];
    const idx_5000 = indexMap_(header_5000);

    // applyId で行を検索
    const allData_5000 = applySheet_5000.getDataRange().getValues();
    let targetRow_5000 = -1;
    for (let ri = 1; ri < allData_5000.length; ri++) {
      if (str_(allData_5000[ri][idx_5000["apply_id"]]) === applyId_5000) {
        targetRow_5000 = ri + 1;
        break;
      }
    }
    if (targetRow_5000 < 0) return json_({ ok: false, error: "applyId not found" });

    const result_5000 = approveRowCore5000_(ss5000, applySheet_5000, header_5000, idx_5000, targetRow_5000, "admin_manual");
    return json_(result_5000);
  }
```

- [ ] **Step 3: GAS をデプロイして既存の admin_approve_5000 が動作することを確認**

デプロイ後、既存のテスト申請（apply_id: `5000_1774710389836`）に対して承認を呼ぶ（`already: true` が返れば正常）：

```bash
ADMIN_USER=$(grep ADMIN_USER .env.local | cut -d= -f2)
ADMIN_PASS=$(grep ADMIN_PASS .env.local | cut -d= -f2)
curl -s -u "$ADMIN_USER:$ADMIN_PASS" \
  -X POST http://localhost:3000/api/5000/admin/approve \
  -H "Content-Type: application/json" \
  -d '{"applyId":"5000_1774710389836"}'
```

期待レスポンス: `{"ok":true,"already":true,"loginId":"5k_JB5NX2",...}`

- [ ] **Step 4: コミット**

```bash
git add gas/Code.gs
git commit -m "feat: GAS approveRowCore5000_関数化 + admin_approve_5000リファクタ"
```

---

## Task 4: GAS `payment_update_5000` + `get_apply_status_5000` + `reset_resend_5000` 追加

**Files:**
- Modify: `gas/Code.gs`

**追加場所:** `admin_approve_5000` アクションブロック（行2825）の前に以下3アクションを追加する。

- [ ] **Step 1: `payment_update_5000` アクションを追加する**

`admin_approve_5000` ブロックの直前（`// =========================================================\n  // admin_approve_5000` の前）に挿入：

```javascript
  // =========================================================
  // payment_update_5000（/5000: IPN受信→シート更新→自動承認判定）
  // =========================================================
  if (action === "payment_update_5000") {
    const ssId_pu5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_pu5) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const ss_pu5 = SpreadsheetApp.openById(ssId_pu5);
    const applySheet_pu5 = ss_pu5.getSheetByName("applies");
    if (!applySheet_pu5) return json_({ ok: false, error: "applies sheet not found" });

    // 必要列を保証
    let header_pu5 = applySheet_pu5.getDataRange().getValues()[0];
    ensureCols_(applySheet_pu5, header_pu5, [
      "apply_id", "plan", "email", "status", "ref_id",
      "expected_paid", "payment_id", "payment_status", "actually_paid",
      "pay_currency", "paid_at", "approved_at", "last_ipn_at",
      "auto_approve_reason", "login_id", "pw_hash", "pw_updated_at",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "my_ref_code", "mail_error", "referral_processed_at"
    ]);
    const lastCol_pu5 = applySheet_pu5.getLastColumn();
    header_pu5 = applySheet_pu5.getRange(1, 1, 1, lastCol_pu5).getValues()[0];
    const idx_pu5 = indexMap_(header_pu5);

    // apply_id で行を検索
    const applyId_pu5 = str_(body.applyId);
    if (!applyId_pu5) return json_({ ok: false, error: "applyId required" });

    const allData_pu5 = applySheet_pu5.getDataRange().getValues();
    let targetRow_pu5 = -1;
    for (let ri = 1; ri < allData_pu5.length; ri++) {
      if (str_(allData_pu5[ri][idx_pu5["apply_id"]]) === applyId_pu5) {
        targetRow_pu5 = ri + 1;
        break;
      }
    }
    if (targetRow_pu5 < 0) return json_({ ok: false, error: "applyId not found" });

    const paymentStatus_pu5 = str_(body.paymentStatus);
    const actuallyPaid_pu5 = Number(body.actuallyPaid) || 0;

    // payment_id / payment_status / actually_paid / pay_currency / last_ipn_at を更新
    if (idx_pu5["payment_id"] !== undefined && body.paymentId) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["payment_id"] + 1).setValue(str_(body.paymentId));
    }
    if (idx_pu5["payment_status"] !== undefined) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["payment_status"] + 1).setValue(paymentStatus_pu5);
    }
    if (idx_pu5["actually_paid"] !== undefined) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["actually_paid"] + 1).setValue(actuallyPaid_pu5);
    }
    if (idx_pu5["pay_currency"] !== undefined && body.payCurrency) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["pay_currency"] + 1).setValue(str_(body.payCurrency));
    }
    if (idx_pu5["last_ipn_at"] !== undefined) {
      applySheet_pu5.getRange(targetRow_pu5, idx_pu5["last_ipn_at"] + 1).setValue(new Date());
    }

    // NOWPayments status → /5000 内部 status マッピング
    const statusMap_pu5 = {
      "waiting": "payment_waiting",
      "confirming": "payment_confirming",
      "confirmed": "payment_confirmed",
      "partially_paid": "manual_review",
      "failed": "pending_error",
      "expired": "pending_error",
      "refunded": "pending_error"
    };

    let autoApproved_pu5 = false;
    let approveResult_pu5 = null;

    if (paymentStatus_pu5 === "finished") {
      // paid_at 記録
      if (idx_pu5["paid_at"] !== undefined) {
        applySheet_pu5.getRange(targetRow_pu5, idx_pu5["paid_at"] + 1).setValue(new Date());
      }

      // 金額チェック
      const expectedPaid_pu5 = Number(applySheet_pu5.getRange(targetRow_pu5, idx_pu5["expected_paid"] + 1).getValue()) || 0;
      const tolerance_pu5 = 0.02;

      if (expectedPaid_pu5 > 0 && actuallyPaid_pu5 >= expectedPaid_pu5 * (1 - tolerance_pu5)) {
        // 自動承認
        approveResult_pu5 = approveRowCore5000_(ss_pu5, applySheet_pu5, header_pu5, idx_pu5, targetRow_pu5, "payment_finished");
        if (approveResult_pu5.ok) {
          autoApproved_pu5 = true;
        }
      } else {
        // 金額不足
        applySheet_pu5.getRange(targetRow_pu5, idx_pu5["status"] + 1).setValue("manual_review");
        Logger.log("[payment_update_5000] amount insufficient: actually=" + actuallyPaid_pu5 + " expected=" + expectedPaid_pu5);
      }
    } else if (statusMap_pu5[paymentStatus_pu5]) {
      // approved_at が既にある（承認済み）なら status を上書きしない
      const approvedAt_pu5 = applySheet_pu5.getRange(targetRow_pu5, idx_pu5["approved_at"] + 1).getValue();
      if (!approvedAt_pu5) {
        applySheet_pu5.getRange(targetRow_pu5, idx_pu5["status"] + 1).setValue(statusMap_pu5[paymentStatus_pu5]);
      }
    }

    Logger.log("[payment_update_5000] applyId=" + applyId_pu5 + " paymentStatus=" + paymentStatus_pu5 + " autoApproved=" + autoApproved_pu5);
    return json_({
      ok: true,
      autoApproved: autoApproved_pu5,
      reason: autoApproved_pu5 ? "payment_finished" : (statusMap_pu5[paymentStatus_pu5] || paymentStatus_pu5),
      approveResult: approveResult_pu5
    });
  }
```

- [ ] **Step 2: `get_apply_status_5000` アクションを追加する**

`payment_update_5000` ブロックの前に挿入：

```javascript
  // =========================================================
  // get_apply_status_5000（/5000: 申請ステータス照会）
  // =========================================================
  if (action === "get_apply_status_5000") {
    const applyId_gs5 = str_(body.applyId);
    if (!applyId_gs5) return json_({ ok: false, error: "applyId required" });

    const ssId_gs5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_gs5) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const applySheet_gs5 = SpreadsheetApp.openById(ssId_gs5).getSheetByName("applies");
    if (!applySheet_gs5) return json_({ ok: false, error: "applies sheet not found" });

    const header_gs5 = applySheet_gs5.getDataRange().getValues()[0];
    const idx_gs5 = indexMap_(header_gs5);

    const allData_gs5 = applySheet_gs5.getDataRange().getValues();
    for (let ri = 1; ri < allData_gs5.length; ri++) {
      if (str_(allData_gs5[ri][idx_gs5["apply_id"]]) === applyId_gs5) {
        const row_gs5 = allData_gs5[ri];
        const status_gs5 = str_(row_gs5[idx_gs5["status"]]);
        const resetSentAt_gs5 = idx_gs5["reset_sent_at"] !== undefined ? row_gs5[idx_gs5["reset_sent_at"]] : "";
        return json_({
          ok: true,
          apply_id: applyId_gs5,
          status: status_gs5,
          payment_status: idx_gs5["payment_status"] !== undefined ? str_(row_gs5[idx_gs5["payment_status"]]) : "",
          plan: str_(row_gs5[idx_gs5["plan"]]),
          mail_sent: Boolean(resetSentAt_gs5)
        });
      }
    }
    return json_({ ok: false, error: "applyId not found" });
  }
```

- [ ] **Step 3: `reset_resend_5000` アクションを追加する**

`get_apply_status_5000` ブロックの前に挿入：

```javascript
  // =========================================================
  // reset_resend_5000（/5000: 認証メール再送）
  // =========================================================
  if (action === "reset_resend_5000") {
    const applyId_rr5 = str_(body.applyId);
    if (!applyId_rr5) return json_({ ok: false, error: "applyId required" });

    const ssId_rr5 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (!ssId_rr5) return json_({ ok: false, error: "SPREADSHEET_5000_ID not set" });

    const applySheet_rr5 = SpreadsheetApp.openById(ssId_rr5).getSheetByName("applies");
    if (!applySheet_rr5) return json_({ ok: false, error: "applies sheet not found" });

    let header_rr5 = applySheet_rr5.getDataRange().getValues()[0];
    ensureCols_(applySheet_rr5, header_rr5, [
      "apply_id", "status", "email", "login_id",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at", "mail_error"
    ]);
    const lastCol_rr5 = applySheet_rr5.getLastColumn();
    header_rr5 = applySheet_rr5.getRange(1, 1, 1, lastCol_rr5).getValues()[0];
    const idx_rr5 = indexMap_(header_rr5);

    const allData_rr5 = applySheet_rr5.getDataRange().getValues();
    let targetRow_rr5 = -1;
    for (let ri = 1; ri < allData_rr5.length; ri++) {
      if (str_(allData_rr5[ri][idx_rr5["apply_id"]]) === applyId_rr5) {
        targetRow_rr5 = ri + 1;
        break;
      }
    }
    if (targetRow_rr5 < 0) return json_({ ok: false, error: "applyId not found" });

    // approved の行のみ再送可
    const status_rr5 = str_(applySheet_rr5.getRange(targetRow_rr5, idx_rr5["status"] + 1).getValue());
    if (status_rr5 !== "approved") {
      return json_({ ok: false, error: "not_approved" });
    }

    const email_rr5 = str_(applySheet_rr5.getRange(targetRow_rr5, idx_rr5["email"] + 1).getValue());
    const loginId_rr5 = str_(applySheet_rr5.getRange(targetRow_rr5, idx_rr5["login_id"] + 1).getValue());
    if (!email_rr5 || !loginId_rr5) return json_({ ok: false, error: "missing email or login_id" });

    // トークン再生成
    const newToken_rr5 = genResetToken_();
    const newExpires_rr5 = new Date(Date.now() + 72 * 60 * 60 * 1000);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_token"] + 1).setValue(newToken_rr5);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_expires"] + 1).setValue(newExpires_rr5);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_used_at"] + 1).setValue("");

    sendResetMail_(email_rr5, loginId_rr5, newToken_rr5);
    applySheet_rr5.getRange(targetRow_rr5, idx_rr5["reset_sent_at"] + 1).setValue(new Date());
    if (idx_rr5["mail_error"] !== undefined) {
      applySheet_rr5.getRange(targetRow_rr5, idx_rr5["mail_error"] + 1).setValue("");
    }

    return json_({ ok: true });
  }
```

- [ ] **Step 4: GAS をデプロイして `get_apply_status_5000` を確認**

```bash
# ローカル dev server を起動してから
npm run dev &
sleep 8

# 既存の approved 申請のステータスを確認
curl -s "http://localhost:3000/api/5000/purchase-status?apply_id=5000_1774710389836"
# ※ Task 7 で /api/5000/purchase-status を作成後に実際にテスト可能
# GAS 直接テスト:
curl -s -X POST "$GAS_WEBAPP_URL?key=$GAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"get_apply_status_5000","applyId":"5000_1774710389836"}'
```

期待レスポンス: `{"ok":true,"apply_id":"5000_1774710389836","status":"approved","payment_status":"","plan":"5000","mail_sent":true}`

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs
git commit -m "feat: GAS payment_update_5000 + get_apply_status_5000 + reset_resend_5000 追加"
```

---

## Task 5: `/api/5000/nowpayments/create/route.ts` 新規作成

**Files:**
- Create: `app/api/5000/nowpayments/create/route.ts`

**背景:** `apply_id` を受け取り、GAS から plan を取得して NOWPayments の invoice を作成する。既存の `/api/nowpayments/create/route.ts` に近いが、`ipn_callback_url` を `/api/5000/nowpayments/ipn` に向け、`success_url` を `/5000/purchase-status` に向ける。

- [ ] **Step 1: ディレクトリ作成確認**

```bash
ls app/api/5000/
```

期待出力: `admin/  apply/` が表示される（ディレクトリ存在確認）。

- [ ] **Step 2: `/api/5000/nowpayments/create/route.ts` を作成する**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PLAN_AMOUNTS: Record<string, number> = {
  "500": 500,
  "2000": 2000,
  "3000": 3000,
  "5000": 5000,
};

function pickBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  if (vercel) return vercel.replace(/\/+$/, "");
  return "https://lifai.vercel.app";
}

export async function POST(req: Request) {
  let body: { apply_id?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }

  const { apply_id, plan } = body ?? {};

  if (!apply_id) {
    return NextResponse.json({ ok: false, error: "apply_id required" }, { status: 400 });
  }

  // plan が直接渡されていなければ GAS から取得
  let resolvedPlan = plan;
  if (!resolvedPlan) {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (gasUrl && gasKey) {
      try {
        const statusRes = await fetch(`${gasUrl}?key=${encodeURIComponent(gasKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_apply_status_5000", applyId: apply_id }),
          cache: "no-store",
        });
        const statusData = await statusRes.json().catch(() => ({}));
        resolvedPlan = statusData?.plan || "";
      } catch {
        // GAS 取得失敗でも続行（plan が空の場合は後でエラー）
      }
    }
  }

  const priceAmount = PLAN_AMOUNTS[resolvedPlan ?? ""] ?? 0;
  if (!priceAmount) {
    return NextResponse.json(
      { ok: false, error: `unknown plan: ${resolvedPlan}` },
      { status: 400 }
    );
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "NOWPAYMENTS_API_KEY missing" }, { status: 500 });
  }

  const baseUrl = pickBaseUrl();

  const payload = {
    price_amount: priceAmount,
    price_currency: "usd",
    pay_currency: "usdttrc20",
    order_id: apply_id,
    order_description: `LIFAI 5000 plan ${resolvedPlan}`,
    ipn_callback_url: `${baseUrl}/api/5000/nowpayments/ipn`,
    success_url: `${baseUrl}/5000/purchase-status?apply_id=${encodeURIComponent(apply_id)}`,
    cancel_url: `${baseUrl}/5000/apply`,
  };

  let res: Response;
  let data: Record<string, unknown>;
  try {
    res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    data = await res.json().catch(() => ({}));
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "network error", detail: String(e) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: (data as any)?.message || "nowpayments error", data },
      { status: 400 }
    );
  }

  if (!(data as any)?.invoice_url) {
    return NextResponse.json(
      { ok: false, error: "invoice_url missing from nowpayments response", data },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    invoice_url: (data as any).invoice_url,
    apply_id,
  });
}
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

期待出力: エラーなし。`/api/5000/nowpayments/create` が dynamic ルートとして表示される。

- [ ] **Step 4: HTTP レスポンス確認（apply_id 不足で 400）**

```bash
npm run dev &
sleep 8
curl -s -X POST http://localhost:3000/api/5000/nowpayments/create \
  -H "Content-Type: application/json" \
  -d '{}'
```

期待: `{"ok":false,"error":"apply_id required"}`

- [ ] **Step 5: コミット**

```bash
git add app/api/5000/nowpayments/create/route.ts
git commit -m "feat: /api/5000/nowpayments/create ルート新規作成"
```

---

## Task 6: `/api/5000/nowpayments/ipn/route.ts` 新規作成

**Files:**
- Create: `app/api/5000/nowpayments/ipn/route.ts`

**背景:** `/5000` 専用の IPN エンドポイント。既存の `/api/nowpayments/ipn` と同じ署名検証ロジックを使い、GAS `payment_update_5000` に転送する。

- [ ] **Step 1: `/api/5000/nowpayments/ipn/route.ts` を作成する**

```typescript
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { Buffer } from "buffer";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", hint: "POST webhook only" });
}

function verifyNowpaymentsSig(rawBody: string, sigHeader: string | null, ipnSecret: string) {
  try {
    if (!sigHeader) return false;
    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(rawBody);
    const digestHex = hmac.digest("hex");
    const a = Buffer.from(digestHex, "hex");
    const b = Buffer.from(sigHeader, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig");
  const isTest = process.env.NODE_ENV !== "production" && req.headers.get("x-test-ipn") === "1";

  console.log("[5000/IPN] hit", new Date().toISOString());
  console.log("[5000/IPN] isTest", isTest);

  if (ipnSecret && !isTest) {
    const ok = verifyNowpaymentsSig(raw, sig, ipnSecret);
    if (!ok) {
      console.warn("[5000/IPN] bad signature");
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const applyId = payload?.order_id as string | undefined;
  if (!applyId) {
    return NextResponse.json({ ok: false, error: "order_id missing" }, { status: 400 });
  }

  const paymentStatus = payload?.payment_status as string | undefined;
  const paymentId = payload?.payment_id;
  const actuallyPaid = payload?.actually_paid ?? payload?.pay_amount ?? 0;
  const payAmount = payload?.pay_amount ?? payload?.actually_paid;
  const payCurrency = payload?.pay_currency ?? payload?.pay_currency_code;
  const priceAmount = payload?.price_amount ?? payload?.amount;
  const priceCurrency = payload?.price_currency ?? payload?.price_currency_code;

  console.log("[5000/IPN] applyId", applyId, "paymentStatus", paymentStatus);

  if (gasUrl && gasKey) {
    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "payment_update_5000",
          applyId,
          paymentId,
          paymentStatus,
          actuallyPaid,
          payAmount,
          payCurrency,
          priceAmount,
          priceCurrency,
          isTest,
        }),
      });
      console.log("[5000/IPN] GAS status", r.status);
      try {
        const t = await r.text();
        console.log("[5000/IPN] GAS body", t.slice(0, 300));
      } catch {}
    } catch (e) {
      console.error("[5000/IPN] GAS notify failed", e);
    }
  }

  return NextResponse.json({ ok: true, isTest });
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

期待出力: エラーなし。

- [ ] **Step 3: テスト IPN 送信確認（x-test-ipn: 1 で署名スキップ）**

```bash
npm run dev &
sleep 8
curl -s -X POST http://localhost:3000/api/5000/nowpayments/ipn \
  -H "Content-Type: application/json" \
  -H "x-test-ipn: 1" \
  -d '{"order_id":"5000_test","payment_status":"waiting","payment_id":"pid123","actually_paid":0}'
```

期待: `{"ok":true,"isTest":true}`

- [ ] **Step 4: コミット**

```bash
git add app/api/5000/nowpayments/ipn/route.ts
git commit -m "feat: /api/5000/nowpayments/ipn ルート新規作成"
```

---

## Task 7: `/api/5000/purchase-status/route.ts` + `/api/5000/reset/resend/route.ts` 新規作成

**Files:**
- Create: `app/api/5000/purchase-status/route.ts`
- Create: `app/api/5000/reset/resend/route.ts`

- [ ] **Step 1: `/api/5000/purchase-status/route.ts` を作成する**

```typescript
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applyId = searchParams.get("apply_id") ?? "";

  if (!applyId) {
    return NextResponse.json({ ok: false, error: "apply_id required" }, { status: 400 });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "env missing" }, { status: 500 });
  }

  try {
    const r = await fetch(`${gasUrl}?key=${encodeURIComponent(gasKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_apply_status_5000", applyId }),
      cache: "no-store",
    });
    const text = await r.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    return NextResponse.json(
      parsed ?? { ok: false, error: "gas_not_json" },
      { status: r.ok ? 200 : 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: `/api/5000/reset/resend/route.ts` を作成する**

```typescript
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: { apply_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const applyId = body?.apply_id ?? "";
  if (!applyId) {
    return NextResponse.json({ ok: false, error: "apply_id required" }, { status: 400 });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "env missing" }, { status: 500 });
  }

  try {
    const r = await fetch(`${gasUrl}?key=${encodeURIComponent(gasKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_resend_5000", applyId }),
      cache: "no-store",
    });
    const text = await r.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    return NextResponse.json(
      parsed ?? { ok: false, error: "gas_not_json" },
      { status: r.ok ? 200 : 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: purchase-status GET テスト**

```bash
npm run dev &
sleep 8
# apply_id なしで 400
curl -s "http://localhost:3000/api/5000/purchase-status"
# 期待: {"ok":false,"error":"apply_id required"}

# 既存の approved 申請のステータスを取得
curl -s "http://localhost:3000/api/5000/purchase-status?apply_id=5000_1774710389836"
# 期待: {"ok":true,"apply_id":"5000_1774710389836","status":"approved",...}
```

- [ ] **Step 5: コミット**

```bash
git add app/api/5000/purchase-status/route.ts app/api/5000/reset/resend/route.ts
git commit -m "feat: /api/5000/purchase-status + /api/5000/reset/resend ルート新規作成"
```

---

## Task 8: `/5000/confirm/page.tsx` 決済ステップ追加

**Files:**
- Modify: `app/5000/confirm/page.tsx`

**背景:** 現在の confirm ページは申請送信後に「申請を受け付けました」メッセージを表示する。新フローでは、送信成功後に `/api/5000/nowpayments/create` を呼び、`invoice_url` へリダイレクトする。`apply_id` は `draft.applyId` から取得（API レスポンスを参照する必要はない）。

- [ ] **Step 1: `handleSubmit` 関数を決済ステップ付きに変更する**

既存の `handleSubmit` 関数全体を以下に置き換える：

```typescript
async function handleSubmit() {
  setErr(null);
  setLoading(true);
  try {
    // Step 1: フォームデータを GAS apply_5000 に送信
    const res = await fetch("/api/5000/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();

    if (!data?.ok) {
      setErr("送信に失敗しました。もう一度お試しください。");
      return;
    }

    // Step 2: draft クリア
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY_5000);
    }

    // Step 3: NOWPayments invoice 作成
    const applyId = draft.applyId;
    const payRes = await fetch("/api/5000/nowpayments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply_id: applyId, plan: draft.plan }),
    });
    const payData = await payRes.json();

    if (!payData?.ok || !payData?.invoice_url) {
      setErr("決済リンクの取得に失敗しました。サポートにお問い合わせください。");
      return;
    }

    // Step 4: apply_id を sessionStorage に保存してリダイレクト
    if (typeof window !== "undefined") {
      sessionStorage.setItem("5000_apply_id", applyId);
    }
    window.location.href = payData.invoice_url;
  } catch {
    setErr("送信に失敗しました。通信状況をご確認ください。");
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 2: 申請ボタンのラベルを変更する（申請する → 申請して決済へ進む）**

```tsx
{loading ? "処理中…" : "申請して決済へ進む →"}
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: 画面遷移の手動確認（dev server で）**

1. `npm run dev` でサーバー起動
2. `/5000/apply` でフォームを入力
3. 確認画面で「申請して決済へ進む」をタップ
4. NOWPayments のページ（またはエラー）が表示されることを確認

- [ ] **Step 5: コミット**

```bash
git add app/5000/confirm/page.tsx
git commit -m "feat: /5000/confirm に決済ステップ追加（apply→invoice_url→リダイレクト）"
```

---

## Task 9: `/5000/purchase-status/page.tsx` 新規作成

**Files:**
- Create: `app/5000/purchase-status/page.tsx`

**仕様:**
- URL param または sessionStorage から `apply_id` を取得
- 5秒ポーリングで `/api/5000/purchase-status?apply_id=xxx` を叩く
- ステータスに応じたメッセージを表示
- `approved` かつ `mail_sent === false` → 「メールを再送する」ボタン
- `approved` または `pending_error` でポーリング停止

- [ ] **Step 1: `/5000/purchase-status/page.tsx` を作成する**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const POLL_INTERVAL_MS = 5000;

type StatusData = {
  ok: boolean;
  apply_id?: string;
  status?: string;
  payment_status?: string;
  plan?: string;
  mail_sent?: boolean;
  error?: string;
};

const STATUS_MESSAGES: Record<string, { title: string; body: string; done: boolean }> = {
  pending_payment:    { title: "申込受付済み",     body: "支払いをお待ちしています。外部アプリからお振り込みください。",   done: false },
  payment_waiting:    { title: "入金確認中",       body: "入金の到着を待っています。ページを閉じても処理は継続されます。", done: false },
  payment_confirming: { title: "入金確認中",       body: "ブロックチェーンの承認を確認しています。しばらくお待ちください。", done: false },
  payment_confirmed:  { title: "承認処理中",       body: "入金を確認しました。承認処理を行っています。",                 done: false },
  approved:           { title: "承認完了",         body: "認証メールをご登録のメールアドレスにお送りしました。",          done: true  },
  manual_review:      { title: "手動確認が必要です", body: "サポートチームが確認します。ご連絡をお待ちください。",          done: true  },
  pending_error:      { title: "エラーが発生しました", body: "サポートへご連絡ください。",                                done: true  },
};

export default function PurchaseStatusPage() {
  const searchParams = useSearchParams();
  const [applyId, setApplyId] = useState<string>("");
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // apply_id は URL param → sessionStorage の順で取得
    const paramId = searchParams.get("apply_id") ?? "";
    const stored = typeof window !== "undefined"
      ? sessionStorage.getItem("5000_apply_id") ?? ""
      : "";
    const id = paramId || stored;
    setApplyId(id);
  }, [searchParams]);

  async function fetchStatus(id: string) {
    if (!id) return;
    try {
      const res = await fetch(
        `/api/5000/purchase-status?apply_id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      const data: StatusData = await res.json();
      setStatusData(data);
      return data;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!applyId) return;

    let stopped = false;

    async function poll() {
      const data = await fetchStatus(applyId);
      if (stopped) return;
      const info = STATUS_MESSAGES[data?.status ?? ""];
      if (info?.done) return; // ポーリング停止
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      stopped = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [applyId]);

  async function handleResend() {
    if (!applyId) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/5000/reset/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply_id: applyId }),
      });
      const data = await res.json();
      if (data?.ok) {
        setResendMsg("メールを再送しました。届かない場合はサポートへご連絡ください。");
      } else {
        setResendMsg("再送に失敗しました: " + (data?.error ?? "unknown error"));
      }
    } catch {
      setResendMsg("通信エラーが発生しました。");
    } finally {
      setResending(false);
    }
  }

  const status = statusData?.status ?? "";
  const info = STATUS_MESSAGES[status] ?? null;
  const showResend = status === "approved" && statusData?.mail_sent === false;

  const accentColor = info?.done ? (status === "approved" ? "#00D4FF" : "#ff8080") : "#6C63FF";

  if (!applyId) {
    return (
      <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          apply_id が見つかりません。申込ページからやり直してください。
        </p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      {/* 背景グロー */}
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0,
        background: [
          "radial-gradient(ellipse 700px 500px at 5% 0%, rgba(108,99,255,0.08) 0%, transparent 60%)",
          "radial-gradient(ellipse 600px 400px at 100% 20%, rgba(0,212,255,0.06) 0%, transparent 60%)",
        ].join(","),
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 440, width: "100%", textAlign: "center" }}>
        {/* アイコン */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
          background: `linear-gradient(135deg, #6C63FF, ${accentColor})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, boxShadow: `0 0 40px rgba(108,99,255,0.4)`,
        }}>
          {status === "approved" ? "✓" : info?.done ? "!" : "…"}
        </div>

        {/* タイトル */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
          {info ? info.title : (statusData ? "確認中…" : "読み込み中…")}
        </h1>

        {/* 本文 */}
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, margin: "0 0 24px" }}>
          {info ? info.body : "現在の状況を確認しています。しばらくお待ちください。"}
        </p>

        {/* ポーリング中インジケーター */}
        {!info?.done && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: "0 0 24px" }}>
            5秒ごとに自動更新中…
          </p>
        )}

        {/* メール再送ボタン */}
        {showResend && (
          <button
            onClick={handleResend}
            disabled={resending}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: resending ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #6C63FF, #00D4FF)",
              color: resending ? "rgba(255,255,255,0.3)" : "#fff",
              fontSize: 14, fontWeight: 800, cursor: resending ? "not-allowed" : "pointer",
              marginBottom: 12,
            }}
          >
            {resending ? "送信中…" : "認証メールを再送する"}
          </button>
        )}

        {/* 再送結果メッセージ */}
        {resendMsg && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>{resendMsg}</p>
        )}

        {/* apply_id 表示（サポート問い合わせ用）*/}
        {applyId && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 32 }}>
            申込ID: {applyId}
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

期待出力: エラーなし。`/5000/purchase-status` がページとして表示される。

- [ ] **Step 3: 手動確認（dev server）**

```bash
npm run dev &
sleep 8
# ブラウザで http://localhost:3000/5000/purchase-status?apply_id=5000_1774710389836 を開く
# → "承認完了" メッセージが表示されることを確認
```

- [ ] **Step 4: コミット**

```bash
git add app/5000/purchase-status/page.tsx
git commit -m "feat: /5000/purchase-status ページ新規作成（ポーリング・ステータス表示・メール再送）"
```

---

## セルフレビュー

### スペックカバレッジ確認

| 要件 | 対応タスク |
|---|---|
| フォーム→決済フロー | Task 1, 8 |
| apply_5000 に expected_paid・pending_payment | Task 2 |
| NOWPayments invoice 作成（/5000専用） | Task 5 |
| IPN 受信・署名検証 | Task 6 |
| GAS payment_update_5000（状態遷移・自動承認） | Task 4 |
| approveRowCore5000_（共有承認関数） | Task 3 |
| /5000/admin 手動承認との両立 | Task 3（admin_approve_5000 リファクタ） |
| 購入状況確認ページ（ポーリング） | Task 7, 9 |
| メール再送 | Task 4, 7, 9 |
| 冪等性（approved_at ガード） | Task 3 |
| 既存 LIFAI フロー無変更 | 全タスク（既存ルートは変更なし） |

### 型一貫性確認

- `Draft5000.plan: string` → Task 1 で apply/page.tsx・confirm/page.tsx 両方に追加済み
- `approveRowCore5000_` の引数 `(ss5000, applySheet, header, idx, rowIndex, reason)` → Task 3 で定義、Task 4 の `payment_update_5000` から同じシグネチャで呼び出し
- `get_apply_status_5000` のレスポンス: `{ ok, apply_id, status, payment_status, plan, mail_sent }` → Task 4 で定義、Task 5 で参照（plan 取得）、Task 7 で API ルートが転送
