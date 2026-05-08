# 紹介ダッシュボード ミニアプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/top` ページの紹介カードを、自分が紹介した人リスト・報酬履歴・合計を確認できるダッシュボードカードに拡張する。

**Architecture:** GAS に `my_referral_dashboard` action を追加（applies / wallet_ledger をスキャンして返却）。Next.js に `/api/referral/dashboard` プロキシを新規作成。`/top/page.tsx` 内の `ReferralCard` を `ReferralDashboardCard` に置き換える（既存のコピー機能は維持）。

**Tech Stack:** Google Apps Script (GAS), Next.js 14 App Router, TypeScript, Tailwind CSS

---

## ファイル構成

| ファイル | 種別 | 役割 |
|----------|------|------|
| `gas/Code.gs` | 修正 | `my_referral_dashboard` action を行 3254 の直後（`me` action の閉じ `}` の後）に追加 |
| `app/api/referral/dashboard/route.ts` | 新規作成 | GAS action `my_referral_dashboard` へのプロキシ |
| `app/top/page.tsx` | 修正 | `ReferralCard` 関数を `ReferralDashboardCard` に置き換え、呼び出し箇所を更新 |
| `CLAUDE.md` | 修正 | GAS actions テーブルに新 action を追記 |

---

## Task 1: GAS に `my_referral_dashboard` action を追加

**Files:**
- Modify: `gas/Code.gs` — 行 3254 の直後（`}` の後の空行、`login` action の前）に挿入

### 挿入位置の確認

現在 `gas/Code.gs` は以下の構造になっている：

```
行 3242-3254: me action の return json_({...}) と閉じ }
行 3255:      空行
行 3256-3258: // =========================================================
              // login（approved/pending/invalid + pw_hash照合）
              // =========================================================
行 3259:      if (action === "login") {
```

新しいブロックは **行 3255 の空行の直後、行 3256 の login コメントの直前** に挿入する。

- [ ] **Step 1: GAS ファイルに `my_referral_dashboard` ブロックを追加する**

`gas/Code.gs` の行 3254 の `}` の直後（行 3255 の空行位置）に以下のブロックを挿入する。

```javascript
  // =========================================================
  // my_referral_dashboard（自分が紹介した人リスト + 報酬履歴）
  // - me action と同じ認証（id + code の HMAC-SHA256 照合）
  // - approved のみデータを返す
  // =========================================================
  if (action === "my_referral_dashboard") {
    const id = str_(body.id);
    const code = str_(body.code);

    if (!id || !code) return json_({ ok: false, reason: "invalid" });

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id",
      "pw_hash",
      "email",
      "status",
      "plan",
      "approved_at",
      "referrer_login_id",
      "my_ref_code",
    ]);

    let values_rd = sheet.getDataRange().getValues();
    let header_rd = values_rd[0];
    const idx_rd = indexMap_(header_rd);
    const rows_rd = values_rd.slice(1);

    // 認証（me と同じ）
    let myLoginId = "";
    let myRefCode = "";

    for (let i = 0; i < rows_rd.length; i++) {
      const r = rows_rd[i];
      const loginId = str_(r[idx_rd["login_id"]]);
      const email = str_(r[idx_rd["email"]]);
      if (id !== loginId && id !== email) continue;

      const status = str_(r[idx_rd["status"]]);
      if (status !== "approved") return json_({ ok: false, reason: "pending" });

      const pwHashSaved = str_(r[idx_rd["pw_hash"]]);
      if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

      const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
      if (pwHashInput !== pwHashSaved) return json_({ ok: false, reason: "invalid" });

      myLoginId = loginId;
      myRefCode = str_(r[idx_rd["my_ref_code"]]);
      break;
    }

    if (!myLoginId) return json_({ ok: false, reason: "invalid" });

    // 自分が紹介した人（referrer_login_id == myLoginId）を収集
    const referrals = [];
    for (let i = 0; i < rows_rd.length; i++) {
      const r = rows_rd[i];
      if (str_(r[idx_rd["referrer_login_id"]]) !== myLoginId) continue;
      const refLoginId = str_(r[idx_rd["login_id"]]);
      if (!refLoginId) continue;
      const approvedAt = r[idx_rd["approved_at"]];
      referrals.push({
        login_id: refLoginId,
        plan: str_(r[idx_rd["plan"]]),
        approved_at: approvedAt ? new Date(approvedAt).toISOString() : "",
      });
    }

    // wallet_ledger からボーナス履歴取得
    const ss_rd = SpreadsheetApp.getActiveSpreadsheet();
    const ledger_rd = ss_rd.getSheetByName("wallet_ledger");
    const bonuses = [];
    let total_bonus = 0;

    if (ledger_rd) {
      const ledValues = getValuesSafe_(ledger_rd);
      if (ledValues.length >= 2) {
        const lHeader = ledValues[0];
        const lIdx = indexMap_(lHeader);
        const lRows = ledValues.slice(1);
        const BONUS_KINDS = ["referral_bonus", "referral_entry"];
        for (let i = 0; i < lRows.length; i++) {
          const r = lRows[i];
          const kind = str_(r[lIdx["kind"]]);
          const lid = str_(r[lIdx["login_id"]]);
          if (lid !== myLoginId) continue;
          if (!BONUS_KINDS.includes(kind)) continue;
          const amount = Number(r[lIdx["amount"]] || 0);
          const ts = r[lIdx["ts"]];
          bonuses.push({
            ts: ts ? new Date(ts).toISOString() : "",
            kind: kind,
            amount: amount,
            memo: str_(r[lIdx["memo"]]),
          });
          total_bonus += amount;
        }
      }
    }

    return json_({
      ok: true,
      my_ref_code: myRefCode,
      referrals: referrals,
      bonuses: bonuses,
      total_bonus: total_bonus,
    });
  }
```

- [ ] **Step 2: GAS コードを手動で確認する**

`gas/Code.gs` を開き、挿入したブロックが以下の位置にあることを確認する：
- `if (action === "me") {` ... `}` ブロックの **直後**
- `if (action === "login") {` ブロックの **直前**

また以下をチェックする：
- `hmacSha256Hex_(SECRET, ...)` — `SECRET` 変数が `handle_` 関数のスコープ内で定義されていること（`me` action も同じ変数を使っているので OK）
- `getValuesSafe_` — 既存関数があること（GAS 内で使われている）

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add my_referral_dashboard action"
```

---

## Task 2: Next.js API ルート `/api/referral/dashboard` を新規作成

**Files:**
- Create: `app/api/referral/dashboard/route.ts`

このファイルは `app/api/me/route.ts` とほぼ同じ構造。`action: "my_referral_dashboard"` を GAS に送り、レスポンスをそのまま返す。

- [ ] **Step 1: ディレクトリを作成してファイルを書く**

`app/api/referral/dashboard/route.ts` を新規作成する：

```typescript
// app/api/referral/dashboard/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DashboardRequest = {
  id?: string;
  code?: string;
};

type Referral = {
  login_id: string;
  plan: string;
  approved_at: string;
};

type Bonus = {
  ts: string;
  kind: string;
  amount: number;
  memo: string;
};

type GasDashboardResponse =
  | {
      ok: true;
      my_ref_code: string;
      referrals: Referral[];
      bonuses: Bonus[];
      total_bonus: number;
    }
  | {
      ok: false;
      reason?: "invalid" | "pending";
      error?: string;
    };

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function jsonError(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function safeReadJson(req: Request): Promise<DashboardRequest> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {};
    return (await req.json()) as DashboardRequest;
  } catch {
    return {};
  }
}

async function callGasDashboard(
  gasUrl: string,
  gasKey: string,
  id: string,
  code: string
): Promise<GasDashboardResponse> {
  const url = new URL(gasUrl);
  url.searchParams.set("key", gasKey);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "my_referral_dashboard", id, code }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: "bad_gas_json" };
    }

    if (data && data.ok === true) {
      return {
        ok: true,
        my_ref_code: str(data.my_ref_code),
        referrals: Array.isArray(data.referrals) ? data.referrals : [],
        bonuses: Array.isArray(data.bonuses) ? data.bonuses : [],
        total_bonus: Number(data.total_bonus || 0),
      };
    }

    return {
      ok: false,
      ...(data?.reason ? { reason: data.reason as "invalid" | "pending" } : {}),
      ...(data?.error ? { error: str(data.error) } : {}),
    };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "gas_timeout" : "gas_fetch_failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const gasUrl = process.env.GAS_WEBAPP_URL?.trim();
  const gasKey = process.env.GAS_API_KEY?.trim();

  if (!gasUrl) return jsonError(500, { ok: false, error: "GAS_WEBAPP_URL is missing" });
  if (!gasKey) return jsonError(500, { ok: false, error: "GAS_API_KEY is missing" });

  const body = await safeReadJson(req);
  const id = str(body.id).trim();
  const code = str(body.code).trim();

  if (!id || !code) {
    return jsonError(400, { ok: false, error: "id_and_code_required" });
  }

  const gasRes = await callGasDashboard(gasUrl, gasKey, id, code);

  if (gasRes.ok) {
    return NextResponse.json(
      { ok: true, dashboard: gasRes },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const failRes = gasRes as Extract<GasDashboardResponse, { ok: false }>;
  if (failRes.reason === "pending" || failRes.reason === "invalid") {
    return NextResponse.json(
      { ok: false, reason: failRes.reason },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  return jsonError(502, { ok: false, error: failRes.error || "unknown_error" });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, hint: "POST {id, code} to get referral dashboard" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
```

- [ ] **Step 2: 開発サーバーで API エンドポイントが起動することを確認**

```bash
npm run dev
```

ブラウザまたは curl で `GET http://localhost:3000/api/referral/dashboard` にアクセス：

期待レスポンス:
```json
{"ok":true,"hint":"POST {id, code} to get referral dashboard"}
```

- [ ] **Step 3: コミット**

```bash
git add app/api/referral/dashboard/route.ts
git commit -m "feat(api): add /api/referral/dashboard proxy route"
```

---

## Task 3: `/top/page.tsx` の `ReferralCard` を `ReferralDashboardCard` に置き換える

**Files:**
- Modify: `app/top/page.tsx`

`ReferralCard` 関数（行 172〜372 周辺）を削除し、同じ位置に `ReferralDashboardCard` を追加する。呼び出し箇所（`<ReferralCard auth={auth} />`）を `<ReferralDashboardCard auth={auth} />` に変更する。

- [ ] **Step 1: `ReferralCard` 関数を `ReferralDashboardCard` に置き換える**

`app/top/page.tsx` 内の以下の関数：

```
function ReferralCard({ auth }: { auth: AuthState }) {
  ...
}
```

を以下の `ReferralDashboardCard` 関数に置き換える。

（注意：この関数は大きいので、既存の `ReferralCard` 関数のブロック全体を削除して以下に置き換える）

```typescript
type ReferralDashboardData = {
  my_ref_code: string;
  referrals: { login_id: string; plan: string; approved_at: string }[];
  bonuses: { ts: string; kind: string; amount: number; memo: string }[];
  total_bonus: number;
};

function ReferralDashboardCard({ auth }: { auth: AuthState }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReferralDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<"code" | "url" | "">("");
  const [secretReady, setSecretReady] = useState("");
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    const s = getAuthSecret();
    if (s) {
      setSecretReady(s);
    } else {
      const t = setTimeout(() => {
        const retry = getAuthSecret();
        if (retry) setSecretReady(retry);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [auth]);

  const fetchDashboard = useCallback(async () => {
    if (fetched) return;

    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      (auth as any)?.email ||
      "";
    const code = secretReady || getAuthSecret() || "";

    if (!id) { setErr("no_id"); setLoading(false); return; }
    if (!code) { setErr("no_code_in_auth"); setLoading(false); return; }

    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/referral/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id, code }),
      });
      const json: any = await r.json().catch(() => ({ ok: false, error: "not_json" }));

      if (!json?.ok) {
        setErr(json?.reason || json?.error || "failed");
        return;
      }

      setData(json.dashboard);
      setFetched(true);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [auth, secretReady, fetched]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !fetched) fetchDashboard();
  };

  const copy = async (text: string, kind: "code" | "url") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      setErr("clipboard_failed");
    }
  };

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const is5000 = (auth as any)?.group === "5000";
  const purchasePath = is5000 ? "/5000" : "/purchase";
  const refCode = data?.my_ref_code || "";
  const refUrl = refCode ? `${base}${purchasePath}?refCode=${encodeURIComponent(refCode)}` : "";

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return iso;
    }
  };

  const formatAmount = (n: number) =>
    "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mt-4 rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(2,6,23,.08)] overflow-hidden">
      {/* プルタブ */}
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
      >
        <span className="text-xs font-extrabold text-slate-700">あなたの紹介コード</span>
        <span className="text-[10px] text-slate-400">{open ? "▲ 閉じる" : "▼ 開く"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">

          {/* ① 紹介コード & リンクコピー */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pt-3">
            <p className="text-xs text-slate-500">
              お友達を紹介する際は下記コードをお使いください。詳しい内容は『紹介プログラムページ』まで。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {loading ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  読み込み中…
                </span>
              ) : refCode ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-900">
                  {refCode}
                </span>
              ) : (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  取得できません
                </span>
              )}
              <button
                onClick={() => copy(refCode, "code")}
                disabled={!refCode}
                className={[
                  "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                  refCode
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                ].join(" ")}
              >
                {copied === "code" ? "コピーしました" : "コードをコピー"}
              </button>
              <button
                onClick={() => copy(refUrl, "url")}
                disabled={!refUrl}
                className={[
                  "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                  refUrl
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                ].join(" ")}
              >
                {copied === "url" ? "コピーしました" : "リンクをコピー"}
              </button>
            </div>
          </div>

          {refUrl && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold text-slate-500">共有リンク</p>
              <p className="mt-1 break-all text-xs font-semibold text-slate-700">{refUrl}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                紹介コードは登録後に紐づけることはできません。
              </p>
            </div>
          )}

          {err && !loading && (
            <p className="mt-3 text-[11px] font-semibold text-rose-600">
              エラー: {err}
              {err === "no_code_in_auth" && (
                <span className="ml-2 text-slate-500">（認証情報が不足しています。再ログインをお試しください。）</span>
              )}
            </p>
          )}

          {/* ② サマリー（データ取得後のみ） */}
          {data && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold text-slate-500">紹介した人</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{data.referrals.length} 人</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold text-slate-500">紹介報酬合計</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{formatAmount(data.total_bonus)}</p>
                </div>
              </div>

              {/* ③ 紹介した人リスト */}
              <div className="mt-4">
                <p className="text-xs font-extrabold text-slate-700 mb-2">紹介した人</p>
                {data.referrals.length === 0 ? (
                  <p className="text-xs text-slate-400">まだ紹介した人はいません</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">login ID</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">プラン</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">入会日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.referrals.map((r, i) => (
                          <tr key={r.login_id + i} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono text-slate-800">{r.login_id}</td>
                            <td className="px-3 py-2 text-slate-700">${r.plan}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(r.approved_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ④ 報酬履歴 */}
              <div className="mt-4">
                <p className="text-xs font-extrabold text-slate-700 mb-2">報酬履歴</p>
                {data.bonuses.length === 0 ? (
                  <p className="text-xs text-slate-400">まだ報酬履歴はありません</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">日時</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-600">金額</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">メモ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bonuses.map((b, i) => (
                          <tr key={b.ts + i} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(b.ts)}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatAmount(b.amount)}</td>
                            <td className="px-3 py-2 text-slate-500 text-[10px] break-all">{b.memo || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `useCallback` の import を確認・追加する**

`app/top/page.tsx` の先頭 import 行を確認する：

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
```

`useCallback` がすでに import されていることを確認する（既存の `BalanceBadge` や `ReferralCard` で使っていたので含まれているはず）。

- [ ] **Step 3: 呼び出し箇所を `ReferralDashboardCard` に変更する**

`app/top/page.tsx` 内の（`{/* 紹介コード（折りたたみ、デフォルト非表示） */}` の直下）

変更前:
```tsx
<ReferralCard auth={auth} />
```

変更後:
```tsx
<ReferralDashboardCard auth={auth} />
```

- [ ] **Step 4: 開発サーバーで動作確認**

```bash
npm run dev
```

1. `http://localhost:3000/login` でログイン
2. `/top` を開く
3. 「あなたの紹介コード ▼ 開く」をクリック
4. 以下を確認：
   - 紹介コードが表示される（既存機能）
   - 「コードをコピー」「リンクをコピー」が機能する（既存機能）
   - ローディング表示の後、サマリー・リスト・報酬履歴が表示される
   - 紹介実績なし → 「まだ紹介した人はいません」が表示される
   - 報酬なし → 「まだ報酬履歴はありません」が表示される
   - 認証情報が正しくない場合はエラーメッセージが出る

- [ ] **Step 5: コミット**

```bash
git add app/top/page.tsx
git commit -m "feat(top): replace ReferralCard with ReferralDashboardCard"
```

---

## Task 4: CLAUDE.md の GAS actions テーブルを更新

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md の GAS actions テーブルに新 action を追記**

`CLAUDE.md` 内の GAS actions テーブル（`| action | 呼び元 | 内容 |` で始まる表）に以下の行を追加する：

```markdown
| `my_referral_dashboard` | `/api/referral/dashboard` (POST) | 自分が紹介した人リスト＋報酬履歴・合計を返す |
```

追加位置は `music_boost_set_tracks` 行の直後（テーブル末尾）。

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add my_referral_dashboard to GAS actions table"
```

---

## Task 5: GAS デプロイ & E2E 動作確認

GAS の変更は Google Apps Script エディタでデプロイが必要。Next.js 側のみ先に確認することもできるが、GAS をデプロイしないと実際のデータは返らない。

- [ ] **Step 1: GAS をデプロイする**

1. [Google Apps Script エディタ](https://script.google.com/) を開く
2. `gas/Code.gs` の内容を貼り付けて保存
3. 「デプロイ → 新しいデプロイ」または「デプロイを管理 → 既存バージョンを更新」
4. デプロイ URL が変わらないことを確認（「既存のデプロイを更新」の場合は URL が同じ）

- [ ] **Step 2: `/top` で E2E テスト**

1. `http://localhost:3000/top` を開く（または Vercel の preview URL）
2. 「あなたの紹介コード ▼ 開く」をクリック
3. 以下を確認：
   - 紹介コードが表示される
   - サマリー（紹介した人 X 人 / 報酬合計 $Y）が表示される
   - 紹介リストに login_id・プラン・入会日が出る
   - 報酬履歴テーブルに日時・金額・メモが出る
4. コピーボタンを押してクリップボードに入ることを確認

- [ ] **Step 3: エラー状態を確認**

開発環境でネットワークタブを開き、`/api/referral/dashboard` のレスポンスを確認：
- `{ ok: true, dashboard: { my_ref_code: "...", referrals: [...], bonuses: [...], total_bonus: 0 } }` が期待形式

GAS が返す JSON が正しくない場合は GAS エディタの実行ログを確認する。

---

## Self-Review: Spec Coverage Check

| 仕様項目 | 対応タスク |
|----------|-----------|
| 紹介コード共有（コピー・リンクコピー） | Task 3 Step 1（`ReferralDashboardCard` ① セクション） |
| 紹介した人数・合計報酬のサマリー | Task 3 Step 1（② サマリーセクション） |
| 紹介した人リスト（login_id・プラン・入会日） | Task 1（GAS）+ Task 2（API）+ Task 3 Step 1（③ テーブル） |
| 報酬履歴リスト + 合計 | Task 1（GAS）+ Task 2（API）+ Task 3 Step 1（④ テーブル） |
| カード開いたときに lazy fetch | Task 3 Step 1（`handleOpen` → `fetchDashboard`、`fetched` フラグ） |
| wallet_ledger なし環境でも壊れない | Task 1 Step 1（`if (ledger_rd)` ガード） |
| name は返さない | Task 1（`referrals` に name フィールドなし） |
| CLAUDE.md 更新 | Task 4 |

全仕様項目をカバーしていることを確認。
