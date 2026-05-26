# Square Webhook BP自動付与 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Square クレジットカード決済完了時に、aisalon（lifai.vercel.app）と LIFAIOV（lifaiov.vercel.app）の両方で BP を自動付与する。

**Architecture:**
- ユーザーが「購入する」クリック時、フロントが `user_id`（localStorage の `addval_auth_v1.id`）を取得し、`/api/square/create-checkout` を呼び出す
- Next.js が Square Checkout Link API で `reference_id = "{user_id}:{pack_id}:{bp_amount}"` を埋め込んだ動的チェックアウトURLを生成 → ユーザーを Square 決済ページへリダイレクト
- Square 決済完了 → `/api/square/webhook` に `payment.updated` (status: COMPLETED) が届く → HMAC-SHA256 署名検証 → Square Orders API で `reference_id` 取得 → GAS `square_grant_bp` 呼び出し → BP付与
- music-boost は BP付与なし（bp_amount: 0）→ Webhook でログ記録のみ、管理者手動対応

**Tech Stack:**
- Square Checkout Link API (`POST /v2/online-checkout/payment-links`)
- Square Orders API (`GET /v2/orders/{order_id}`) — reference_id取得用
- Next.js App Router Route Handlers (`export const runtime = "nodejs"`)
- GAS: 新action `square_grant_bp`（`wallet_ledger` へ書き込み、冪等性は `square_payment_id` でチェック）
- 既存パターン踏襲: `app/api/nowpayments/ipn/route.ts`（HMAC検証・GAS呼び出し構造を流用）

---

## 現状整理

| 項目 | aisalon (lifai.vercel.app) | LIFAIOV (lifaiov.vercel.app) |
|---|---|---|
| Square APP | 共有（同一Squareアカウント） | 共有（同一Squareアカウント） |
| square.link URL | 両リポジトリで同一のURLを使用 | 同上 |
| GAS バックエンド | 同一 GAS_WEBAPP_URL | 同一 GAS_WEBAPP_URL |
| `SQUARE_ACCESS_TOKEN` | ✅ .env.localに存在 | ❌ 未設定 |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | ✅ .env.localに存在（lifai用） | ❌ 未設定（新規登録後に取得） |
| `SQUARE_LOCATION_ID` | ❌ 未設定 | ❌ 未設定 |
| Webhook登録 | ✅ lifai.vercel.app/api/square/webhook（docs/square.mdに記録済み） | ❌ **Square には登録しない**（コードのみデプロイ・二重配信防止のため） |

---

## ファイル構成

### 新規作成

```
aisalon/
  app/api/square/
    create-checkout/route.ts   動的チェックアウトURL生成API
    webhook/route.ts           Webhook受信・署名検証・GAS呼び出し

LIFAIOV/
  app/api/square/
    create-checkout/route.ts   aisalonと同一（差分なし・NEXT_PUBLIC_SITE_URLから読む）
    webhook/route.ts           aisalonと同一（NOTIFICATION_URLのみ差分）
                               ⚠️ Square Dashboard には登録しない（二重配信防止）
                               コードとしてデプロイし、ローカルテスト時のみ使用
```

### 修正

```
aisalon/
  app/membership/page.tsx      "購入する" <a> → API呼び出し <button>
  app/music-boost/page.tsx     クレジットカード <a> → API呼び出し <button>
  .env.local                   SQUARE_LOCATION_ID 追加

LIFAIOV/
  app/membership/page.tsx      同上
  app/music-boost/page.tsx     同上
  .env.local                   Square認証情報3件を追加
                               NEXT_PUBLIC_SITE_URL を lifaiov.vercel.app に修正
```

### GAS（手動編集）

```
GAS スクリプト
  square_grant_bp_ 関数追加    既存 approved ユーザーへの BP付与 + wallet_ledger記録
  doPost 振り分け追加           case "square_grant_bp"
```

---

## Task 0: 事前準備（手動作業・実装前に完了すること）

**Files:** なし（ダッシュボード操作・環境変数設定のみ）

- [ ] **Step 1: Square Location ID を取得**

  Square Dashboard → Locations → 使用中のロケーションを開く → Location ID をコピー

- [ ] **Step 2: aisalon の .env.local に追加**

  `C:\Users\unite\aisalon\.env.local` を開き、末尾に追加:
  ```
  SQUARE_LOCATION_ID=<取得したLocation ID>
  ```

- [ ] **Step 3: Vercel（lifai）に環境変数を追加**

  Vercel Dashboard → lifai プロジェクト → Settings → Environment Variables
  以下3件を Production / Preview / Development すべてに追加:
  ```
  SQUARE_ACCESS_TOKEN    = EAAAl82d0qU9Jpb9T8yfyskP1S-6FFXse8aLfEHgYtl0fYh8tdjHLXjciwrRirax
  SQUARE_WEBHOOK_SIGNATURE_KEY = 5UGnK5qZNF9_wo79SZnsiA
  SQUARE_LOCATION_ID     = <取得した値>
  ```

- [ ] **Step 4: LIFAIOV の .env.local に追加**

  > ⚠️ LIFAIOV の webhook は Square に登録しない（二重配信防止）。
  > `SQUARE_WEBHOOK_SIGNATURE_KEY` はローカルテスト用として aisalon と同じ値を使う。

  `C:\Users\unite\LIFAIOV\.env.local` を開き:
  ```
  # 既存の NEXT_PUBLIC_SITE_URL を修正（lifai → lifaiov）
  NEXT_PUBLIC_SITE_URL=https://lifaiov.vercel.app

  # Square 認証情報を追加（末尾に）
  SQUARE_ACCESS_TOKEN=EAAAl82d0qU9Jpb9T8yfyskP1S-6FFXse8aLfEHgYtl0fYh8tdjHLXjciwrRirax
  SQUARE_WEBHOOK_SIGNATURE_KEY=5UGnK5qZNF9_wo79SZnsiA  ← aisalonと同じ値
  SQUARE_LOCATION_ID=<aisalonと同じ値>
  ```

- [ ] **Step 5: Vercel（lifaiov）に環境変数を追加**

  Vercel Dashboard → lifaiov プロジェクト → Settings → Environment Variables
  以下4件を追加:
  ```
  NEXT_PUBLIC_SITE_URL          = https://lifaiov.vercel.app
  SQUARE_ACCESS_TOKEN           = EAAAl82d0qU9Jpb9T8yfyskP1S-6FFXse8aLfEHgYtl0fYh8tdjHLXjciwrRirax
  SQUARE_WEBHOOK_SIGNATURE_KEY  = 5UGnK5qZNF9_wo79SZnsiA  ← aisalonと同じ値
  SQUARE_LOCATION_ID            = <取得した値>
  ```

---

## Task 1: GAS に `square_grant_bp` action を追加（手動作業）

**Files:** GAS スクリプトエディタ（ブラウザ上で編集）

> ⚠️ GAS は直接コードを触れないため、必ずスクリプトエディタで追加・デプロイする。
> 既存の `doPost` 関数の switch 文に case を1行追加するだけ。関数本体は末尾に追加。

- [ ] **Step 1: GAS スクリプトエディタを開く**

  `GAS_WEBAPP_URL` から該当のスクリプトプロジェクトを開く

- [ ] **Step 2: `squareGrantBp_` と `squareFindUserAndGrant_` 関数を末尾に追加**

  > ⚠️ GASの実態に合わせた以下の点を修正済み:
  > 1. BP列名は `bp_balance`（古いシートは `bp` にフォールバック）
  > 2. wallet_ledger への書き込みは既存の `appendWalletLedger_()` を流用
  > 3. メインシート → 5000シート（SPREADSHEET_5000_ID）の順で検索
  > 4. 冪等性チェックは wallet_ledger の memo列（index 5）を見る

  ```javascript
  // === square_grant_bp ===
  // Square決済完了時に既存承認ユーザーへBPを付与する
  // Input: { user_id, bp_amount, square_payment_id, pack_id }
  // Output: { ok, result } or { ok: false, error }
  function squareGrantBp_(params) {
    var userId     = str_(params.user_id);
    var bpAmount   = Number(params.bp_amount || 0);
    var paymentId  = str_(params.square_payment_id);
    var packId     = str_(params.pack_id || "");

    if (!userId || !bpAmount || !paymentId) {
      return { ok: false, error: "missing_params" };
    }

    // --- 冪等性チェック: wallet_ledger の memo列（index 5）で square_payment_id を検索 ---
    // appendWalletLedger_ の列構成: [ts, kind, login_id, email, amount, memo]
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ledger = ss.getSheetByName("wallet_ledger");
    if (ledger) {
      var ledgerData = ledger.getDataRange().getValues();
      for (var i = 1; i < ledgerData.length; i++) {
        var memo = String(ledgerData[i][5] || ""); // F列 index5: memo
        if (memo.indexOf("square_payment_id:" + paymentId) !== -1) {
          return { ok: true, result: "already_granted", skipped: true };
        }
      }
    }

    // --- メインシートを検索 ---
    var mainSheet = ss.getSheetByName("applies");
    var result = squareFindUserAndGrant_(mainSheet, userId, bpAmount, paymentId, packId);
    if (result) return result;

    // --- 見つからなければ5000シートも検索 ---
    var ssId5000 = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_5000_ID");
    if (ssId5000) {
      var sheet5000 = SpreadsheetApp.openById(ssId5000).getSheetByName("applies");
      var result5000 = squareFindUserAndGrant_(sheet5000, userId, bpAmount, paymentId, packId);
      if (result5000) return result5000;
    }

    return { ok: false, error: "user_not_found", user_id: userId };
  }

  // ユーザーを指定シートで検索してBP付与するヘルパー
  function squareFindUserAndGrant_(sheet, userId, bpAmount, paymentId, packId) {
    if (!sheet) return null;

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];

    // ヘッダー名からインデックスを動的に取得
    var loginIdCol = -1, bpCol = -1, emailCol = -1;
    for (var h = 0; h < headers.length; h++) {
      var col = String(headers[h]);
      if (col === "login_id")   loginIdCol = h;
      if (col === "bp_balance") bpCol = h;       // 新形式
      if (col === "email")      emailCol = h;
    }
    // フォールバック：古いシートで "bp" 列が使われている場合
    if (bpCol === -1) {
      for (var h2 = 0; h2 < headers.length; h2++) {
        if (String(headers[h2]) === "bp") { bpCol = h2; break; }
      }
    }
    if (loginIdCol === -1 || bpCol === -1) return null;

    // login_id で検索
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][loginIdCol]) !== String(userId)) continue;

      var userRow    = r + 1; // 1-indexed
      var currentBp  = Number(data[r][bpCol]) || 0;
      var hitEmail   = emailCol !== -1 ? String(data[r][emailCol] || "") : "";
      var newBp      = currentBp + bpAmount;

      // BP付与（シートに書き込み）
      sheet.getRange(userRow, bpCol + 1).setValue(newBp);

      // wallet_ledger に記録（既存の appendWalletLedger_ を流用）
      appendWalletLedger_({
        kind:     "square_bp_purchase",
        login_id: userId,
        email:    hitEmail,
        amount:   bpAmount,
        memo:     "pack:" + packId + " square_payment_id:" + paymentId,
      });

      return { ok: true, result: "granted", bp_granted: bpAmount, new_total: newBp };
    }

    return null; // このシートにはいなかった
  }
  ```

- [ ] **Step 3: `doPost` の switch 文に case を追加**

  既存の `switch (action)` ブロック内（他の case の直前）に:
  ```javascript
  case "square_grant_bp":
    result = squareGrantBp_(body);
    break;
  ```

- [ ] **Step 4: GAS エディタ上でテスト実行**

  GAS エディタ → 実行 → 関数を選択して実行:
  ```javascript
  // テスト用に一時的に追加（確認後削除）
  function testSquareGrantBp() {
    var r = squareGrantBp_({
      user_id: "demo",          // applies シートに存在する login_id
      bp_amount: 100,
      square_payment_id: "TEST_PMT_" + Date.now(),
      pack_id: "s"
    });
    Logger.log(JSON.stringify(r));
  }
  ```
  期待結果（ログ）: `{"ok":true,"result":"granted","bp_granted":100,"new_total":xxx}`

  同じ `square_payment_id` で再実行:
  期待結果: `{"ok":true,"result":"already_granted","skipped":true}`

- [ ] **Step 5: GAS を再デプロイ**

  Deploy → Manage Deployments → 鉛筆アイコン → Version: New version → Deploy

  ⚠️ 既存の Deployment URL は変わらない（URLは固定）。新バージョンを選ぶだけでOK。

---

## Task 2: aisalon — Square Checkout 動的URL生成 API

**Files:**
- Create: `app/api/square/create-checkout/route.ts`

- [ ] **Step 1: ファイルを作成**

  `C:\Users\unite\aisalon\app\api\square\create-checkout\route.ts` を作成:

  ```typescript
  // app/api/square/create-checkout/route.ts
  import { NextResponse } from "next/server";

  export const runtime = "nodejs";

  export async function POST(req: Request) {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lifai.vercel.app";

    if (!token || !locationId) {
      console.error("[Square Checkout] missing env", { token: !!token, locationId: !!locationId });
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const { user_id, pack_id, bp_amount, price_cents, label, redirect_path } = body;

    if (!user_id || !pack_id || bp_amount === undefined || !price_cents) {
      return NextResponse.json(
        { ok: false, error: "missing_params", need: ["user_id", "pack_id", "bp_amount", "price_cents"] },
        { status: 400 }
      );
    }

    // reference_id にユーザー情報を埋め込む（Webhook 受信時に使用）
    // format: "{user_id}:{pack_id}:{bp_amount}"
    const referenceId = `${user_id}:${pack_id}:${bp_amount}`;
    const idempotencyKey = `${user_id}-${pack_id}-${Date.now()}`;

    // redirect_path を呼び出し元から受け取る（省略時は /membership）
    // membership → "/membership"  /  music-boost → "/music-boost"
    const redirectPath = typeof redirect_path === "string" && redirect_path.startsWith("/")
      ? redirect_path
      : "/membership";

    const squareBody = {
      idempotency_key: idempotencyKey,
      order: {
        location_id: locationId,
        reference_id: referenceId,
        line_items: [
          {
            name: label ?? `BPパック (${String(pack_id).toUpperCase()})`,
            quantity: "1",
            base_price_money: {
              amount: Number(price_cents),
              currency: "USD",
            },
          },
        ],
      },
      checkout_options: {
        redirect_url: `${siteUrl}${redirectPath}?purchase=success`,
      },
    };

    console.log("[Square Checkout] creating link for", { user_id, pack_id, bp_amount, price_cents });

    try {
      const res = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Square-Version": "2024-11-20",
        },
        body: JSON.stringify(squareBody),
      });

      const data = await res.json();
      console.log("[Square Checkout] Square API status", res.status, JSON.stringify(data).slice(0, 300));

      if (!res.ok || !data.payment_link?.url) {
        return NextResponse.json(
          { ok: false, error: "square_api_error", status: res.status, detail: data },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        checkout_url: data.payment_link.url,
      });
    } catch (e: any) {
      console.error("[Square Checkout] fetch error", e);
      return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: ローカル動作確認**

  `npm run dev` を起動し、別ターミナルで:
  ```powershell
  Invoke-RestMethod -Uri "http://localhost:3000/api/square/create-checkout" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"user_id":"demo","pack_id":"s","bp_amount":500,"price_cents":750,"label":"Sパック"}'
  ```
  期待結果: `{ ok: true, checkout_url: "https://checkout.square.site/..." }`

  ※ `SQUARE_LOCATION_ID` が未設定の場合: `{ ok: false, error: "missing_env" }` → Task 0 Step 2を先に完了すること

- [ ] **Step 3: Commit**

  ```powershell
  git add app/api/square/create-checkout/route.ts
  git commit -m "feat(aisalon): add Square create-checkout API"
  ```

---

## Task 3: aisalon — Square Webhook エンドポイント

**Files:**
- Create: `app/api/square/webhook/route.ts`

**Square の署名検証方式（NOWPayments と異なる点に注意）:**
```
HMAC-SHA256(key=SQUARE_WEBHOOK_SIGNATURE_KEY, data=NotificationURL + rawBody)
→ Base64 エンコード
→ x-square-hmacsha256-signature ヘッダと比較
```

- [ ] **Step 1: ファイルを作成**

  `C:\Users\unite\aisalon\app\api\square\webhook\route.ts` を作成:

  ```typescript
  // app/api/square/webhook/route.ts
  import { NextResponse } from "next/server";
  import * as crypto from "crypto";

  export const runtime = "nodejs";

  // Square の署名検証は「通知URL + rawBody」のHMACなので、
  // この URL は Square Dashboard に登録した Notification URL と完全一致が必要
  const NOTIFICATION_URL = "https://lifai.vercel.app/api/square/webhook";

  function verifySquareSig(rawBody: string, sigHeader: string | null, sigKey: string): boolean {
    if (!sigHeader) return false;
    try {
      const hmac = crypto.createHmac("sha256", sigKey);
      hmac.update(NOTIFICATION_URL + rawBody);
      const expected = hmac.digest("base64");
      // タイミング攻撃対策: timingSafeEqual を使う
      const a = Buffer.from(expected, "base64");
      const b = Buffer.from(sigHeader, "base64");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  export async function GET() {
    return NextResponse.json({ ok: true, hint: "POST webhook only" });
  }

  export async function POST(req: Request) {
    const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;

    const raw = await req.text();
    const sig = req.headers.get("x-square-hmacsha256-signature");

    // テスト用バイパス（本番では x-test-square: 1 ヘッダが来ても NODE_ENV=production なので無効）
    const isTest = process.env.NODE_ENV !== "production" && req.headers.get("x-test-square") === "1";

    console.log("[Square Webhook] hit", new Date().toISOString());
    console.log("[Square Webhook] isTest", isTest, "raw", raw.slice(0, 200));

    // 署名検証
    if (sigKey && !isTest) {
      const ok = verifySquareSig(raw, sig, sigKey);
      console.log("[Square Webhook] sig_ok", ok);
      if (!ok) {
        console.warn("[Square Webhook] bad signature");
        return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
      }
    } else {
      console.log("[Square Webhook] signature skipped (test or no key)");
    }

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const eventType = payload?.type as string | undefined;
    console.log("[Square Webhook] eventType", eventType);

    // payment.updated 以外は無視して 200 を返す（Square がリトライしないように常に 200）
    if (eventType !== "payment.updated") {
      return NextResponse.json({ ok: true, skipped: true, reason: "not_payment_updated" });
    }

    const payment = payload?.data?.object?.payment;
    const status = payment?.status as string | undefined;

    // COMPLETED 以外は無視
    if (status !== "COMPLETED") {
      console.log("[Square Webhook] payment not completed, status:", status);
      return NextResponse.json({ ok: true, skipped: true, reason: `status_${status}` });
    }

    const paymentId = payment?.id as string | undefined;
    const orderId = payment?.order_id as string | undefined;
    const amountCents = payment?.amount_money?.amount as number | undefined;

    console.log("[Square Webhook] COMPLETED paymentId", paymentId, "orderId", orderId, "cents", amountCents);

    if (!paymentId || !orderId) {
      console.warn("[Square Webhook] missing ids");
      return NextResponse.json({ ok: false, error: "missing_ids" }, { status: 400 });
    }

    // Square Orders API で reference_id を取得
    // reference_id = "{user_id}:{pack_id}:{bp_amount}" が埋め込まれている
    let referenceId: string | null = null;
    if (accessToken) {
      try {
        const orderRes = await fetch(`https://connect.squareup.com/v2/orders/${orderId}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Square-Version": "2024-11-20",
          },
        });
        const orderData = await orderRes.json();
        referenceId = orderData?.order?.reference_id ?? null;
        console.log("[Square Webhook] referenceId", referenceId);
      } catch (e) {
        console.error("[Square Webhook] order fetch failed", e);
      }
    }

    if (!referenceId) {
      // reference_id がない = create-checkout 経由でない（古い square.link からの決済）
      // ログを残して 200 で返す（Square へのリトライを防ぐ）
      console.warn("[Square Webhook] referenceId missing - skipping BP grant");
      return NextResponse.json({ ok: true, warning: "no_reference_id" });
    }

    // reference_id を分解: "user_id:pack_id:bp_amount"
    const parts = referenceId.split(":");
    if (parts.length < 3) {
      console.warn("[Square Webhook] invalid referenceId format", referenceId);
      return NextResponse.json({ ok: true, warning: "invalid_reference_id_format" });
    }

    const userId = parts[0];
    const packId = parts[1];
    const bpAmount = Number(parts[2]);

    console.log("[Square Webhook] parsed", { userId, packId, bpAmount });

    // bp_amount === 0 は music-boost 注文（BP付与なし）
    if (bpAmount === 0) {
      console.log("[Square Webhook] music-boost order received, pack_id:", packId);
      // TODO Phase 2: 管理者通知メール等
      return NextResponse.json({ ok: true, type: "music_boost_order", pack_id: packId });
    }

    if (!userId || !packId || isNaN(bpAmount) || bpAmount < 0) {
      console.warn("[Square Webhook] referenceId parse failed", { userId, packId, bpAmount });
      return NextResponse.json({ ok: true, warning: "reference_id_parse_failed" });
    }

    // GAS square_grant_bp を呼び出し
    if (gasUrl && gasKey) {
      const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            action: "square_grant_bp",
            user_id: userId,
            bp_amount: bpAmount,
            square_payment_id: paymentId,
            pack_id: packId,
            note: `amount_cents:${amountCents} order_id:${orderId}`,
            isTest,
          }),
        });
        const text = await r.text();
        console.log("[Square Webhook] GAS status", r.status, "body", text.slice(0, 300));
      } catch (e) {
        console.error("[Square Webhook] GAS call failed", e);
        // GAS 失敗でも 200 を返す（Square のリトライを防ぐ）
      }
    } else {
      console.warn("[Square Webhook] GAS skipped - missing env", { gasUrl: !!gasUrl, gasKey: !!gasKey });
    }

    return NextResponse.json({ ok: true, isTest });
  }
  ```

- [ ] **Step 2: ローカルテスト（署名バイパス）**

  ```powershell
  # npm run dev が起動済みの状態で実行
  Invoke-RestMethod -Uri "http://localhost:3000/api/square/webhook" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "x-test-square" = "1" } `
    -Body '{"type":"payment.updated","data":{"object":{"payment":{"id":"TEST_PMT_001","order_id":"TEST_ORD_001","status":"COMPLETED","amount_money":{"amount":750,"currency":"USD"}}}}}'
  ```
  期待結果: `{ ok: true, warning: "no_reference_id" }`
  （ローカルからは Square Orders API 呼び出しが成功するが、テスト用 order_id なので reference_id は null になる）

- [ ] **Step 3: GET でヘルスチェック確認**

  ```powershell
  Invoke-RestMethod -Uri "http://localhost:3000/api/square/webhook"
  ```
  期待結果: `{ ok: true, hint: "POST webhook only" }`

- [ ] **Step 4: Commit**

  ```powershell
  git add app/api/square/webhook/route.ts
  git commit -m "feat(aisalon): add Square webhook handler with HMAC verification"
  ```

---

## Task 4: aisalon — membership/page.tsx の更新

**Files:**
- Modify: `app/membership/page.tsx`

**変更方針:** 既存の `<a href={pack.squareUrl}>` を `<button>` に置き換える。
`squareUrl` プロパティは削除せず残す（フォールバック用・静的リンクの参照記録として保持）。
`busy` state と `msg` state は既存のものをそのまま使う。

- [ ] **Step 1: `handleSquarePurchase` 関数を追加**

  既存の `handlePurchase` 関数の直後（`const totalBp = ...` の前）に以下を追加:

  ```tsx
  const handleSquarePurchase = async (pack: typeof BP_PACKS[0]) => {
    if (!userId) {
      setMsg("ログインしてから購入してください");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/square/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          pack_id: pack.id,
          bp_amount: pack.bp,
          price_cents: Math.round(pack.price * 100), // $7.5 → 750 cents
          label: `${pack.label}パック - ${pack.bp.toLocaleString()}BP`,
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) {
        setMsg("決済ページの準備に失敗しました。時間をおいて再試行してください。");
        console.error("[membership] create-checkout failed", data);
        return;
      }
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("[membership] create-checkout error", e);
      setMsg("エラーが発生しました。再試行してください。");
    } finally {
      setBusy(false);
    }
  };
  ```

- [ ] **Step 2: 購入ボタンを `<a>` から `<button>` に変更**

  変更対象（`app/membership/page.tsx` の `{BP_PACKS.map(...)` 内）:

  ```tsx
  // 変更前
  <a
    href={pack.squareUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-2 inline-block px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold hover:scale-105 transition text-white">
    購入する
  </a>

  // 変更後
  <button
    onClick={() => handleSquarePurchase(pack)}
    disabled={busy}
    className="mt-2 inline-block px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold hover:scale-105 transition text-white disabled:opacity-60 disabled:cursor-not-allowed">
    {busy ? "準備中…" : "購入する"}
  </button>
  ```

- [ ] **Step 3: ローカルで動作確認**

  `npm run dev` → `http://localhost:3000/membership` を開く
  - ログイン前: ボタンをクリック → `msg` 欄に "ログインしてから購入してください" が表示されること
  - ログイン後（localStorage に `addval_auth_v1` がある状態）: ボタンクリック → 「準備中…」表示 → 新しいタブで Square 決済ページが開くこと（`SQUARE_LOCATION_ID` が設定済みの場合）

- [ ] **Step 4: Commit**

  ```powershell
  git add app/membership/page.tsx
  git commit -m "feat(aisalon): membership - use dynamic Square checkout for BP packs"
  ```

---

## Task 5: aisalon — music-boost/page.tsx の更新

**Files:**
- Modify: `app/music-boost/page.tsx`

**変更方針:** music-boost は BP 付与なし（`bp_amount: 0`）。Webhook 側でログ記録のみ行い、
管理者が手動で対応する（フォールバック用の `squareUrl` は残す）。

- [ ] **Step 1: `userId` / `busy` / `msg` state の存在を確認（追加不要）**

  両リポジトリとも `music-boost/page.tsx:101-104` に既に宣言済みであることを確認する:
  ```tsx
  const [userId, setUserId] = useState("");   // 101行目
  const [busy, setBusy]     = useState(false); // 103行目
  const [msg, setMsg]       = useState("");    // 104行目
  ```
  localStorage からの読み込み useEffect も既存のものがある（追加不要）。

- [ ] **Step 2: `handleMusicBoostCheckout` 関数を追加**

  既存 state 宣言の後（`return (` の前）に追加:

  ```tsx
  const handleMusicBoostCheckout = async (plan: typeof PLANS[0]) => {
    if (!userId) {
      alert("ログインしてから購入してください");
      return;
    }
    const packId = `music_boost_${plan.id}`;
    try {
      const res = await fetch("/api/square/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          pack_id: packId,
          bp_amount: 0, // music-boost は BP付与なし（Webhook側で分岐）
          price_cents: Math.round(plan.price * 100),
          label: `Music Boost ${plan.label} (${plan.percent}% / ${plan.slots}枠)`,
          redirect_path: "/music-boost", // 決済後に music-boost ページへ戻る
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) {
        alert("決済ページの準備に失敗しました。時間をおいて再試行してください。");
        return;
      }
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    } catch {
      alert("エラーが発生しました。再試行してください。");
    }
  };
  ```

- [ ] **Step 3: クレジットカード購入ボタンを `<button>` に変更**

  `{/* クレジットカード（Square） */}` セクションの `<a href={plan.squareUrl} ...>` を以下に変更:

  ```tsx
  {/* クレジットカード（Square） */}
  <button
    onClick={() => handleMusicBoostCheckout(plan)}
    className="w-full py-2 rounded-lg text-sm font-bold border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition text-white/80"
  >
    💳 クレジットカードで購入
  </button>
  ```

- [ ] **Step 4: ローカルで動作確認**

  `http://localhost:3000/music-boost` を開く
  - ログイン後: 「💳 クレジットカードで購入」クリック → Square 決済ページが新タブで開くこと

- [ ] **Step 5: Commit**

  ```powershell
  git add app/music-boost/page.tsx
  git commit -m "feat(aisalon): music-boost - use dynamic Square checkout"
  ```

---

## Task 6: LIFAIOV — 同一実装のコピー

**Files:**
- Create: `C:\Users\unite\LIFAIOV\app\api\square\create-checkout\route.ts`
- Create: `C:\Users\unite\LIFAIOV\app\api\square\webhook\route.ts`
- Modify: `C:\Users\unite\LIFAIOV\app\membership\page.tsx`
- Modify: `C:\Users\unite\LIFAIOV\app\music-boost\page.tsx`

**aisalon との差分（1点のみ）:**
| ファイル | aisalon | LIFAIOV |
|---|---|---|
| `webhook/route.ts` | `NOTIFICATION_URL = "https://lifai.vercel.app/..."` | `NOTIFICATION_URL = "https://lifaiov.vercel.app/..."` |
| `create-checkout/route.ts` | 変更なし | 変更なし（`NEXT_PUBLIC_SITE_URL` env で自動的に lifaiov になる） |

> ⚠️ **LIFAIOV の webhook は Square Dashboard に登録しない。**  
> Square は同一アカウントの全決済を全サブスクリプションに配信するため、  
> 両方登録すると1回の決済でGASに2回 `square_grant_bp` が呼ばれる（二重付与リスク）。  
> aisalon の webhook 1本で、aisalon/LIFAIOV 両ユーザーの BP付与を一元処理する。  
> GAS バックエンドは共有のため、どちらの app から呼んでも同じシートにアクセスできる。

- [ ] **Step 1: LIFAIOV に `app/api/square/` ディレクトリを作成**

  ```powershell
  New-Item -ItemType Directory -Force "C:\Users\unite\LIFAIOV\app\api\square\create-checkout"
  New-Item -ItemType Directory -Force "C:\Users\unite\LIFAIOV\app\api\square\webhook"
  ```

- [ ] **Step 2: `create-checkout/route.ts` をコピー**

  `C:\Users\unite\aisalon\app\api\square\create-checkout\route.ts` の内容を
  `C:\Users\unite\LIFAIOV\app\api\square\create-checkout\route.ts` に**そのまま**コピー
  （差分なし。`siteUrl` は `NEXT_PUBLIC_SITE_URL` から読むため）

- [ ] **Step 3: `webhook/route.ts` をコピーして NOTIFICATION_URL を変更**

  aisalon の `webhook/route.ts` をベースに、以下の1行だけ変更して LIFAIOV に作成:

  ```typescript
  // 変更前（aisalon）
  const NOTIFICATION_URL = "https://lifai.vercel.app/api/square/webhook";

  // 変更後（LIFAIOV）
  const NOTIFICATION_URL = "https://lifaiov.vercel.app/api/square/webhook";
  ```

- [ ] **Step 4: LIFAIOV の membership/page.tsx を同様に修正**

  Task 4 の Step 1・Step 2 と同じ変更を `C:\Users\unite\LIFAIOV\app\membership\page.tsx` に適用

- [ ] **Step 5: LIFAIOV の music-boost/page.tsx を同様に修正**

  Task 5 の Step 1〜Step 3 と同じ変更を `C:\Users\unite\LIFAIOV\app\music-boost\page.tsx` に適用

- [ ] **Step 6: LIFAIOV の .env.local を更新（Task 0 Step 4 が完了していることを確認）**

  `C:\Users\unite\LIFAIOV\.env.local` に以下が追加済みであることを確認:
  ```
  NEXT_PUBLIC_SITE_URL=https://lifaiov.vercel.app
  SQUARE_ACCESS_TOKEN=EAAAl82d0qU9Jpb9T8yfyskP1S-6FFXse8aLfEHgYtl0fYh8tdjHLXjciwrRirax
  SQUARE_WEBHOOK_SIGNATURE_KEY=5UGnK5qZNF9_wo79SZnsiA  ← aisalonと同じ値でOK
  SQUARE_LOCATION_ID=<取得した値>
  ```

- [ ] **Step 7: LIFAIOV のローカル確認**

  ```powershell
  Set-Location "C:\Users\unite\LIFAIOV"
  npm run dev
  ```
  `http://localhost:3001/membership`（ポートが被る場合は 3001 など）を開いて動作確認

- [ ] **Step 8: Commit（LIFAIOV リポジトリ）**

  ```powershell
  Set-Location "C:\Users\unite\LIFAIOV"
  git add app/api/square/ app/membership/page.tsx app/music-boost/page.tsx
  git commit -m "feat(lifaiov): add Square webhook BP auto-grant (mirrors aisalon)"
  ```

---

## Task 7: 本番デプロイ・動作検証

**Files:** なし（デプロイ・テストのみ）

- [ ] **Step 1: aisalon をデプロイ**

  ```powershell
  Set-Location "C:\Users\unite\aisalon"
  git push origin main
  ```
  Vercel が自動デプロイを開始するのを確認

- [ ] **Step 2: LIFAIOV をデプロイ**

  ```powershell
  Set-Location "C:\Users\unite\LIFAIOV"
  git push origin main
  ```

- [ ] **Step 3: Square Dashboard から Webhook テストを送信**

  Square Dashboard → Webhooks → LIFAI Payments サブスクリプション → Test Webhook
  - Event type: `payment.updated` を選択して送信
  - Vercel Dashboard → lifai → Functions Logs で `[Square Webhook] hit` が表示されること
  - 期待ログ: `[Square Webhook] sig_ok true` → `[Square Webhook] payment not completed, status: ...`（テストのため COMPLETED にはならない）

- [ ] **Step 4: エンドツーエンドテスト（Sandbox環境推奨）**

  Square Dashboard → Sandbox アカウントでテストする場合:
  1. Sandbox の `SQUARE_ACCESS_TOKEN` と `SQUARE_LOCATION_ID` を取得
  2. ローカル `.env.local` を一時的に Sandbox 値に変更して `npm run dev`
  3. `/membership` でログイン状態にする
  4. 「購入する」クリック → Sandbox 決済ページが開く
  5. テストカード: `4111 1111 1111 1111` / 任意の有効期限・CVV で決済
  6. Webhook が届く → ターミナルのログで確認
  7. GAS `wallet_ledger` シートに記録が追加されること
  8. `/membership` で BP 残高が増加していること

- [ ] **Step 5: 本番確認**

  実際に S パック（$7.5）で1件テスト購入する
  - Vercel Logs → `[Square Webhook] COMPLETED paymentId xxx orderId xxx`
  - GAS wallet_ledger シートを開いて新しい行が追加されていること
  - `/membership` の BP 残高が 500 増えていること

---

## 補足：移行期の動作について

### 旧 square.link URL を踏んだ場合

既存の `squareUrl` を直接踏んで決済した場合（ブックマーク等）:
- Webhook は届く（Square Dashboard に登録済みの通知URL宛に）
- `order_id` が存在しないか、`reference_id` が null になる
- Webhook ハンドラは `warning: "no_reference_id"` を返して終了
- **BP は付与されない** → 管理者が手動で付与する必要がある

この移行期間は、**フロントの「購入する」ボタンを更新したデプロイ後**から解消される。

### music-boost の手動フローについて

Webhook は `type: "music_boost_order"` を返すのみ（BP付与なし）。
管理者は Vercel Logs または将来的な通知機能で注文を把握し、手動でブーストを適用する。
管理者通知自動化は将来の Phase 2 として別計画で実施。

---

## 自己レビュー（スペックカバレッジチェック）

| 要件 | 対応 Task |
|---|---|
| Square Webhook HMAC-SHA256 署名検証 | Task 3 |
| `payment.updated` + `COMPLETED` のみ処理 | Task 3 |
| `user_id` を動的 Checkout に埋め込む | Task 2 |
| `square_payment_id` での冪等性保証 | Task 1（GAS側） |
| BP 付与（membership） | Task 1 + Task 4 |
| music-boost 注文ログ記録 | Task 3（bp_amount=0分岐） |
| 既存コードを壊さない（squareUrlは保持） | Task 4,5 |
| aisalon と LIFAIOV 両方に実装 | Task 6 |
| 環境変数の整備 | Task 0 |
| GAS `wallet_ledger` への記録 | Task 1 |
| 二重配信防止（LIFAIOV webhook 未登録） | Task 0・Task 6 |
| music-boost 決済後のリダイレクト先 | Task 2（redirect_path パラメータ） |

