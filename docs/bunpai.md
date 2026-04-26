# LIFAI アフィリエイト分配システム 仕様書

**作成日**: 2026-04-25  
**バージョン**: 2.0（旧紹介配当システム完全廃止・新体制への移行）

---

## 0. 概要・方針

### 0-1. 旧システムの廃止

以下の旧紹介配当ロジックをコードから完全に削除する。

| 削除対象 | 種別 |
|---|---|
| `grantReferralBonusOnce_()` 関数 | GAS関数 |
| `ref_share_pct` 列 | applies シート列 |
| `ref_bonus_granted_at` 列 | applies シート列 |
| `ref_bonus_amount` 列 | applies シート列 |
| `approveRowCore_` 内の紹介配当呼び出しブロック | コード箇所 |

> **既存データの扱い**: 旧列のデータ（シートに書かれている値）は削除しない。ただしコードからは参照しなくなる。列ヘッダーは残るが無視される。

### 0-2. 新システムの目的

- 紹介者（最大5段）に対し、被紹介者の初回支払い額に基づいて EP を自動付与する
- 付与タイミング：初回支払い確定時（IPN 受信 → 自動承認 or 管理者手動承認）
- 付与通貨：EP のみ（現金・BP 付与なし）
- 管理者が GAS を再デプロイせずに報酬率を変更できる（system_settings シート経由）

---

## 1. 為替・換算レート

| パラメータ | 値 | 保存場所 |
|---|---|---|
| USD → JPY 固定レート | 145 | `system_settings` シート |
| EP 換算レート | 4 EP / JPY | `system_settings` シート |

**計算式**:

```
amount_jpy = amount_usd × 145
reward_jpy = amount_jpy × rate_pct / 100
reward_ep  = Math.floor(reward_jpy × 4)
```

---

## 2. 紹介チェーン（5段）

### 2-1. applies シート列

新たに `referrer_4_login_id` と `referrer_5_login_id` を追加する。  
既存列（`referrer_login_id` / `referrer_2_login_id` / `referrer_3_login_id`）の命名は**変更しない**。

| 列名 | 意味 |
|---|---|
| `referrer_login_id` | 1段目紹介者の login_id |
| `referrer_2_login_id` | 2段目 |
| `referrer_3_login_id` | 3段目 |
| `referrer_4_login_id` | 4段目（新規追加） |
| `referrer_5_login_id` | 5段目（新規追加） |
| `ref_path` | チェーン可視化用（`A→B→C→D→E→本人` 形式） |
| `affiliate_granted_at` | 付与完了タイムスタンプ（冪等ガード用・新規追加） |

### 2-2. `resolveRefChain_()` 拡張

現在の実装（最大3段）を最大5段に拡張する。

**現在のシグネチャ（変更なし）:**
```js
function resolveRefChain_(sheet, header, usedRefCode)
// → { ref1_login_id, ref2_login_id, ref3_login_id }
```

**変更後の戻り値:**
```js
// → { ref1_login_id, ref2_login_id, ref3_login_id, ref4_login_id, ref5_login_id }
```

ロジック: `ref1` の `referrer_login_id` を辿って `ref2`、さらに辿って `ref3`、... と最大5段まで遡る。循環参照防止のため visited セットを使う。

**approveRowCore_ 内の書き込みも5列に拡張:**
```js
sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue(bind.ref1_login_id);
sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue(bind.ref2_login_id || "");
sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue(bind.ref3_login_id || "");
sheet.getRange(rowIndex, idx["referrer_4_login_id"] + 1).setValue(bind.ref4_login_id || "");  // 新規
sheet.getRange(rowIndex, idx["referrer_5_login_id"] + 1).setValue(bind.ref5_login_id || "");  // 新規
```

---

## 3. 報酬率

### 3-1. 初回プラン加入（実装対象）

対象: IPN 経由の初回支払い（`payment_update` action）、および管理者手動承認（`admin_approve` action）

| 段 | 列名 | 報酬率 |
|---|---|---:|
| 1段目 | `referrer_login_id` | 10% |
| 2段目 | `referrer_2_login_id` | 5% |
| 3段目 | `referrer_3_login_id` | 2% |
| 4段目 | `referrer_4_login_id` | 2% |
| 5段目 | `referrer_5_login_id` | 1% |

合計: 20%

### 3-2. 内部課金・継続課金（将来フェーズ・今回は実装しない）

| 段 | 報酬率 |
|---|---:|
| 1段目 | 5% |
| 2段目 | 2.5% |
| 3段目 | 1% |
| 4段目 | 1% |
| 5段目 | 0.5% |

今回のフェーズでは実装しない。コードに含めない。

---

## 4. system_settings シート

GAS から直接読み取れるパラメータ管理シート（管理者が GAS 再デプロイなしに変更可能）。

**シート構造（A/B 2列）:**

| A列（key） | B列（value） | 説明 |
|---|---|---|
| `usd_to_jpy` | `145` | 固定為替レート |
| `ep_per_jpy` | `4` | EP換算レート |
| `affiliate_rate_1` | `10` | 1段目報酬率(%) |
| `affiliate_rate_2` | `5` | 2段目報酬率(%) |
| `affiliate_rate_3` | `2` | 3段目報酬率(%) |
| `affiliate_rate_4` | `2` | 4段目報酬率(%) |
| `affiliate_rate_5` | `1` | 5段目報酬率(%) |

**GAS 読み取り関数（新規追加）:**
```js
function getSystemSettings_() {
  const sheet = getOrCreateSheet_("system_settings");
  const values = sheet.getDataRange().getValues();
  const settings = {};
  for (const row of values) {
    if (row[0]) settings[String(row[0])] = row[1];
  }
  return {
    usdToJpy:  Number(settings["usd_to_jpy"]  || 145),
    epPerJpy:  Number(settings["ep_per_jpy"]   || 4),
    rates: [
      Number(settings["affiliate_rate_1"] || 10),
      Number(settings["affiliate_rate_2"] || 5),
      Number(settings["affiliate_rate_3"] || 2),
      Number(settings["affiliate_rate_4"] || 2),
      Number(settings["affiliate_rate_5"] || 1),
    ],
  };
}
```

---

## 5. 新規 GAS 関数: `grantAffiliateEp_`

### 5-1. シグネチャ

```js
function grantAffiliateEp_(sheet, header, idx, childRowIndex, amountUsd, note)
```

| 引数 | 型 | 説明 |
|---|---|---|
| `sheet` | Sheet | applies シートオブジェクト |
| `header` | string[] | ヘッダー行配列 |
| `idx` | object | indexMap_ の結果 |
| `childRowIndex` | number | 被紹介者の行インデックス（1始まり） |
| `amountUsd` | number | 支払い金額（USD） |
| `note` | string | 呼び出し元識別用メモ |

### 5-2. 冪等ガード

`affiliate_granted_at` 列に値があれば即 return（二重付与防止）。

### 5-3. LockService

```js
const lock = LockService.getScriptLock();
lock.waitLock(10000);
try {
  // ... 全処理 ...
} finally {
  lock.releaseLock();
}
```

### 5-4. 内部処理フロー

```
1. affiliate_granted_at チェック（付与済みなら即return）
2. LockService 取得
3. referrer_login_id ～ referrer_5_login_id を読み取り（空なら skip）
4. getSystemSettings_() でレート取得
5. amount_jpy = amountUsd × usdToJpy
6. 各段（1-5）で referrer_login_id が空でなければ:
   a. reward_jpy = amount_jpy × rates[i] / 100
   b. reward_ep = Math.floor(reward_jpy × epPerJpy)
   c. reward_ep < 1 なら skip
   d. referrer の email を applies シートから検索
   e. mktAdjustEp_(loginId, email, reward_ep, "affiliate_reward", JSON.stringify(meta)) を呼び出す
   f. wallet_ledger に記録（mktAdjustEp_ 内で行われる）
7. affiliate_granted_at に現在時刻を書き込む
8. LockService 解放
```

### 5-5. `mktAdjustEp_` の正しい呼び出し

```js
// ✅ 正しい呼び出し（引数順序に注意）
mktAdjustEp_(
  referrerLoginId,           // loginId  (第1引数)
  referrerEmail,             // email    (第2引数)
  rewardEp,                  // delta    (第3引数) ← 数値
  "affiliate_reward",        // kind     (第4引数)
  JSON.stringify({           // memo     (第5引数)
    from: childLoginId,
    level: levelNum,
    amount_usd: amountUsd,
    amount_jpy: amountJpy,
    rate_pct: ratePct,
    reward_jpy: rewardJpy,
    note: note,
  })
);
```

> ⚠️ **注意**: `mktAdjustEp_` のシグネチャは `(loginId, email, delta, kind, memo)` の5引数。email を省略したり引数をずらすと `delta` が文字列になり ep_balance が NaN になる。

---

## 6. approveRowCore_ の変更箇所

### 6-1. 削除するブロック

```js
// 削除: 旧紹介配当付与ブロック（grantReferralBonusOnce_ 呼び出し全体）
// ↓ 以下を丸ごと削除
let refBonusGranted = false;
let refBonusAmount = 0;
try {
  const already = sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue();
  if (!already) {
    // ...
    const granted = grantReferralBonusOnce_(sheet, header, idx, rowIndex, expected, note || "approveRowCore_");
    // ...
  }
} catch (e) {}
```

### 6-2. 追加するブロック

```js
// ✅ 新アフィリエイト報酬付与（5段・EP・冪等）
try {
  const expectedCell = sheet.getRange(rowIndex, idx["expected_paid"] + 1).getValue();
  let amountUsd = parseMoneyLike_(expectedCell);
  if (!amountUsd) {
    const p3 = str_(sheet.getRange(rowIndex, idx["plan"] + 1).getValue());
    const exp3 = planToExpectedPaid_(p3);
    if (exp3 > 0) amountUsd = exp3;
  }
  if (amountUsd > 0) {
    grantAffiliateEp_(sheet, header, idx, rowIndex, amountUsd, note || "approveRowCore_");
  }
} catch (e) {
  Logger.log("grantAffiliateEp_ error: " + e);
}
```

### 6-3. ensureCols_ への追加列

`approveRowCore_` 内の `ensureCols_` 呼び出しに以下を追加：

```js
"referrer_4_login_id",
"referrer_5_login_id",
"affiliate_granted_at",
```

---

## 7. resolveRefChain_ の変更

### 変更前（最大3段）

```js
function resolveRefChain_(sheet, header, usedRefCode) {
  // ...
  return { ref1_login_id, ref2_login_id, ref3_login_id };
}
```

### 変更後（最大5段）

```js
function resolveRefChain_(sheet, header, usedRefCode) {
  if (!usedRefCode) return null;
  const values = getValuesSafe_(sheet);
  if (values.length < 2) return null;
  const h = values[0];
  const idxLocal = indexMap_(h);

  const findByRefCode = (code) => {
    for (let i = 1; i < values.length; i++) {
      if (str_(values[i][idxLocal["my_ref_code"]]) === code) {
        return str_(values[i][idxLocal["login_id"]]);
      }
    }
    return null;
  };

  const findReferrer = (loginId) => {
    for (let i = 1; i < values.length; i++) {
      if (str_(values[i][idxLocal["login_id"]]) === loginId) {
        return str_(values[i][idxLocal["referrer_login_id"]]);
      }
    }
    return null;
  };

  const ref1 = findByRefCode(usedRefCode);
  if (!ref1) return null;

  const visited = new Set([ref1]);
  const chain = [ref1];

  for (let depth = 1; depth < 5; depth++) {
    const parent = findReferrer(chain[chain.length - 1]);
    if (!parent || visited.has(parent)) break;
    visited.add(parent);
    chain.push(parent);
  }

  return {
    ref1_login_id: chain[0] || null,
    ref2_login_id: chain[1] || null,
    ref3_login_id: chain[2] || null,
    ref4_login_id: chain[3] || null,
    ref5_login_id: chain[4] || null,
  };
}
```

---

## 8. wallet_ledger シートへの記録

`mktAdjustEp_` が内部で `wallet_ledger` に書き込む。今回追加する `kind` 値は `"affiliate_reward"` のみ。

**wallet_ledger 列（既存のまま変更なし）:**

| 列名 | 内容 |
|---|---|
| `created_at` | 記録時刻 |
| `login_id` | 受け取り側 |
| `email` | 受け取り側メール |
| `delta` | EP増減量（正: 付与） |
| `kind` | `"affiliate_reward"` |
| `memo` | JSON文字列（from, level, amount_usd, rate_pct 等） |
| `balance_after` | 操作後残高 |

---

## 9. 管理画面への表示（将来フェーズ）

今回は実装しない。将来フェーズで以下を追加予定：
- `/admin` に「アフィリエイト一覧」タブ追加
- `affiliate_granted_at` / `affiliate_ep_total` を表示
- 紹介ツリー可視化

---

## 10. 初期フェーズの対象範囲

**今回実装する対象:**
- `payment_update` action（IPN自動承認）経由の初回プラン加入
- `admin_approve` action（管理者手動承認）経由の初回プラン加入

**今回実装しない:**
- 継続課金・内部課金への報酬
- 5000プラン独自ルート（5000専用シートのユーザーは main シートに移行済みの行のみ対象）
- JAM プランへの個別対応

---

## 11. 5000ユーザーの扱い

commit `bd2a69b` 以降、5000プラン承認時に main の applies シートへ書き込む仕様になっている。  
したがって、5000ユーザーも main シート上で `referrer_login_id` 等が解決できれば通常ユーザーと同様に `grantAffiliateEp_` が適用される。

5000ユーザーの `ref_code` が main シートの `my_ref_code` に存在しない場合（5000独自コード形式）は、`resolveRefChain_` が `null` を返し、紹介チェーンなし扱い（報酬なし）となる。これは現状仕様として許容する。

---

## 12. 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | `grantReferralBonusOnce_` 削除、`resolveRefChain_` 5段拡張、`grantAffiliateEp_` 新規追加、`approveRowCore_` 内の旧ブロック削除・新ブロック追加、`getSystemSettings_` 新規追加、各 `ensureCols_` に4列追加 |
| `gas/Code.gs` | `admin_list` action: `ref_bonus_*` フィールドを返すのをやめ、代わりに `affiliate_granted_at` を返す |

Next.js 側の変更は今フェーズではなし。

---

## 13. 実装順序（推奨）

1. `getSystemSettings_()` 追加 + system_settings シート手動作成
2. `resolveRefChain_()` を5段対応に変更 + `approveRowCore_` の `ensureCols_` に4列追加
3. `grantAffiliateEp_()` 追加
4. `approveRowCore_` の旧ブロック削除 → 新ブロック追加
5. `grantReferralBonusOnce_()` 関数本体を削除
6. `admin_list` の戻り値から `ref_bonus_*` を削除し `affiliate_granted_at` を追加
7. GAS 再デプロイ
8. テスト: 手動承認でアフィリエイトEPが付与されることを wallet_ledger で確認

---

## 14. 実装タスク（追加優先パッチ方式）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存構造を壊さずに5段アフィリエイトEP付与システムを導入する

**Architecture:** 旧ブロック（`grantReferralBonusOnce_`）は即削除せずスタブ化して参照を切り、新関数（`grantAffiliateEp_`）を追加する「追加優先パッチ」方式。旧列データ（`ref_bonus_*`）はシートに残し、コードからの参照のみ停止する。

**Tech Stack:** Google Apps Script (GAS), Google Sheets

**作業方針（必ず守ること）:**
- 旧列（`ref_share_pct`, `ref_bonus_granted_at`, `ref_bonus_amount`）はシートから削除しない・`ensureCols_` からも外さない
- `grantReferralBonusOnce_` は関数ごと削除しない・スタブに差し替える
- `admin_list` の `ref_bonus_*` フィールドも今フェーズは残す（削除しない）
- 各タスクはGASエディタ保存→構文エラーなしを確認してからコミット

---

### Task 1: `getSystemSettings_()` 追加 + `system_settings` シート作成

**Files:**
- Modify: `gas/Code.gs`（`getOrCreateSheet_` 関数・line 4514の直前に挿入）

- [ ] **Step 1: Googleスプレッドシートに `system_settings` シートを手動作成**

  スプレッドシートを開き、新しいシートタブを追加（名前: `system_settings`）。A/B列に以下を入力:

  ```
  A列（key）           B列（value）
  usd_to_jpy           145
  ep_per_jpy           4
  affiliate_rate_1     10
  affiliate_rate_2     5
  affiliate_rate_3     2
  affiliate_rate_4     2
  affiliate_rate_5     1
  ```

- [ ] **Step 2: `getSystemSettings_()` を `gas/Code.gs` に追加**

  `getOrCreateSheet_()` 関数（line 4514）の直前に挿入:

  ```js
  // ==============================
  // system_settings シートからレート設定を読み取る（再デプロイ不要で変更可能）
  // ==============================
  function getSystemSettings_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("system_settings");
    if (!sheet) {
      return { usdToJpy: 145, epPerJpy: 4, rates: [10, 5, 2, 2, 1] };
    }
    const values = sheet.getDataRange().getValues();
    const settings = {};
    for (const row of values) {
      if (row[0]) settings[String(row[0])] = row[1];
    }
    return {
      usdToJpy: Number(settings["usd_to_jpy"]  || 145),
      epPerJpy: Number(settings["ep_per_jpy"]   || 4),
      rates: [
        Number(settings["affiliate_rate_1"] || 10),
        Number(settings["affiliate_rate_2"] || 5),
        Number(settings["affiliate_rate_3"] || 2),
        Number(settings["affiliate_rate_4"] || 2),
        Number(settings["affiliate_rate_5"] || 1),
      ],
    };
  }
  ```

- [ ] **Step 3: GASエディタで動作確認**

  GASエディタの「実行」ボタンで以下のテスト関数を実行（実行後に削除）:

  ```js
  function testGetSystemSettings_() {
    Logger.log(JSON.stringify(getSystemSettings_()));
    // 期待出力: {"usdToJpy":145,"epPerJpy":4,"rates":[10,5,2,2,1]}
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): add getSystemSettings_ reading system_settings sheet"
  ```

---

### Task 2: `ensureCols_` に新列3つを追加

**Files:**
- Modify: `gas/Code.gs`
  - `approveRowCore_` の `ensureCols_` (line ~3816)
  - `admin_list` の `ensureCols_` (line ~752)

- [ ] **Step 1: `approveRowCore_` の `ensureCols_` を更新**

  現在の `referrer_3_login_id` の後（line ~3833）に `referrer_4_login_id` / `referrer_5_login_id` を追加:

  ```js
  // 変更前
        "referrer_2_login_id",
        "referrer_3_login_id",
        "ref_path",

  // 変更後
        "referrer_2_login_id",
        "referrer_3_login_id",
        "referrer_4_login_id",  // 新規追加
        "referrer_5_login_id",  // 新規追加
        "ref_path",
  ```

  さらに同 `ensureCols_` の `ref_bonus_amount` の後（line ~3846）に `affiliate_granted_at` を追加:

  ```js
  // 変更前
        "ref_share_pct",
        "ref_bonus_granted_at",
        "ref_bonus_amount",
        "expected_paid",

  // 変更後
        "ref_share_pct",
        "ref_bonus_granted_at",
        "ref_bonus_amount",
        "affiliate_granted_at",  // 新規追加
        "expected_paid",
  ```

- [ ] **Step 2: `admin_list` の `ensureCols_` を更新**

  `admin_list` action の `ensureCols_` (line ~785-789) の `ref_bonus_amount` の後に追加:

  ```js
  // 変更前
        "ref_share_pct",
        "ref_bonus_granted_at",
        "ref_bonus_amount",
      ]);

  // 変更後
        "ref_share_pct",
        "ref_bonus_granted_at",
        "ref_bonus_amount",
        "affiliate_granted_at",   // 新規追加
        "referrer_4_login_id",    // 新規追加
        "referrer_5_login_id",    // 新規追加
      ]);
  ```

- [ ] **Step 3: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 4: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): add referrer_4/5_login_id and affiliate_granted_at to ensureCols_"
  ```

---

### Task 3: `resolveRefChain_()` を5段対応に拡張

**Files:**
- Modify: `gas/Code.gs` — `resolveRefChain_` 関数全体 (lines 4403–4439)

- [ ] **Step 1: 関数全体を5段対応版に置き換え**

  lines 4403–4439 を以下で置き換え（コメント行含む全体）:

  ```js
  function resolveRefChain_(sheet, header, usedRefCode) {
    if (!usedRefCode) return null;

    const values = getValuesSafe_(sheet);
    if (values.length < 2) return null;
    const h = values[0];
    const idxLocal = indexMap_(h);

    if (idxLocal["my_ref_code"] === undefined || idxLocal["login_id"] === undefined) {
      return null;
    }

    const findByRefCode = (code) => {
      for (let i = 1; i < values.length; i++) {
        if (str_(values[i][idxLocal["my_ref_code"]]) === code) {
          return str_(values[i][idxLocal["login_id"]]);
        }
      }
      return null;
    };

    const findReferrer = (loginId) => {
      for (let i = 1; i < values.length; i++) {
        if (str_(values[i][idxLocal["login_id"]]) === loginId) {
          return idxLocal["referrer_login_id"] !== undefined
            ? str_(values[i][idxLocal["referrer_login_id"]])
            : null;
        }
      }
      return null;
    };

    const ref1 = findByRefCode(usedRefCode);
    if (!ref1) return null;

    const visited = new Set([ref1]);
    const chain = [ref1];

    for (let depth = 1; depth < 5; depth++) {
      const parent = findReferrer(chain[chain.length - 1]);
      if (!parent || visited.has(parent)) break;
      visited.add(parent);
      chain.push(parent);
    }

    return {
      ref1_login_id: chain[0] || null,
      ref2_login_id: chain[1] || null,
      ref3_login_id: chain[2] || null,
      ref4_login_id: chain[3] || null,
      ref5_login_id: chain[4] || null,
    };
  }
  ```

- [ ] **Step 2: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 3: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): extend resolveRefChain_ to 5 levels with cycle protection"
  ```

---

### Task 4: `approveRowCore_` の ref chain 書き込みを5段に拡張

**Files:**
- Modify: `gas/Code.gs` — `approveRowCore_` 内 ref chain 書き込みブロック (lines ~3938–3954)

- [ ] **Step 1: ref chain 書き込みと `ref_path` を5段対応に更新**

  lines 3938–3953 の `if (bind && bind.ref1_login_id) { ... } else { ... }` ブロックを以下に置き換え:

  ```js
      if (bind && bind.ref1_login_id) {
        sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue(bind.ref1_login_id);
        sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue(bind.ref2_login_id || "");
        sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue(bind.ref3_login_id || "");
        if (idx["referrer_4_login_id"] !== undefined) {
          sheet.getRange(rowIndex, idx["referrer_4_login_id"] + 1).setValue(bind.ref4_login_id || "");
        }
        if (idx["referrer_5_login_id"] !== undefined) {
          sheet.getRange(rowIndex, idx["referrer_5_login_id"] + 1).setValue(bind.ref5_login_id || "");
        }

        const path =
          (bind.ref1_login_id || "") +
          (bind.ref2_login_id ? " > " + bind.ref2_login_id : "") +
          (bind.ref3_login_id ? " > " + bind.ref3_login_id : "") +
          (bind.ref4_login_id ? " > " + bind.ref4_login_id : "") +
          (bind.ref5_login_id ? " > " + bind.ref5_login_id : "");
        sheet.getRange(rowIndex, idx["ref_path"] + 1).setValue(path);
      } else {
        sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue("");
        sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue("");
        sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue("");
        if (idx["referrer_4_login_id"] !== undefined) {
          sheet.getRange(rowIndex, idx["referrer_4_login_id"] + 1).setValue("");
        }
        if (idx["referrer_5_login_id"] !== undefined) {
          sheet.getRange(rowIndex, idx["referrer_5_login_id"] + 1).setValue("");
        }
        sheet.getRange(rowIndex, idx["ref_path"] + 1).setValue("");
      }
  ```

- [ ] **Step 2: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 3: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): write referrer_4/5 and extend ref_path to 5 levels in approveRowCore_"
  ```

---

### Task 5: `grantAffiliateEp_()` を追加

**Files:**
- Modify: `gas/Code.gs` — `grantReferralBonusOnce_` 関数の終了 `}` (line ~4188) の直後に挿入

- [ ] **Step 1: 関数を追加**

  line ~4188 の直後に以下を挿入:

  ```js
  // ==============================
  // ✅ 新アフィリエイト報酬付与（5段・EP・冪等）
  // - affiliate_granted_at で二重付与防止
  // - LockService で並行実行時の重複を防ぐ
  // - mktAdjustEp_ 経由で wallet_ledger に記録
  // ==============================
  function grantAffiliateEp_(sheet, header, idx, childRowIndex, amountUsd, note) {
    try {
      // 冪等ガード（ロック前チェック）
      if (idx["affiliate_granted_at"] !== undefined) {
        const already = sheet.getRange(childRowIndex, idx["affiliate_granted_at"] + 1).getValue();
        if (already) {
          Logger.log("grantAffiliateEp_ skipped: already granted at " + already);
          return { ok: true, skipped: true };
        }
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        // 冪等ガード（ロック後に再チェック）
        if (idx["affiliate_granted_at"] !== undefined) {
          const already2 = sheet.getRange(childRowIndex, idx["affiliate_granted_at"] + 1).getValue();
          if (already2) {
            return { ok: true, skipped: true };
          }
        }

        const settings  = getSystemSettings_();
        const usdToJpy  = settings.usdToJpy;
        const epPerJpy  = settings.epPerJpy;
        const rates     = settings.rates;
        const amountJpy = amountUsd * usdToJpy;

        const childLoginId = idx["login_id"] !== undefined
          ? str_(sheet.getRange(childRowIndex, idx["login_id"] + 1).getValue())
          : "";

        const refCols = [
          "referrer_login_id",
          "referrer_2_login_id",
          "referrer_3_login_id",
          "referrer_4_login_id",
          "referrer_5_login_id",
        ];

        // email 検索用に全行キャッシュ
        const allValues = getValuesSafe_(sheet);
        const allIdx    = indexMap_(allValues[0]);
        const allRows   = allValues.slice(1);

        const results = [];

        for (let level = 0; level < 5; level++) {
          const colName = refCols[level];
          if (idx[colName] === undefined) continue;

          const referrerLoginId = str_(sheet.getRange(childRowIndex, idx[colName] + 1).getValue());
          if (!referrerLoginId) continue;

          const ratePct   = rates[level];
          const rewardJpy = amountJpy * ratePct / 100;
          const rewardEp  = Math.floor(rewardJpy * epPerJpy);
          if (rewardEp < 1) continue;

          let referrerEmail = "";
          for (let i = 0; i < allRows.length; i++) {
            if (str_(allRows[i][allIdx["login_id"]]) === referrerLoginId) {
              referrerEmail = allIdx["email"] !== undefined
                ? str_(allRows[i][allIdx["email"]])
                : "";
              break;
            }
          }

          mktAdjustEp_(
            referrerLoginId,
            referrerEmail,
            rewardEp,
            "affiliate_reward",
            JSON.stringify({
              from:       childLoginId,
              level:      level + 1,
              amount_usd: amountUsd,
              amount_jpy: amountJpy,
              rate_pct:   ratePct,
              reward_jpy: rewardJpy,
              note:       note,
            })
          );

          results.push({ level: level + 1, to: referrerLoginId, ep: rewardEp });
          Logger.log("grantAffiliateEp_ level=" + (level + 1) + " to=" + referrerLoginId + " ep=" + rewardEp);
        }

        // 付与完了タイムスタンプ（冪等ガード）
        if (idx["affiliate_granted_at"] !== undefined) {
          sheet.getRange(childRowIndex, idx["affiliate_granted_at"] + 1).setValue(new Date());
        }

        return { ok: true, results: results };

      } finally {
        lock.releaseLock();
      }
    } catch (e) {
      Logger.log("grantAffiliateEp_ error: " + e);
      return { ok: false, error: String(e) };
    }
  }
  ```

- [ ] **Step 2: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 3: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): add grantAffiliateEp_ with 5-level EP reward and idempotency guard"
  ```

---

### Task 6: `approveRowCore_` の旧ブロックを停止・新ブロックを追加

**Files:**
- Modify: `gas/Code.gs` — `approveRowCore_` 内の旧紹介配当ブロック (lines ~4012–4040)

注意: `refBonusGranted` / `refBonusAmount` 変数は関数末尾の `return` で参照されているため**削除しない**。旧ブロックの `grantReferralBonusOnce_` 呼び出しだけを除去し、新ブロックを後に追加する。

- [ ] **Step 1: 旧ブロックの呼び出しを停止し、新ブロックを追加**

  lines 4012–4040 の既存ブロックを以下に置き換え:

  ```js
      // ✅ 旧紹介配当ブロック（停止済み）
      // grantReferralBonusOnce_ はスタブ化済み。列データ（ref_bonus_*）はシートに残す。
      let refBonusGranted = false;
      let refBonusAmount = 0;

      // ✅ 新アフィリエイト報酬付与（5段・EP・冪等）
      try {
        const expectedCell = sheet.getRange(rowIndex, idx["expected_paid"] + 1).getValue();
        let amountUsd = parseMoneyLike_(expectedCell);
        if (!amountUsd) {
          const p3   = str_(sheet.getRange(rowIndex, idx["plan"] + 1).getValue());
          const exp3 = planToExpectedPaid_(p3);
          if (exp3 > 0) amountUsd = exp3;
        }
        if (amountUsd > 0) {
          grantAffiliateEp_(sheet, header, idx, rowIndex, amountUsd, note || "approveRowCore_");
        }
      } catch (e) {
        Logger.log("grantAffiliateEp_ error: " + e);
      }
  ```

- [ ] **Step 2: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 3: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): replace old referral bonus call with grantAffiliateEp_ in approveRowCore_"
  ```

---

### Task 7: `grantReferralBonusOnce_()` をスタブ化

**Files:**
- Modify: `gas/Code.gs` — `grantReferralBonusOnce_` 関数本体 (lines ~4089–4188)

- [ ] **Step 1: 関数本体をスタブに置き換え（シグネチャは変えない）**

  lines 4089–4188 を以下で置き換え:

  ```js
  function grantReferralBonusOnce_(sheet, header, idx, childRowIndex, expectedPaid, note) {
    // 旧紹介配当関数。grantAffiliateEp_ に移行済みのため停止。
    // 呼び出し元が残っていても安全に何もしない。
    Logger.log("grantReferralBonusOnce_ skipped: replaced by grantAffiliateEp_");
    return { ok: false, skipped: true };
  }
  ```

- [ ] **Step 2: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 3: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "refactor(gas): stub out grantReferralBonusOnce_ replaced by grantAffiliateEp_"
  ```

---

### Task 8: `admin_list` の戻り値に `affiliate_granted_at` / `referrer_4/5` を追加

**Files:**
- Modify: `gas/Code.gs` — `admin_list` action の `items` マップ (lines ~833–836)

注意: `ref_bonus_*` フィールドは**削除しない**（旧データの参照用に残す）。

- [ ] **Step 1: `items` マップに3フィールドを追加**

  lines ~833–836 の `ref_bonus_amount` の後に追加:

  ```js
        // 変更前
        ref_share_pct: r[idx["ref_share_pct"]],
        ref_bonus_granted_at: r[idx["ref_bonus_granted_at"]],
        ref_bonus_amount: r[idx["ref_bonus_amount"]],
      }));

        // 変更後
        ref_share_pct: r[idx["ref_share_pct"]],
        ref_bonus_granted_at: r[idx["ref_bonus_granted_at"]],
        ref_bonus_amount: r[idx["ref_bonus_amount"]],
        affiliate_granted_at: idx["affiliate_granted_at"] !== undefined ? r[idx["affiliate_granted_at"]] : "",  // 新規追加
        referrer_4_login_id:  idx["referrer_4_login_id"]  !== undefined ? r[idx["referrer_4_login_id"]]  : "",  // 新規追加
        referrer_5_login_id:  idx["referrer_5_login_id"]  !== undefined ? r[idx["referrer_5_login_id"]]  : "",  // 新規追加
      }));
  ```

- [ ] **Step 2: GASエディタで保存して構文エラーなしを確認**

- [ ] **Step 3: Commit**

  ```bash
  git add gas/Code.gs
  git commit -m "feat(gas): expose affiliate_granted_at and referrer_4/5 in admin_list response"
  ```

---

### Task 9: GAS 再デプロイ & 統合テスト

- [ ] **Step 1: GAS 再デプロイ**

  GASエディタ → 「デプロイ」→「デプロイを管理」→「新しいバージョンを作成」して保存。

- [ ] **Step 2: `system_settings` 確認**

  GASエディタで `testGetSystemSettings_()` を実行し、正しい値が返ることを確認。

- [ ] **Step 3: テスト用行を `applies` で準備**

  - `status` が `paid` または未承認の行を1つ選ぶ
  - `ref_code` に既存ユーザーの `my_ref_code`（例: `R-xxxx`）が入っているか確認
  - `expected_paid` または `plan` に金額が設定されているか確認

- [ ] **Step 4: 管理画面から手動承認**

  `/admin` → 該当行の「承認」ボタンを押す。

- [ ] **Step 5: `wallet_ledger` シートで確認**

  以下の行が追加されていることを確認:
  - `kind` = `"affiliate_reward"`
  - `login_id` = 1段目紹介者の `login_id`
  - `amount` = `Math.floor(支払いUSD × 145 × 0.10 × 4)` の整数値
  - `memo` に `{"from":"...","level":1,"amount_usd":...,"rate_pct":10,...}` が含まれる

- [ ] **Step 6: `applies` シートで `affiliate_granted_at` を確認**

  承認した行の `affiliate_granted_at` 列にタイムスタンプが入っていることを確認。

- [ ] **Step 7: 冪等テスト**

  同じ行をもう一度承認 → `wallet_ledger` に重複行が追加されないことを確認（`affiliate_granted_at` がすでに埋まっているためスキップされる）。

- [ ] **Step 8: 完了確認チェックリスト**

  - [ ] `applies` シートに `referrer_4_login_id`, `referrer_5_login_id`, `affiliate_granted_at` 列が存在する
  - [ ] `system_settings` シートが存在し正しい値が設定されている
  - [ ] 手動承認後に `wallet_ledger` に `affiliate_reward` が記録されている
  - [ ] `affiliate_granted_at` に付与タイムスタンプが記録されている
  - [ ] 再承認しても二重付与されない
  - [ ] `ref_bonus_*` 列はシートに残っている（削除されていない）
  - [ ] GAS ログに `grantAffiliateEp_ level=1 to=... ep=...` が出力されている
