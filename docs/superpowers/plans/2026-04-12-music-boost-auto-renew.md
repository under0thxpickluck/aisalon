# Music Boost 自動更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Music Boost の EP 決済を期限到来時に自動更新し、EP 残高不足の場合はブーストを失効させてメールで通知する。

**Architecture:** GAS の `musicBoostAutoRenew_()` 関数を `gas/Code.gs` に追加する。毎日深夜 0 時の時間ベーストリガーで実行され、`music_boost` シートの期限切れアクティブブーストを処理する。Next.js 側の変更は不要。

**Tech Stack:** Google Apps Script (GAS), Google Sheets, MailApp

---

## ファイルマップ

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | Modify | `musicBoostAutoRenew_()` 関数を追加（行8673 の直後） |

---

### Task 1: `musicBoostAutoRenew_` 関数を追加する

**Files:**
- Modify: `gas/Code.gs`（行8673 の `}` の直後、`// action: music_boost_admin_list` の直前に挿入）

- [ ] **Step 1: `musicBoostAutoRenew_` 関数を挿入する**

行8673（`musicBoostCancel_` の末尾 `}`）と行8674（`// action: music_boost_admin_list`）の間に以下を追加する：

```javascript
// ── Music Boost 自動更新（時間ベーストリガーから呼び出す）────────────────
function musicBoostAutoRenew_() {
  var nowJst    = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var nowIso    = nowJst.toISOString();

  var boostSheet = getMusicBoostSheet_();
  var boostData  = boostSheet.getDataRange().getValues();
  var boostHdr   = boostData[0];
  var boostIdx   = {};
  boostHdr.forEach(function(h, i) { boostIdx[h] = i; });

  // applies シートを一度だけ読み込む
  var appliesSheet = getOrCreateSheet_();
  var appliesData  = appliesSheet.getDataRange().getValues();
  var appliesHdr   = appliesData[0];
  var appliesIdx   = {};
  appliesHdr.forEach(function(h, i) { appliesIdx[h] = i; });

  for (var i = 1; i < boostData.length; i++) {
    var row = boostData[i];
    if (String(row[boostIdx["status"]]) !== "active") continue;

    var expiresAt = new Date(row[boostIdx["expires_at"]]);
    if (expiresAt > nowJst) continue; // まだ期限切れでない

    var userId = String(row[boostIdx["user_id"]]);
    var planId = String(row[boostIdx["plan_id"]]);
    var rowNum = i + 1; // シートの行番号（ヘッダー含む 1 始まり）

    // プランを検索
    var plan = null;
    for (var p = 0; p < MUSIC_BOOST_PLANS.length; p++) {
      if (MUSIC_BOOST_PLANS[p].id === planId) { plan = MUSIC_BOOST_PLANS[p]; break; }
    }
    if (!plan) {
      console.error("musicBoostAutoRenew_: unknown planId=" + planId + " userId=" + userId);
      continue;
    }

    var epCost = plan.price * 100;

    // ユーザーの EP 残高とメールアドレスを取得
    var userEp    = 0;
    var userEmail = "";
    for (var ai = 1; ai < appliesData.length; ai++) {
      if (String(appliesData[ai][appliesIdx["login_id"]]) === userId) {
        userEp    = Number(appliesData[ai][appliesIdx["ep_balance"]] || 0);
        userEmail = String(appliesData[ai][appliesIdx["email"]] || "");
        break;
      }
    }

    if (userEp >= epCost) {
      // ── EP 差引 ──────────────────────────────────────────────
      var epResult = mktAdjustEp_(userId, userEmail, -epCost, "music_boost_ep_renew",
                                  "Music Boost 自動更新 " + planId);
      if (!epResult.ok) {
        console.error("musicBoostAutoRenew_: mktAdjustEp_ failed userId=" + userId
                      + " error=" + epResult.error);
        continue; // EP 差引失敗時は行を変更しない（二重課金防止）
      }

      // 旧行を expired に更新
      boostSheet.getRange(rowNum, boostIdx["status"]     + 1).setValue("expired");
      boostSheet.getRange(rowNum, boostIdx["updated_at"] + 1).setValue(nowIso);

      // 新行を追加（+30日）
      var newExpiresAt = new Date(nowJst.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      boostSheet.appendRow([
        Utilities.getUuid(), userId, planId, plan.percent, plan.price,
        plan.slots, "active", nowIso, newExpiresAt, "", nowIso
      ]);

    } else {
      // ── EP 不足：失効 + メール ───────────────────────────────
      boostSheet.getRange(rowNum, boostIdx["status"]     + 1).setValue("expired");
      boostSheet.getRange(rowNum, boostIdx["updated_at"] + 1).setValue(nowIso);

      if (userEmail) {
        try {
          MailApp.sendEmail(
            userEmail,
            "【LIFAI】Music Boost の自動更新ができませんでした",
            "Music Boost の自動更新ができませんでした。\n\n" +
            "プラン: " + planId + "（" + plan.percent + "%）\n" +
            "必要 EP: " + epCost + " EP\n" +
            "現在の EP 残高: " + userEp + " EP\n\n" +
            "EP をチャージして再度ご契約いただけます:\n" +
            "https://lifai.vercel.app/music-boost"
          );
        } catch (mailErr) {
          console.error("musicBoostAutoRenew_: mail failed userId=" + userId
                        + " err=" + mailErr);
        }
      }
    }
  }
}
// ── Music Boost 自動更新ここまで ──────────────────────────────────────────
```

- [ ] **Step 2: GASをデプロイして動作確認（Apps Script エディタから「デプロイ」→「既存のデプロイを管理」→更新）**

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): Music Boost 自動更新関数を追加"
```

---

### Task 2: GAS 時間ベーストリガーを設定する

**Files:** なし（Apps Script エディタでの操作）

- [ ] **Step 1: Apps Script エディタでトリガーを設定する**

1. GAS プロジェクトを Apps Script エディタで開く
2. 左メニューの「トリガー」（時計アイコン）をクリック
3. 右下の「トリガーを追加」ボタンをクリック
4. 以下の設定を入力する：
   - 実行する関数: `musicBoostAutoRenew_`
   - デプロイ時に実行: `Head`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガーのタイプ: `日付ベースのタイマー`
   - 時刻: `午前 0 時〜1 時`
5. 「保存」をクリック

- [ ] **Step 2: 動作確認（手動実行）**

Apps Script エディタで `musicBoostAutoRenew_` を選択し「実行」ボタンを押して、エラーが出ないことを確認する。

---

## 動作確認チェックリスト

- [ ] `musicBoostAutoRenew_` を手動実行してもエラーが出ない
- [ ] 期限切れの `active` 行が存在する場合、`expired` に更新される
- [ ] EP 十分な場合、新しい `active` 行が追加され EP が差し引かれる
- [ ] `wallet_ledger` に `kind: "music_boost_ep_renew"` のレコードが追加される
- [ ] EP 不足の場合、`expired` になり失敗メールが届く
- [ ] まだ期限切れでない `active` 行は処理されない
