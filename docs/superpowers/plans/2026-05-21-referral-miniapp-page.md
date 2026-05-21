# 紹介ミニアプリ独立ページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/referral-app` 独立ページを新設し、紹介コードのシェア・サマリー・月別報酬・紹介リスト・ツリーを1ページで表示する。あわせて `/top` の折りたたみカードを削除してアプリグリッドに「リファラ」エントリーを追加する。

**Architecture:** 既存の `POST /api/referral/dashboard` と GAS `my_referral_dashboard` action をそのまま流用する。新ページはクライアントコンポーネントとして `app/referral-app/page.tsx` に実装。認証は `getAuth()` + `getAuthSecret()` パターン（`app/lib/auth.ts`）。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, qrcode.react

---

## File Map

| ファイル | 種別 | 内容 |
|----------|------|------|
| `app/referral-app/page.tsx` | 新規 | 独立ページ本体（全セクション） |
| `app/top/page.tsx` | 修正 | `ReferralDashboardCard` 削除、apps に「リファラ」追加 |
| `package.json` / `package-lock.json` | 修正 | `qrcode.react` 追加 |

---

## Task 1: qrcode.react をインストール

**Files:**
- Modify: `package.json`

- [ ] **Step 1: インストール**

```bash
npm install qrcode.react
```

- [ ] **Step 2: 型が同梱されていることを確認**

```bash
ls node_modules/qrcode.react/lib/*.d.ts
```
`index.d.ts` または `types.d.ts` が存在すること。もし存在しない場合は `npm install --save-dev @types/qrcode.react` を追加で実行。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "feat(referral-app): add qrcode.react dependency"
```

---

## Task 2: `/referral-app/page.tsx` を作成

**Files:**
- Create: `app/referral-app/page.tsx`

**前提知識:**
- `getAuth()` は `localStorage` の `addval_auth_v1` から `{ status, id, token, group? }` を返す
- `getAuthSecret()` は `sessionStorage` の `addval_auth_secret_v1` からパスワードを返す
- API `POST /api/referral/dashboard` のレスポンス: `{ ok: true, dashboard: { my_ref_code, referrals, bonuses, total_bonus } }`
- `is5000` の判定: `(auth as any)?.group === "5000"` → 購入パスを `/5000` にする

- [ ] **Step 1: ファイルを作成**

`app/referral-app/page.tsx` を以下の内容で作成:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import { QRCodeSVG } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type DashboardData = {
  my_ref_code: string;
  referrals: Referral[];
  bonuses: Bonus[];
  total_bonus: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskId(id: string): string {
  if (id.length <= 4) return id;
  return id.slice(0, 2) + "***" + id.slice(-2);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

function formatAmount(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthKey(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getPrevMonthKey(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function kindLabel(kind: string): string {
  if (kind === "referral_bonus") return "紹介報酬";
  if (kind === "referral_entry") return "入会報酬";
  return kind;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}

// ─── MonthlyBonuses ───────────────────────────────────────────────────────────

function MonthlyBonuses({ bonuses }: { bonuses: Bonus[] }) {
  const monthKeys = [...new Set(bonuses.map((b) => getMonthKey(b.ts)).filter(Boolean))]
    .sort()
    .reverse();

  const [openMonths, setOpenMonths] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (monthKeys[0]) s.add(monthKeys[0]);
    return s;
  });

  if (monthKeys.length === 0) return null;

  const toggle = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <p className="px-4 pt-3 pb-2 text-xs font-extrabold text-slate-700">月別報酬</p>
      {monthKeys.map((key) => {
        const mb = bonuses.filter((b) => getMonthKey(b.ts) === key);
        const total = mb.reduce((s, b) => s + b.amount, 0);
        const isOpen = openMonths.has(key);
        return (
          <div key={key} className="border-t border-slate-100">
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
            >
              <span className="text-xs font-bold text-slate-700">{getMonthLabel(key)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-700">{formatAmount(total)}</span>
                <span className="text-[10px] text-slate-400">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-3">
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-bold text-slate-500">日付</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">種別</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-500">金額</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">メモ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mb.map((b, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatDate(b.ts)}</td>
                          <td className="px-3 py-2 text-slate-700">{kindLabel(b.kind)}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatAmount(b.amount)}</td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{b.memo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ReferralTree ─────────────────────────────────────────────────────────────

function ReferralTree({ referrals }: { referrals: Referral[] }) {
  if (referrals.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-extrabold text-slate-700 mb-4">紹介ツリー</p>
      <div className="overflow-x-auto">
        <div className="flex flex-col items-center min-w-fit py-2">
          <div className="rounded-xl bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-sm">
            あなた
          </div>
          <div className="flex gap-4 mt-4 items-start justify-center flex-wrap">
            {referrals.map((r, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-300" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
                  {maskId(r.login_id)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReferralAppPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<"code" | "url" | "">("");
  const [qrOpen, setQrOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    const auth = getAuth();
    if (!auth || auth.status !== "approved") {
      router.replace("/login");
      return;
    }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    if (!id || !code) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/referral/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id, code }),
      });
      const json: any = await res.json().catch(() => ({ ok: false, error: "not_json" }));
      if (!json?.ok) {
        if (json?.reason === "pending") router.replace("/login");
        else setErr(json?.error || json?.reason || "failed");
        return;
      }
      setData(json.dashboard);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // sessionStorage が hydrate するまで少し待つ（ReferralDashboardCard と同じパターン）
    const t = setTimeout(() => fetchData(), 50);
    return () => clearTimeout(t);
  }, [fetchData]);

  const copy = async (text: string, kind: "code" | "url") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setErr("clipboard_failed");
    }
  };

  const auth = getAuth();
  const is5000 = (auth as any)?.group === "5000";
  const purchasePath = is5000 ? "/5000" : "/purchase";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refCode = data?.my_ref_code || "";
  const refUrl = refCode ? `${origin}${purchasePath}?refCode=${encodeURIComponent(refCode)}` : "";

  const currentKey = getCurrentMonthKey();
  const prevKey = getPrevMonthKey();
  const currentMonthBonus = data
    ? data.bonuses.filter((b) => getMonthKey(b.ts) === currentKey).reduce((s, b) => s + b.amount, 0)
    : 0;
  const prevMonthBonus = data
    ? data.bonuses.filter((b) => getMonthKey(b.ts) === prevKey).reduce((s, b) => s + b.amount, 0)
    : 0;

  const visibleReferrals = showAll
    ? (data?.referrals ?? [])
    : (data?.referrals ?? []).slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* QR モーダル */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold text-slate-600">紹介リンク QR</p>
            <QRCodeSVG value={refUrl || "https://lifai.vercel.app"} size={220} />
            <p className="text-[10px] text-slate-400 break-all text-center max-w-[220px]">{refUrl}</p>
            <button
              onClick={() => setQrOpen(false)}
              className="mt-2 text-xs text-slate-400 hover:text-slate-600"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <Link href="/top" className="text-slate-400 hover:text-slate-600 text-sm">← 戻る</Link>
          <h1 className="text-sm font-extrabold text-slate-800">リファラ</h1>
        </div>

        {/* ① シェアカード */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-extrabold text-slate-700">あなたの紹介コード</p>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-extrabold text-slate-900 tracking-widest">
                  {refCode || "—"}
                </span>
                <button
                  onClick={() => copy(refCode, "code")}
                  disabled={!refCode}
                  className="rounded-xl bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-600 transition disabled:opacity-40"
                >
                  {copied === "code" ? "コピーしました ✓" : "コードをコピー"}
                </button>
                <button
                  onClick={() => copy(refUrl, "url")}
                  disabled={!refUrl}
                  className="rounded-xl bg-slate-700 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition disabled:opacity-40"
                >
                  {copied === "url" ? "コピーしました ✓" : "リンクをコピー"}
                </button>
                <button
                  onClick={() => setQrOpen(true)}
                  disabled={!refUrl}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-40"
                >
                  QR
                </button>
              </div>
              {refUrl && <p className="text-[10px] text-slate-400 break-all">{refUrl}</p>}
              <p className="text-[10px] text-slate-400">
                紹介コードは登録後に紐づけることはできません。
                <Link href="/referral" className="ml-1 text-emerald-600 underline">
                  紹介プログラムとは？
                </Link>
              </p>
            </>
          )}
        </div>

        {/* ② サマリー（2×2） */}
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-[10px] font-bold text-slate-500">紹介した人</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{data?.referrals.length ?? 0} 人</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-[10px] font-bold text-slate-500">報酬合計</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatAmount(data?.total_bonus ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-[10px] font-bold text-slate-500">今月の報酬</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{formatAmount(currentMonthBonus)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-[10px] font-bold text-slate-500">先月の報酬</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{formatAmount(prevMonthBonus)}</p>
              </div>
            </>
          )}
        </div>

        {/* エラー表示 */}
        {err && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            データの取得に失敗しました。
            <button
              onClick={() => { setErr(""); fetchData(); }}
              className="ml-2 underline"
            >
              再試行
            </button>
          </div>
        )}

        {/* ③ 月別報酬 */}
        {!loading && data && data.bonuses.length > 0 && (
          <MonthlyBonuses bonuses={data.bonuses} />
        )}

        {/* ④ 紹介した人リスト */}
        {!loading && data && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-xs font-extrabold text-slate-700">紹介した人</p>
            {data.referrals.length === 0 ? (
              <div className="px-4 pb-4 flex flex-col items-center gap-3 text-center">
                <p className="text-xs text-slate-400">まだ紹介した人はいません</p>
                <button
                  onClick={() => copy(refUrl, "url")}
                  disabled={!refUrl}
                  className="rounded-xl bg-emerald-500 text-white px-4 py-2 text-xs font-bold hover:bg-emerald-600 transition disabled:opacity-40"
                >
                  {copied === "url" ? "コピーしました ✓" : "コードをシェアする"}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">ID</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">プラン</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">入会日</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReferrals.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-mono text-slate-700">{maskId(r.login_id)}</td>
                        <td className="px-3 py-2 text-slate-700">${r.plan}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(r.approved_at)}</td>
                        <td className="px-3 py-2 text-emerald-600">✅ 承認済み</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!showAll && data.referrals.length > 5 && (
                  <div className="px-4 py-2 border-t border-slate-100">
                    <button
                      onClick={() => setShowAll(true)}
                      className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                      もっと見る（あと {data.referrals.length - 5} 人）
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ⑤ 紹介ツリー */}
        {!loading && data && data.referrals.length > 0 && (
          <ReferralTree referrals={data.referrals} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: ビルドエラーがないか確認**

```bash
npm run build 2>&1 | tail -30
```
Expected: エラーなし（warnings は可）。`qrcode.react` の import エラーが出た場合は `QRCodeSVG` を `QRCode` に変えて再確認。

- [ ] **Step 3: コミット**

```bash
git add app/referral-app/page.tsx
git commit -m "feat(referral-app): add independent referral dashboard page"
```

---

## Task 3: `/top/page.tsx` を修正

**Files:**
- Modify: `app/top/page.tsx:166-425` — `ReferralDashboardData` 型と `ReferralDashboardCard` 関数を削除
- Modify: `app/top/page.tsx:628-644` — apps 配列に「リファラ」エントリー追加
- Modify: `app/top/page.tsx:851-852` — `<ReferralDashboardCard auth={auth} />` 呼び出しを削除

- [ ] **Step 1: `ReferralDashboardData` 型と `ReferralDashboardCard` 関数を削除**

`app/top/page.tsx` の以下の範囲を削除する（行 166〜425）:

削除対象の開始行（old_string の先頭）:
```
type ReferralDashboardData = {
  my_ref_code: string;
  referrals: { login_id: string; plan: string; approved_at: string }[];
  bonuses: { ts: string; kind: string; amount: number; memo: string }[];
  total_bonus: number;
};

function ReferralDashboardCard({ auth }: { auth: AuthState }) {
```

削除対象の終了行（old_string の末尾）:
```
}

// ── お知らせデータ（空配列のときは「なし」表示） ────────────────────
```

new_string（型・関数を除いた後の接続）:
```

// ── お知らせデータ（空配列のときは「なし」表示） ────────────────────
```

- [ ] **Step 2: `<ReferralDashboardCard auth={auth} />` の呼び出しを削除**

削除対象:
```tsx
          {/* 紹介コード（折りたたみ、デフォルト非表示） */}
          <ReferralDashboardCard auth={auth} />

```

new_string（空文字に置換）:
```tsx
```

- [ ] **Step 3: apps 配列に「リファラ」エントリーを追加**

`apps` 配列の `gift` エントリーの直前に追加:

変更前:
```typescript
      { id: "gift",          label: "GiftEP",   icon: "🎁", color: "from-emerald-400 to-teal-500",  href: "/gift",       desc: "EP贈与 · LIFAI内限定ギフトクレジット" },
```

変更後:
```typescript
      { id: "referral",      label: "リファラ",  icon: "🤝", color: "from-emerald-500 to-teal-600",  href: "/referral-app", desc: "紹介実績・報酬・コード共有" },
      { id: "gift",          label: "GiftEP",   icon: "🎁", color: "from-emerald-400 to-teal-500",  href: "/gift",       desc: "EP贈与 · LIFAI内限定ギフトクレジット" },
```

- [ ] **Step 4: ビルドエラーがないか確認**

```bash
npm run build 2>&1 | tail -30
```
Expected: エラーなし。`ReferralDashboardCard` の未定義エラーや `ReferralDashboardData` の参照エラーが出た場合は残存箇所を検索して削除:
```bash
grep -n "ReferralDashboard" app/top/page.tsx
```

- [ ] **Step 5: コミット**

```bash
git add app/top/page.tsx
git commit -m "feat(referral-app): remove inline referral card, add referral app to grid"
```

---

## 動作確認チェックリスト

実装後に以下を手動で確認する:

- [ ] `/top` アプリグリッドに「🤝 リファラ」が表示される
- [ ] 「リファラ」タップで `/referral-app` に遷移する
- [ ] `/referral-app` でシェアカードが表示される（コード・コピーボタン・QRボタン）
- [ ] QRボタンタップでモーダルが開き、QRコードが表示される
- [ ] コピーボタンが「コピーしました ✓」に変化して1.5秒後に戻る
- [ ] サマリーの4カードが表示される
- [ ] `← 戻る` で `/top` に戻れる
- [ ] `/top` に折りたたみ紹介カードが表示されないこと
