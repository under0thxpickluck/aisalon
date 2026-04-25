# BP月次回復 設計書

**作成日:** 2026-04-24  
**ステータス:** 承認済み・実装待ち

---

## 概要

メンバーシップページに記載されている「毎月BPが回復する」仕様を実際に動作させる。  
現状は `bp_cap` / `bp_last_reset_at` カラムがスキーマに定義されているだけで、回復処理は一切実装されていない。

---

## 設計方針

| 項目 | 決定内容 |
|---|---|
| トリガー | ログイン時チェック（TOPページ表示時） |
| BP管理 | 単一フィールド（`bp_balance` のまま。通常/追加の区別なし） |
| bp_cap の正源 | GAS側で plan 値から算出。`get_balance` レスポンスに `bp_cap` を追加 |
| 実装パターン | 専用GASアクション + 新APIルート（`daily_login_bonus` と同じ構造） |
| /5000対応 | `group:"5000"` ルーティングで別シートに対応（既存の `get_balance` と同じ方式） |

---

## bp_cap マッピング

### 通常プラン（`applies` シート）

| plan値（GAS実値） | ランク | bp_cap |
|---|---|---|
| "34" | Starter | 300 |
| "57" | Builder | 600 |
| "114" | Automation | 1,200 |
| "567" | Core | 6,000 |
| "1134" | Infra | 12,000 |

### /5000プラン（`applies_5000` シート）

| plan値 | 金額 | bp_cap |
|---|---|---|
| "500" | $500 | 1,000 |
| "2000" | $2,000 | 4,000 |
| "3000" | $3,000 | 8,000 |
| "5000" | $5,000 | 10,000 |

---

## 回復量の計算ルール

```
回復量 = min(bp_cap × 50%, max(0, bp_cap - currentBp))
```

- 現在残高が cap 未満 → cap の 50% を上限として加算（cap を超えない）
- 現在残高が cap 以上 → 回復なし（削減もしない）
- 回復は30日に1回（`bp_last_reset_at` で判定）

### 計算例（Starter / bp_cap=300）

| 現在BP | 回復量 | 回復後 | 備考 |
|---|---|---|---|
| 0 | 150 | 150 | 上限50%まで回復 |
| 100 | 150 | 250 | |
| 250 | 50 | 300 | capちょうどまで |
| 300 | 0 | 300 | 変化なし |
| 450 | 0 | 450 | cap超えでも削らない |

---

## 全体フロー

```
ユーザーが /top を開く
  └─ useEffect（daily_login_bonus の直後）
       └─ POST /api/wallet/recover  { loginId, group }
            └─ GAS action: monthly_bp_recover
                 ├─ adminKey 認証
                 ├─ group で対象シートを振り分け（"5000" → applies_5000）
                 ├─ loginId でユーザー行を特定
                 ├─ bp_last_reset_at を確認
                 │    └─ 30日未満 → { ok:false, reason:"already_recovered" } で終了
                 └─ 30日以上経過（または未設定）
                      ├─ plan から bp_cap を算出
                      ├─ 回復量を計算
                      ├─ bp_balance を更新
                      ├─ bp_last_reset_at = now
                      ├─ wallet_ledger に記録（kind:"monthly_recover"）
                      └─ { ok:true, bp_recovered:N, bp_balance:newBp }
                           └─ TOP: setBalanceTrigger → WALLET残高を再取得
```

---

## 変更ファイル一覧

### 新規作成

| ファイル | 内容 |
|---|---|
| `app/api/wallet/recover/route.ts` | POST only。GAS `monthly_bp_recover` へのproxyのみ。他ルートと同じ構造。 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | ① `monthly_bp_recover` action追加 ② `get_balance` レスポンスに `bp_cap` フィールド追加 |
| `app/top/page.tsx` | `useEffect` 内の daily_login_bonus 呼び出しの直後に `/api/wallet/recover` を追加。エラーは無視（サイレント失敗）。回復があれば `setBalanceTrigger` |
| `app/membership/page.tsx` | `PLAN_BP_CAP` のキーを GAS 実値に修正（`"30"`→`"34"` 等）。5000プランのマップも追加 |

### 変更しないファイル

- `app/api/wallet/balance/route.ts` — 変更なし
- `app/api/daily-login/route.ts` — 変更なし
- `app/api/staking/route.ts` — 変更なし
- GASの既存action全て — 追記のみ、既存コードは一切触らない

---

## GAS 実装詳細

### `monthly_bp_recover` action の擬似コード

```javascript
if (action === "monthly_bp_recover") {
  // adminKey 認証
  if (body.adminKey !== ADMIN_SECRET) return json_({ ok:false, error:"admin_unauthorized" });

  const loginId = str_(body.loginId);
  const group   = str_(body.group);
  if (!loginId) return json_({ ok:false, error:"loginId_required" });

  // シート振り分け
  const targetSheet = group === "5000" ? getAppliesSheet5000_() : sheet;

  // bp_cap マップ
  const BP_CAP_MAP = { "34":300, "57":600, "114":1200, "567":6000, "1134":12000 };
  const BP_CAP_MAP_5000 = { "500":1000, "2000":4000, "3000":8000, "5000":10000 };

  // ユーザー行を取得（daily_login_bonus と同じパターン）
  // ensureCols_(targetSheet, header, ["login_id","bp_balance","bp_last_reset_at","plan"]);
  // values = targetSheet.getDataRange().getValues(); header = values[0]; idx = indexMap_(header);
  // rows でループして login_id 一致行を hitRowIndex に設定

  // 前回回復日チェック（30日 = 30 * 24 * 60 * 60 * 1000 ms）
  const lastReset = targetSheet.getRange(hitRowIndex, idx["bp_last_reset_at"] + 1).getValue();
  if (lastReset) {
    const elapsed = Date.now() - new Date(lastReset).getTime();
    if (elapsed < 30 * 24 * 60 * 60 * 1000) {
      return json_({ ok:false, reason:"already_recovered" });
    }
  }

  // plan → bp_cap
  const plan   = str_(targetSheet.getRange(hitRowIndex, idx["plan"] + 1).getValue());
  const capMap = group === "5000" ? BP_CAP_MAP_5000 : BP_CAP_MAP;
  const bpCap  = capMap[plan] ?? 0;
  if (!bpCap) return json_({ ok:false, reason:"unknown_plan" });

  // 回復量計算
  const currentBp = Number(targetSheet.getRange(hitRowIndex, idx["bp_balance"] + 1).getValue() || 0);
  const recover   = Math.min(Math.floor(bpCap * 0.5), Math.max(0, bpCap - currentBp));

  if (recover === 0) {
    // 上限超えでも bp_last_reset_at は更新する（次回30日後まで再チェックしない）
    targetSheet.getRange(hitRowIndex, idx["bp_last_reset_at"] + 1).setValue(new Date());
    return json_({ ok:true, bp_recovered:0, bp_balance:currentBp });
  }

  const newBp = currentBp + recover;
  targetSheet.getRange(hitRowIndex, idx["bp_balance"]       + 1).setValue(newBp);
  targetSheet.getRange(hitRowIndex, idx["bp_last_reset_at"] + 1).setValue(new Date());

  // wallet_ledger 記録
  appendWalletLedger_({ kind:"monthly_recover", login_id:loginId, amount:recover,
                        memo:"月次BP回復（cap=" + bpCap + "）" });

  return json_({ ok:true, bp_recovered:recover, bp_balance:newBp });
}
```

### `get_balance` への `bp_cap` 追加

```javascript
// 既存の return の直前に bp_cap を計算して追加
const BP_CAP_MAP      = { "34":300, "57":600, "114":1200, "567":6000, "1134":12000 };
const BP_CAP_MAP_5000 = { "500":1000, "2000":4000, "3000":8000, "5000":10000 };
const capMap = group_bal === "5000" ? BP_CAP_MAP_5000 : BP_CAP_MAP;
const bpCap  = capMap[str_(planRaw)] ?? 0;

return json_({ ok:true, bp, ep, plan: str_(planRaw), bp_cap: bpCap });
```

---

## Next.js 実装詳細

### `/api/wallet/recover/route.ts`（新規）

```typescript
// app/api/wallet/recover/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const loginId = String(body?.loginId ?? "");
  const group   = String(body?.group ?? "");

  if (!loginId) return NextResponse.json({ ok:false, error:"loginId_required" }, { status:400 });

  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;
  if (!gasUrl || !gasKey || !gasAdminKey)
    return NextResponse.json({ ok:false, error:"env_missing" }, { status:500 });

  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action:"monthly_bp_recover", adminKey:gasAdminKey, loginId, group }),
  }).catch(() => null);

  if (!res) return NextResponse.json({ ok:false, error:"failed" }, { status:502 });
  const data = await res.json().catch(() => ({ ok:false, error:"invalid_response" }));
  return NextResponse.json(data);
}
```

### `app/top/page.tsx` の変更箇所

```typescript
// 既存の daily_login_bonus fetch の直後に追加
if (loginId) {
  fetch("/api/wallet/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, group: (a as any)?.group || "" }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.bp_recovered > 0) {
        setBalanceTrigger(n => n + 1);
      }
    })
    .catch(() => {});
}
```

---

## 注意事項・既存コードへの影響

- `bp_last_reset_at` は GAS スキーマ定義済みのカラム。`ensureCols_` で既存シートにも自動追加される
- 新規ユーザーは `bp_last_reset_at` が空 → 初回ログイン時に即回復する（意図した動作）
- GAS側の `appendWalletLedger_` は既存関数をそのまま流用
- `/5000` ユーザーの `bp_last_reset_at` は `applies_5000` シートのカラム。`approveRowCore5000_` を変更せず、`monthly_bp_recover` 内の `ensureCols_` で列を保証する
- エラー・未知planはサイレントに無視（TOPページのUXを壊さない）
- BPパック購入（準備中）が実装されたときも、`bp_balance` 単一フィールドのまま動作する

---

## 将来の拡張（今回のスコープ外）

- 通常BP/追加BPの2フィールド分離（BPパック購入実装時に検討）
- GAS時間トリガーによる全ユーザー一括回復（ログインしないユーザーへの対応）
- 管理画面での回復状況確認
