# アフィリエイト月次集計 設計仕様書

**作成日**: 2026-05-16  
**ステータス**: 仕様確定 / Phase 1 実装待ち / Phase 2 CC決済実装後に追加  

---

## 0. 背景・目的

紹介（アフィリエイト）報酬の月次集計を管理者が確認できるようにする。  
報酬のEP配布は自動化せず、管理者が手動で行う。本機能は**集計・閲覧専用**。

### 対象ルート（全統一）

| ルート | 説明 |
|---|---|
| メイン LIFAI（`/purchase`） | 既存の通常プラン入会 |
| /5000 ルート | 高額プラン（main シートに統合済み） |
| JamDAO ルート | 今後追加予定（同一ルールを適用） |

---

## 1. 分配率（全ルート統一）

### 1-1. 初回入金（プラン加入時の暗号通貨決済）

合計報酬率: **20%**

| 段 | 列名 | 報酬率 |
|---|---|---:|
| L1（直接紹介者） | `referrer_login_id` | 10% |
| L2 | `referrer_2_login_id` | 5% |
| L3 | `referrer_3_login_id` | 2% |
| L4 | `referrer_4_login_id` | 2% |
| L5 | `referrer_5_login_id` | 1% |

### 1-2. 内部決済（クレジットカード課金）

合計報酬率: **10%**

| 段 | 報酬率 |
|---|---:|
| L1 | 5% |
| L2 | 2.5% |
| L3 | 1% |
| L4 | 1% |
| L5 | 0.5% |

**対象となるCC決済（Phase 2 で追加）**:
- ミュージックブーストのクレジットカード契約・更新
- 会員メンバーシップページからのBP購入（クレジットカード）

---

## 2. EP換算式（固定レート）

```
amount_jpy = amount_usd × 145
reward_jpy = amount_jpy × rate_pct / 100
reward_ep  = Math.floor(reward_jpy × 4)
```

| パラメータ | 値 | 備考 |
|---|---|---|
| USD→JPY | 145 | 固定（`system_settings` シートで変更可） |
| EP/JPY | 4 | 固定（`system_settings` シートで変更可） |
| ランクによる差異 | なし | 全紹介者共通レートを適用 |

**計算例（$1,134プラン、L1紹介者）**:
```
1134 × 145 × 0.10 × 4 = 65,772 EP
```

---

## 3. 集計ルール

| 項目 | 定義 |
|---|---|
| 集計単位 | 月次（1日00:00〜末日23:59 JST） |
| 締め日 | 月末締め |
| 初回入金の判定日 | `applies.approved_at`（承認日）を使用 |
| CC決済の判定日 | `wallet_ledger.ts`（記録日）を使用（Phase 2） |
| 初回入金 | 1ユーザーにつき月をまたいでも1回のみ発生 |
| 内部決済 | 毎月繰り返し発生しうる |

---

## 4. データソース

### Phase 1（実装対象）: 初回入金

| データ | 取得元 |
|---|---|
| 承認済みユーザー一覧 | `applies` シート（`status = "approved"` かつ `approved_at` が対象月内） |
| 決済金額 | `applies.expected_paid`（空の場合は `plan` 列から `planToExpectedPaid_()` で推算） |
| 紹介チェーン | `applies.referrer_login_id` 〜 `applies.referrer_5_login_id` |

### Phase 2（CC決済実装後）: 内部決済

| データ | 取得元 |
|---|---|
| CC決済レコード | `wallet_ledger` シート（`kind = "cc_payment"` で新規追加予定） |
| 決済金額 | `wallet_ledger.amount`（USD） |
| 課金ユーザー | `wallet_ledger.login_id` → `applies` で紹介チェーンを引く |

#### CC決済時の `wallet_ledger` 登録フォーマット（Phase 2 仕様）

```json
{
  "ts": "2026-06-15T10:30:00.000Z",
  "kind": "cc_payment",
  "login_id": "lifai_XYZ",
  "email": "user@example.com",
  "amount": 29,
  "memo": "{\"product\":\"music_boost\",\"plan_id\":\"standard\",\"amount_usd\":29}"
}
```

> CC決済実装時に Stripe Webhook → GAS `cc_payment_record` アクションで `wallet_ledger` に記録する。  
> 既存の `music_boost_ep_renew` 等とは kind を分けて管理する。

---

## 5. GAS: `affiliate_monthly_summary` アクション

### 5-1. リクエスト

```json
{
  "action": "affiliate_monthly_summary",
  "adminKey": "...",
  "month": "2026-06"
}
```

### 5-2. 処理フロー

```
1. adminKey 検証
2. month を JST 日付範囲に変換（2026-06-01 00:00 〜 2026-06-30 23:59）
3. applies シートを全読み込み → indexMap_()
4. approved_at が対象月内の行を抽出
5. 各行について:
   a. expected_paid（or plan から推算）→ amountUsd を取得
   b. referrer_login_id 〜 referrer_5_login_id を読み取り
   c. 各段のレート（初回: [10,5,2,2,1]）で EP 計算
   d. referrer ごとに集計マップに加算
6. Phase 2: wallet_ledger の cc_payment を同様に集計
7. 集計マップを配列に変換して返す
```

### 5-3. レスポンス

```json
{
  "ok": true,
  "month": "2026-06",
  "usd_to_jpy": 145,
  "ep_per_jpy": 4,
  "referrers": [
    {
      "login_id": "lifai_ABC",
      "levels": [
        {
          "level": 1,
          "initial_usd": 5000,
          "initial_ep": 29000,
          "cc_usd": 0,
          "cc_ep": 0,
          "total_ep": 29000,
          "initial_sources": ["lifai_XYZ", "lifai_DEF"],
          "cc_sources": []
        },
        {
          "level": 2,
          "initial_usd": 1134,
          "initial_ep": 3289,
          "cc_usd": 0,
          "cc_ep": 0,
          "total_ep": 3289,
          "initial_sources": ["lifai_GHI"],
          "cc_sources": []
        },
        { "level": 3, "initial_usd": 0, "initial_ep": 0, "cc_usd": 0, "cc_ep": 0, "total_ep": 0, "initial_sources": [], "cc_sources": [] },
        { "level": 4, "initial_usd": 0, "initial_ep": 0, "cc_usd": 0, "cc_ep": 0, "total_ep": 0, "initial_sources": [], "cc_sources": [] },
        { "level": 5, "initial_usd": 0, "initial_ep": 0, "cc_usd": 0, "cc_ep": 0, "total_ep": 0, "initial_sources": [], "cc_sources": [] }
      ],
      "total_initial_usd": 6134,
      "total_initial_ep": 32289,
      "total_cc_usd": 0,
      "total_cc_ep": 0,
      "total_ep": 32289
    }
  ],
  "summary": {
    "total_initial_usd": 6134,
    "total_initial_ep": 32289,
    "total_cc_usd": 0,
    "total_cc_ep": 0,
    "total_ep": 32289,
    "referrer_count": 3
  }
}
```

---

## 6. Next.js API ルート

### `POST /api/admin/affiliate-summary`

```
ファイル: app/api/admin/affiliate-summary/route.ts
認証: middleware.ts が Admin Basic Auth を自動カバー
Body: { month: "2026-06" }
GAS: action = "affiliate_monthly_summary", adminKey = GAS_ADMIN_KEY
返却: GAS レスポンスをそのまま返す
```

---

## 7. 管理画面 UI

### 7-1. タブ追加

`app/admin/finance/page.tsx` に 4つ目のタブを追加：

```
ユーザー詳細 | アフィリエイト | 紹介ツリー | 月次集計（新規追加）
```

### 7-2. `MonthlyTab.tsx`（新規作成）

#### レイアウト

```
┌──────────────────────────────────────────────────────────────────────────┐
│  月選択: [2026年06月 ▼]  [表示する]                                      │
├────────────────────────────────────────────────────────────────────────── │
│  サマリカード                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐          │
│  │ 紹介者数          │ │ 初回入金合計(USD)  │ │ 合計アフィリエイト EP │    │
│  │ 3 人             │ │ $6,134           │ │ 35,578 EP        │          │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘          │
├────────────────────────────────────────────────────────────────────────── │
│  紹介者テーブル                                                            │
│  紹介者       │ 段 │ 初回売上(USD) │ 初回EP │ CC売上(USD) │ CC EP │ 合計EP │
│  ─────────────────────────────────────────────────────────────────────── │
│  lifai_ABC ▼  │合計│    $6,134    │32,289EP│    $0       │  0 EP │32,289EP│
│               │ L1 │    $5,000    │29,000EP│    $0       │  0 EP │29,000EP│
│               │ L2 │    $1,134    │ 3,289EP│    $0       │  0 EP │ 3,289EP│
│               │ L3 │       $0     │    0 EP│    $0       │  0 EP │    0 EP│
│               │ L4 │       $0     │    0 EP│    $0       │  0 EP │    0 EP│
│               │ L5 │       $0     │    0 EP│    $0       │  0 EP │    0 EP│
│  ─────────────────────────────────────────────────────────────────────── │
│  lifai_XYZ ▼  │合計│       $0     │    0 EP│    $0       │  0 EP │    0 EP│
│               │ ...│                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

#### UX仕様

| 項目 | 仕様 |
|---|---|
| 月選択 | `<select>` で過去12ヶ月 + 当月を選択可能 |
| デフォルト表示 | 当月（JST） |
| 行展開 | 紹介者行をクリックで L1〜L5 の内訳を展開/折畳み |
| CC列 | Phase 1 は `—` 表示（Phase 2 で数値に変わる） |
| ローディング | スケルトン表示 |
| データなし | 「対象期間のアフィリエイト発生なし」 |

---

## 8. 実装タスク

### Phase 1: 初回入金の月次集計

#### Task 1: GAS `system_settings` シート作成（未実装なら必要）

- [ ] Google スプレッドシートに `system_settings` シートを手動作成
  ```
  A列（key）         B列（value）
  usd_to_jpy         145
  ep_per_jpy         4
  affiliate_rate_1   10
  affiliate_rate_2   5
  affiliate_rate_3   2
  affiliate_rate_4   2
  affiliate_rate_5   1
  ```
- [ ] `getSystemSettings_()` 関数を `gas/Code.gs` に追加（`bunpai.md` 参照）

#### Task 2: GAS `affiliate_monthly_summary` アクション追加

**ファイル**: `gas/Code.gs`  
**挿入位置**: `ref_backfill_from_refcode` ブロックの直後

```js
// =========================================================
// ✅ affiliate_monthly_summary（管理：月次アフィリエイト集計）
// adminKey + month(YYYY-MM) を受け取り、対象月の紹介者別EP集計を返す
// =========================================================
if (action === "affiliate_monthly_summary") {
  if (str_(body.adminKey) !== ADMIN_SECRET) {
    return json_({ ok: false, error: "admin_unauthorized" });
  }

  const monthStr = str_(body.month); // "2026-06"
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return json_({ ok: false, error: "invalid_month_format" });
  }

  // JST 月範囲を UTC に変換
  const [yyyy, mm] = monthStr.split("-").map(Number);
  const startJst = new Date(Date.UTC(yyyy, mm - 1, 1, -9, 0, 0));   // 月初 00:00 JST
  const endJst   = new Date(Date.UTC(yyyy, mm,     1, -9, 0, 0));   // 翌月初 00:00 JST（exclusive）

  // settings 取得
  const settings  = getSystemSettings_();
  const usdToJpy  = settings.usdToJpy;
  const epPerJpy  = settings.epPerJpy;
  const initRates = settings.rates;                    // [10, 5, 2, 2, 1]
  const ccRates   = [5, 2.5, 1, 1, 0.5];              // 内部決済レート

  const sheet  = getOrCreateSheet_();
  const values = getValuesSafe_(sheet);
  const header = values[0];
  const idx    = indexMap_(header);

  const refCols = [
    "referrer_login_id",
    "referrer_2_login_id",
    "referrer_3_login_id",
    "referrer_4_login_id",
    "referrer_5_login_id",
  ];

  // referrer ごとの集計マップ
  // key: login_id, value: { levels: [{ initial_usd, initial_ep, cc_usd, cc_ep, sources }×5] }
  const referrerMap = {};

  const ensureReferrer = (loginId) => {
    if (!referrerMap[loginId]) {
      referrerMap[loginId] = {
        login_id: loginId,
        levels: Array.from({ length: 5 }, (_, i) => ({
          level: i + 1,
          initial_usd: 0,
          initial_ep:  0,
          cc_usd:      0,
          cc_ep:       0,
          total_ep:    0,
          initial_sources: [],
          cc_sources:      [],
        })),
      };
    }
    return referrerMap[loginId];
  };

  // --- 初回入金の集計 ---
  for (let ri = 1; ri < values.length; ri++) {
    const r          = values[ri];
    const status     = str_(r[idx["status"]]);
    const approvedAt = r[idx["approved_at"]];

    if (status !== "approved") continue;
    if (!approvedAt) continue;

    const approvedDate = new Date(approvedAt);
    if (approvedDate < startJst || approvedDate >= endJst) continue;

    // 金額取得
    let amountUsd = 0;
    if (idx["expected_paid"] !== undefined) {
      amountUsd = parseMoneyLike_(r[idx["expected_paid"]]);
    }
    if (!amountUsd && idx["plan"] !== undefined) {
      amountUsd = planToExpectedPaid_(str_(r[idx["plan"]]));
    }
    if (!amountUsd) continue;

    const childLoginId = str_(r[idx["login_id"]]);
    const amountJpy    = amountUsd * usdToJpy;

    for (let lvl = 0; lvl < 5; lvl++) {
      const colName = refCols[lvl];
      if (idx[colName] === undefined) continue;
      const refLoginId = str_(r[idx[colName]]);
      if (!refLoginId) continue;

      const ratePct  = initRates[lvl];
      const rewardEp = Math.floor(amountJpy * ratePct / 100 * epPerJpy);

      const entry = ensureReferrer(refLoginId);
      entry.levels[lvl].initial_usd += amountUsd;
      entry.levels[lvl].initial_ep  += rewardEp;
      entry.levels[lvl].total_ep    += rewardEp;
      if (childLoginId && !entry.levels[lvl].initial_sources.includes(childLoginId)) {
        entry.levels[lvl].initial_sources.push(childLoginId);
      }
    }
  }

  // --- Phase 2: CC決済の集計（wallet_ledger の kind="cc_payment"）---
  // ※ CC決済実装後にここを有効化する
  /*
  const ledgerSheet  = getOrCreateSheetByName_(SpreadsheetApp.getActiveSpreadsheet(), "wallet_ledger", []);
  const ledgerValues = getValuesSafe_(ledgerSheet);
  const ledgerHeader = ledgerValues[0];
  const ledgerIdx    = indexMap_(ledgerHeader);

  for (let ri = 1; ri < ledgerValues.length; ri++) {
    const r    = ledgerValues[ri];
    const kind = str_(r[ledgerIdx["kind"]]);
    if (kind !== "cc_payment") continue;

    const ts = new Date(r[ledgerIdx["ts"]]);
    if (ts < startJst || ts >= endJst) continue;

    const payerLoginId = str_(r[ledgerIdx["login_id"]]);
    const amountUsd    = Number(r[ledgerIdx["amount"]] || 0);
    if (!amountUsd || !payerLoginId) continue;

    // 支払者の referrer チェーンを applies から引く
    for (let ai = 1; ai < values.length; ai++) {
      if (str_(values[ai][idx["login_id"]]) !== payerLoginId) continue;

      const amountJpy = amountUsd * usdToJpy;
      for (let lvl = 0; lvl < 5; lvl++) {
        const colName    = refCols[lvl];
        if (idx[colName] === undefined) continue;
        const refLoginId = str_(values[ai][idx[colName]]);
        if (!refLoginId) continue;

        const ratePct  = ccRates[lvl];
        const rewardEp = Math.floor(amountJpy * ratePct / 100 * epPerJpy);

        const entry = ensureReferrer(refLoginId);
        entry.levels[lvl].cc_usd   += amountUsd;
        entry.levels[lvl].cc_ep    += rewardEp;
        entry.levels[lvl].total_ep += rewardEp;
        if (!entry.levels[lvl].cc_sources.includes(payerLoginId)) {
          entry.levels[lvl].cc_sources.push(payerLoginId);
        }
      }
      break;
    }
  }
  */

  // --- 集計マップを配列に変換 ---
  const referrers = Object.values(referrerMap).map((r) => {
    const totInitUsd = r.levels.reduce((s, l) => s + l.initial_usd, 0);
    const totInitEp  = r.levels.reduce((s, l) => s + l.initial_ep,  0);
    const totCcUsd   = r.levels.reduce((s, l) => s + l.cc_usd,  0);
    const totCcEp    = r.levels.reduce((s, l) => s + l.cc_ep,   0);
    return {
      ...r,
      total_initial_usd: totInitUsd,
      total_initial_ep:  totInitEp,
      total_cc_usd:      totCcUsd,
      total_cc_ep:       totCcEp,
      total_ep:          totInitEp + totCcEp,
    };
  }).sort((a, b) => b.total_ep - a.total_ep);

  const summary = {
    total_initial_usd: referrers.reduce((s, r) => s + r.total_initial_usd, 0),
    total_initial_ep:  referrers.reduce((s, r) => s + r.total_initial_ep,  0),
    total_cc_usd:      referrers.reduce((s, r) => s + r.total_cc_usd,  0),
    total_cc_ep:       referrers.reduce((s, r) => s + r.total_cc_ep,   0),
    total_ep:          referrers.reduce((s, r) => s + r.total_ep,      0),
    referrer_count:    referrers.length,
  };

  return json_({ ok: true, month: monthStr, usd_to_jpy: usdToJpy, ep_per_jpy: epPerJpy, referrers, summary });
}
```

- [ ] GASエディタで構文エラーなしを確認
- [ ] テスト実行: `{ action: "affiliate_monthly_summary", adminKey: "...", month: "2026-05" }`
- [ ] GAS 再デプロイ（新バージョンとしてデプロイ）

#### Task 3: Next.js API ルート追加

**ファイル**: `app/api/admin/affiliate-summary/route.ts`（新規作成）

```typescript
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body     = await req.json().catch(() => ({} as any));
    const { month } = body;
    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, error: "invalid_month" }, { status: 400 });
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "affiliate_monthly_summary", adminKey, month }),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] ファイル作成確認
- [ ] TypeScript エラーなし確認（`npx tsc --noEmit`）

#### Task 4: `MonthlyTab.tsx` 新規作成

**ファイル**: `app/admin/finance/MonthlyTab.tsx`

主要な state:
```typescript
const [month,    setMonth]    = useState<string>(currentMonth());  // "2026-06"
const [data,     setData]     = useState<SummaryData | null>(null);
const [loading,  setLoading]  = useState(false);
const [err,      setErr]      = useState<string | null>(null);
const [expanded, setExpanded] = useState<Set<string>>(new Set());
```

型定義:
```typescript
type LevelSummary = {
  level: number;
  initial_usd: number;
  initial_ep: number;
  cc_usd: number;
  cc_ep: number;
  total_ep: number;
  initial_sources: string[];
  cc_sources: string[];
};

type ReferrerSummary = {
  login_id: string;
  levels: LevelSummary[];
  total_initial_usd: number;
  total_initial_ep: number;
  total_cc_usd: number;
  total_cc_ep: number;
  total_ep: number;
};

type SummaryData = {
  month: string;
  usd_to_jpy: number;
  ep_per_jpy: number;
  referrers: ReferrerSummary[];
  summary: {
    total_initial_usd: number;
    total_initial_ep: number;
    total_cc_usd: number;
    total_cc_ep: number;
    total_ep: number;
    referrer_count: number;
  };
};
```

- [ ] コンポーネント作成
- [ ] 月選択（過去12ヶ月 + 当月）
- [ ] サマリカード3枚（紹介者数 / 初回入金合計USD / 合計EP）
- [ ] 紹介者テーブル（合計行 + L1〜L5 展開）
- [ ] CC列は Phase 1 では `—` 表示

#### Task 5: `page.tsx` にタブ追加

**ファイル**: `app/admin/finance/page.tsx`

```typescript
// Tab型に追加
type Tab = "users" | "affiliate" | "tree" | "monthly";

// tabs配列に追加
{ key: "monthly", label: "月次集計" }

// コンテンツに追加
{activeTab === "monthly" && <MonthlyTab />}
```

- [ ] タブ追加確認
- [ ] 動作確認（dev server）

---

### Phase 2: CC決済の内部集計追加（CC実装後に着手）

#### CC決済実装時にやること

- [ ] Stripe Webhook ルート（`app/api/stripe/webhook/route.ts`）実装
- [ ] GAS `cc_payment_record` アクション実装（`wallet_ledger` に `kind: "cc_payment"` で記録）
- [ ] `musicBoostSubscribe_` に CC 決済分岐を追加
- [ ] BPのCC購入フロー実装
- [ ] `affiliate_monthly_summary` 内の Phase 2 コメントアウトブロックを有効化
- [ ] `MonthlyTab.tsx` の CC 列を実値表示に切り替え（`—` → 数値）

---

## 9. 関連ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | 追記 | `affiliate_monthly_summary` アクション追加 |
| `gas/Code.gs` | 追記（後で） | `getSystemSettings_()` 追加（`bunpai.md` Task 1） |
| `app/api/admin/affiliate-summary/route.ts` | 新規 | Next.js API ルート |
| `app/admin/finance/MonthlyTab.tsx` | 新規 | 月次集計タブコンポーネント |
| `app/admin/finance/page.tsx` | 修正 | タブ追加 |

---

## 10. 未実装・将来対応事項

| 項目 | 対応方針 |
|---|---|
| CC決済（Music Boost CC / BP CC購入） | Phase 2: Stripe 導入後に `cc_payment_record` GAS アクションと合わせて有効化 |
| JamDAO 専用ルート | 同一 applies シートを使うなら自動対応、専用シートなら追加集計が必要 |
| `bunpai.md` の `grantAffiliateEp_` 自動付与 | 本機能とは独立。本仕様は閲覧のみ（手動配布） |
| EP 配布記録 | 管理者が手動で付与した後、`wallet_ledger` に `affiliate_reward` として記録される |
| `referrer_4_login_id` / `referrer_5_login_id` | `bunpai.md` Task 2 の列追加が必要（未実装の場合は L4/L5 が 0 になる） |
