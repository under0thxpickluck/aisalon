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
  const monthKeys = Array.from(new Set(bonuses.map((b) => getMonthKey(b.ts)).filter(Boolean)))
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
                        <tr key={b.ts + b.kind + i} className="border-t border-slate-100">
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
              <div key={r.login_id + i} className="flex flex-col items-center">
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

// ─── Password Gate ────────────────────────────────────────────────────────────

const APP_PASSWORD = "nagoya01@";
const SESSION_KEY = "referral_app_authed";

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pw === APP_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onAuth();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B1220", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 32, width: "100%", maxWidth: 360 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 24, color: "#EAF0FF" }}>🤝 リファラ</h2>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="パスワードを入力"
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "#EAF0FF", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
        />
        {error && <p style={{ fontSize: 12, color: "#FCA5A5", textAlign: "center", marginBottom: 10 }}>パスワードが違います</p>}
        <button
          onClick={submit}
          style={{ width: "100%", padding: "13px", borderRadius: 14, background: "linear-gradient(90deg,#10B981,#0D9488)", border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
        >
          入室する
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReferralAppPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<"code" | "url" | "">("");
  const [qrOpen, setQrOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
  }, []);

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
    if (!authed) return;
    const t = setTimeout(() => fetchData(), 50);
    return () => clearTimeout(t);
  }, [authed, fetchData]);

  const copy = async (text: string, kind: "code" | "url") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setErr("クリップボードへのコピーに失敗しました");
    }
  };

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

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
                      <tr key={r.login_id + i} className="border-t border-slate-100">
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
