# 5000プランユーザーをメインシートで管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5000円プランユーザーの承認時にメインの `applies` シートへ書き込み、ログイン後は通常会員と同じ全機能が使えるようにする。

**Architecture:** `approveRowCore5000_` で承認時にメインシートへ行を追加（`entry_source="5000"` で識別）。GAS `login` アクションで `group:"5000"` 受信時はメインシートを先に検索し、見つかった場合は `group:""` を返す。Next.js `/5000/login` はレスポンスの `group` をそのまま使用する。既存の5000シートユーザーはフォールバックにより現状維持。

**Tech Stack:** Google Apps Script (GAS), Next.js 14 (App Router), TypeScript

---

## File Map

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | ① `approveRowCore_` の ensureCols_ に `entry_source` 追加 ② `login` アクションにメインシート先行検索を追加 ③ `approveRowCore5000_` にメインシートへの書き込みを追加 |
| `app/5000/login/page.tsx` | `group` をハードコードせずレスポンスの `res.group` を使う |

---

### Task 1: `approveRowCore_` に `entry_source` 列を追加

**Files:**
- Modify: `gas/Code.gs` — `approveRowCore_` 内の `ensureCols_` 呼び出し

`approveRowCore_` 関数内の `ensureCols_` に `"entry_source"` を追加する。通常ユーザーはこの列が空になる。これによりメインシートに列が保証される。

- [ ] **Step 1: `approveRowCore_` の `ensureCols_` を探す**

`gas/Code.gs` 内で `function approveRowCore_(` を検索。その内部の `ensureCols_(sheet, header, [` ブロックを見つける。最後のエントリ（`"expected_paid"` か `"plan"` か `"mail_error"` あたり）の後に `"entry_source"` を追加する。

変更前（末尾付近）:
```javascript
      // ✅ メールエラーログ（デバッグ用）
      "mail_error",
    ]);
```

変更後:
```javascript
      // ✅ メールエラーログ（デバッグ用）
      "mail_error",

      // ✅ 入口識別（5000ルートから入ったユーザーに "5000" を設定）
      "entry_source",
    ]);
```

- [ ] **Step 2: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add entry_source column to approveRowCore_ ensureCols"
```

---

### Task 2: `login` アクションにメインシート先行検索を追加

**Files:**
- Modify: `gas/Code.gs` — `login` アクションブロック（`if (action === "login")` 以降）

`group:"5000"` でのログイン時、メインシートを先に検索する。見つかればHMAC照合してレスポンスに `group: ""` を含める。見つからなければ従来通り5000シートで検索してプレーンテキスト照合、`group: "5000"` を含めて返す。

- [ ] **Step 1: `login` アクションの先頭部分を変更**

現在の該当箇所（`if (action === "login")` ブロック冒頭）:
```javascript
  if (action === "login") {
    const id = str_(body.id);
    const code = str_(body.code);
    const group_login = str_(body.group);
    const targetSheet_login = group_login === "5000" ? getAppliesSheet5000_() : sheet;

    if (!id || !code) {
      return json_({ ok: false, reason: "invalid" });
    }
```

変更後:
```javascript
  if (action === "login") {
    const id = str_(body.id);
    const code = str_(body.code);
    const group_login = str_(body.group);

    if (!id || !code) {
      return json_({ ok: false, reason: "invalid" });
    }

    // group:"5000" のとき、メインシートを先に検索（新規5000ユーザー対応）
    // → 見つからなければ5000シートへフォールバック（既存ユーザー互換）
    let targetSheet_login = sheet;
    let foundIn5000Sheet = false;

    if (group_login === "5000") {
      const mainVals = sheet.getDataRange().getValues();
      const mainHdr  = mainVals[0];
      const mainIdx  = indexMap_(mainHdr);
      const mainRows = mainVals.slice(1);
      let foundInMain = false;
      for (let mi = 0; mi < mainRows.length; mi++) {
        const mLoginId = str_(mainRows[mi][mainIdx["login_id"]] || "");
        const mEmail   = str_(mainRows[mi][mainIdx["email"]]    || "");
        if (id === mLoginId || id === mEmail) {
          foundInMain = true;
          break;
        }
      }
      if (!foundInMain) {
        targetSheet_login = getAppliesSheet5000_();
        foundIn5000Sheet  = true;
      }
    }
```

- [ ] **Step 2: パスワード照合ロジックを変更**

現在の照合箇所:
```javascript
    let loginOk;
    if (group_login === "5000") {
      // /5000グループは平文パスワードで照合
      loginOk = (code === pwHashSaved);
    } else {
      loginOk = (hmacSha256Hex_(SECRET, loginId + ":" + code) === pwHashSaved);
    }
```

変更後:
```javascript
    let loginOk;
    if (foundIn5000Sheet) {
      // 既存5000ユーザー（5000シートにいる）は平文パスワードで照合
      loginOk = (code === pwHashSaved);
    } else {
      loginOk = (hmacSha256Hex_(SECRET, loginId + ":" + code) === pwHashSaved);
    }
```

- [ ] **Step 3: レスポンスに `group` を含める**

現在:
```javascript
    return json_({ ok: true });
  }
```

変更後:
```javascript
    return json_({ ok: true, group: foundIn5000Sheet ? "5000" : "" });
  }
```

- [ ] **Step 4: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): login checks main sheet first for group:5000 users"
```

---

### Task 3: `/5000/login` が `res.group` を使うよう変更

**Files:**
- Modify: `app/5000/login/page.tsx`

GAS から返ってくる `res.group` をそのまま使う。GASが `""` を返せばメインシートユーザーとして扱われ、全機能が使える。`"5000"` を返せば既存の動作のまま。

- [ ] **Step 1: `setAuth` の `group` をハードコードから変更**

現在（`page.tsx` の `if (res.ok)` ブロック）:
```typescript
      if (res.ok) {
        setAuth({
          status: "approved",
          id: trimmedId,
          token: res.token ?? pw,
          group: "5000",
        });
```

変更後:
```typescript
      if (res.ok) {
        setAuth({
          status: "approved",
          id: trimmedId,
          token: res.token ?? pw,
          group: res.group ?? "5000",
        });
```

- [ ] **Step 2: pending 時の `group` も変更**

現在:
```typescript
      if (res.reason === "pending") {
        setAuth({ status: "pending", id: trimmedId, group: "5000" });
```

変更後:
```typescript
      if (res.reason === "pending") {
        setAuth({ status: "pending", id: trimmedId, group: res.group ?? "5000" });
```

- [ ] **Step 3: コミット**

```bash
git add app/5000/login/page.tsx
git commit -m "feat(login5000): use group from GAS response instead of hardcoded"
```

---

### Task 4: `approveRowCore5000_` でメインシートに行を追加

**Files:**
- Modify: `gas/Code.gs` — `approveRowCore5000_` 関数

承認処理の最後（return の直前）に、メインの `applies` シートへの書き込みブロックを追加する。冪等性のため `login_id` で重複チェックを行う。

5000ルートのプランとBP付与量の対応（`planToGrant_` はUSDT金額ベースなので別途定義）:
- `"500"` → 1000 BP
- `"2000"` → 4000 BP
- `"3000"` → 8000 BP
- `"5000"` → 10000 BP

- [ ] **Step 1: `approveRowCore5000_` の return 直前に書き込みブロックを追加**

`approveRowCore5000_` 関数の末尾（`return { ok: true, already: false, ... }` の直前）に以下を追加:

```javascript
  // ============================================================
  // メインシートへの書き込み（新規管理方針：entry_source="5000"）
  // 冪等性のため login_id で重複チェックを行う
  // ============================================================
  try {
    const mainSS    = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = getOrCreateSheet_();

    // 必要列を保証
    const mainHeaderRaw = mainSheet.getDataRange().getValues()[0];
    ensureCols_(mainSheet, mainHeaderRaw, [
      "created_at", "apply_id", "plan", "email", "name", "name_kana",
      "age_band", "prefecture", "city", "job", "ref_name", "ref_id",
      "status", "approved_at", "login_id", "my_ref_code",
      "reset_token", "reset_expires", "reset_used_at", "reset_sent_at",
      "bp_balance", "ep_balance", "bp_granted_at", "bp_grant_plan",
      "bp_grant_amount", "ep_grant_amount",
      "entry_source",
    ]);

    const mainHeader2 = mainSheet.getDataRange().getValues()[0];
    const mainIdx2    = indexMap_(mainHeader2);
    const mainData2   = mainSheet.getDataRange().getValues().slice(1);

    // 重複チェック（login_id が既にある場合はスキップ）
    let alreadyInMain = false;
    for (let di = 0; di < mainData2.length; di++) {
      if (str_(mainData2[di][mainIdx2["login_id"]]) === loginId5000) {
        alreadyInMain = true;
        break;
      }
    }

    if (!alreadyInMain) {
      // 5000ルートのプラン別BP付与量
      const bpMap5000Route = { "500": 1000, "2000": 4000, "3000": 8000, "5000": 10000 };
      const planStr5k = str_(applySheet.getRange(rowIndex, idx["plan"] + 1).getValue());
      const bpGrant5k = bpMap5000Route[planStr5k] || 0;

      const newRow = new Array(mainHeader2.length).fill("");
      newRow[mainIdx2["created_at"]]     = new Date();
      newRow[mainIdx2["apply_id"]]       = str_(applySheet.getRange(rowIndex, idx["apply_id"] + 1).getValue());
      newRow[mainIdx2["plan"]]           = planStr5k;
      newRow[mainIdx2["email"]]          = email5000;
      newRow[mainIdx2["name"]]           = str_(applySheet.getRange(rowIndex, idx["name"]      + 1).getValue());
      newRow[mainIdx2["name_kana"]]      = str_(applySheet.getRange(rowIndex, idx["name_kana"] + 1).getValue());
      newRow[mainIdx2["age_band"]]       = str_(applySheet.getRange(rowIndex, idx["age_band"]  + 1).getValue());
      newRow[mainIdx2["prefecture"]]     = str_(applySheet.getRange(rowIndex, idx["prefecture"]+ 1).getValue());
      newRow[mainIdx2["city"]]           = str_(applySheet.getRange(rowIndex, idx["city"]      + 1).getValue());
      newRow[mainIdx2["job"]]            = str_(applySheet.getRange(rowIndex, idx["job"]       + 1).getValue());
      newRow[mainIdx2["ref_name"]]       = str_(applySheet.getRange(rowIndex, idx["ref_name"]  + 1).getValue());
      newRow[mainIdx2["ref_id"]]         = str_(applySheet.getRange(rowIndex, idx["ref_id"]    + 1).getValue());
      newRow[mainIdx2["status"]]         = "approved";
      newRow[mainIdx2["approved_at"]]    = new Date();
      newRow[mainIdx2["login_id"]]       = loginId5000;
      newRow[mainIdx2["my_ref_code"]]    = myRefCode5000;
      newRow[mainIdx2["reset_token"]]    = token5000;
      newRow[mainIdx2["reset_expires"]]  = expires5000;
      newRow[mainIdx2["reset_used_at"]]  = "";
      newRow[mainIdx2["reset_sent_at"]]  = sentAt5000 ? sentAt5000 : "";
      newRow[mainIdx2["bp_balance"]]     = bpGrant5k;
      newRow[mainIdx2["ep_balance"]]     = 0;
      newRow[mainIdx2["bp_granted_at"]]  = new Date();
      newRow[mainIdx2["bp_grant_plan"]]  = planStr5k;
      newRow[mainIdx2["bp_grant_amount"]]= bpGrant5k;
      newRow[mainIdx2["ep_grant_amount"]]= 0;
      newRow[mainIdx2["entry_source"]]   = "5000";
      mainSheet.appendRow(newRow);
      Logger.log("[approveRowCore5000_] written to main applies: loginId=" + loginId5000);
    } else {
      Logger.log("[approveRowCore5000_] skip: loginId=" + loginId5000 + " already in main applies");
    }
  } catch (mainWriteErr) {
    // メインシート書き込み失敗はログのみ（5000シートの承認自体は成功扱い）
    Logger.log("[approveRowCore5000_] main sheet write error: " + String(mainWriteErr));
  }
```

- [ ] **Step 2: `token5000` と `expires5000` と `sentAt5000` が上記ブロックのスコープ内にあることを確認**

`approveRowCore5000_` の既存コードで `token5000`、`expires5000`、`sentAt5000` は関数スコープで宣言されている。追加ブロックはこれらを参照するので、関数末尾の `return` の直前に置くことで全て参照可能。

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): write 5000-plan users to main applies sheet on approval"
```

---

### Task 5: 動作確認チェックリスト

実際にGASとNext.jsを通じて動作確認する手順。

- [ ] **Step 1: GASをデプロイ**

GASエディタで「デプロイ」→「デプロイを管理」→新バージョンで更新。

- [ ] **Step 2: テスト承認を実行（開発環境）**

`/5000/admin` からテストユーザーを手動承認し、メインスプレッドシートの `applies` シートに `entry_source = "5000"` の行が追加されることを確認。

確認項目:
- `login_id` が `5k_XXXXXX` 形式
- `status = "approved"`
- `entry_source = "5000"`
- `bp_balance` がプランに応じた値（500→1000, 2000→4000, 3000→8000, 5000→10000）

- [ ] **Step 3: `/5000/login` でログイン確認**

承認したユーザーで `/5000/login` へアクセスしてログイン。

確認項目:
- ログイン成功
- ブラウザの localStorage `addval_auth_v1` を確認し `group` が `""` または未設定になっていること
- `/top` にリダイレクトされること

- [ ] **Step 4: 機能動作確認**

`/top` で以下が動作することを確認:
- BP/EP残高が表示される
- 団子占い（`/fortune`）が使える
- ガチャが使える

- [ ] **Step 5: 既存5000ユーザーの互換確認**

5000シートにのみ存在する既存ユーザーで `/5000/login` へログインし、従来通りログインできること（`group:"5000"` がauthに入ること）を確認。

- [ ] **Step 6: 最終コミット（確認済みなら）**

```bash
git add -A
git commit -m "chore: verify 5000-plan main sheet migration works end-to-end"
```
