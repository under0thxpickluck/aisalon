"use client";

import { useEffect, useMemo, useState } from "react";

type ApplyRow = {
  created_at?: string;
  plan?: string | number;
  email?: string;
  name?: string;
  name_kana?: string;
  ref_name?: string;
  ref_id?: string | number;
  region?: string;
  status?: string;
  // 追加があっても壊れない
  [k: string]: any;
};

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function formatDate(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const [rows, setRows] = useState<ApplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pendingRows = useMemo(
    () => rows.filter((r) => (r.status ?? "pending") === "pending"),
    [rows]
  );

  const load = async () => {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      // ✅ 既存のAPIに合わせてここを変えてOK
      const res = await fetch("/api/admin/pending", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "failed");
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (row: ApplyRow) => {
    setErr(null);
    setMsg(null);

    const key = `${row.email ?? ""}_${row.created_at ?? ""}`;
    setBusyKey(key);

    try {
      // ✅ 既存のAPIに合わせてここを変えてOK
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: row.email,
          created_at: row.created_at,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "approve_failed");
      }

      // ワンタイムコードが返ってくる想定（返ってこなくてもOK）
      const code = json?.oneTimeCode || json?.code || "";
      if (code) {
        await copyToClipboard(code);
        setMsg(`承認しました。ワンタイムコードをコピーしました：${code}`);
      } else {
        setMsg("承認しました。");
      }

      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="min-h-screen text-slate-900">
      {/* 背景：白系で読みやすく */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_-10%,rgba(99,102,241,.18),transparent_60%),radial-gradient(820px_560px_at_115%_0%,rgba(34,211,238,.14),transparent_55%),linear-gradient(180deg,#FFFFFF,#F4F7FF_55%,#FFFFFF)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.12) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="mx-auto max-w-[1100px] px-4 py-10">
        {/* ヘッダー */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              管理者エリア
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight">LIFAI 管理</h1>
            <p className="mt-1 text-sm text-slate-600">
              pending の申請一覧 → 承認 → ワンタイム発行（必要なら自動コピー）
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className={clsx(
                "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition",
                loading ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50"
              )}
            >
              {loading ? "読み込み中…" : "再読み込み"}
            </button>
          </div>
        </header>

        {/* 通知 */}
        {msg ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {msg}
          </div>
        ) : null}
        {err ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            エラー：{err}
          </div>
        ) : null}

        {/* サマリー */}
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="pending 件数" value={String(pendingRows.length)} />
          <StatCard label="合計行数" value={String(rows.length)} />
          <StatCard
            label="状態"
            value={loading ? "loading" : "ready"}
            tone={loading ? "slate" : "indigo"}
          />
        </section>

        {/* メインカード */}
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(2,6,23,.10)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-slate-900">pending 一覧</div>
            <div className="text-xs text-slate-500">
              表が見にくい問題を解消：列整列 / 省略 / スマホ縦対応
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <EmptyState title="読み込み中…" desc="スプレッドシートからデータを取得しています。" />
            ) : pendingRows.length === 0 ? (
              <EmptyState title="pending はありません" desc="申請が入るとここに表示されます。" />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-xs font-extrabold text-slate-700">
                        <Th>日時</Th>
                        <Th>プラン</Th>
                        <Th>氏名</Th>
                        <Th>メール</Th>
                        <Th>紹介</Th>
                        <Th>地域</Th>
                        <Th className="text-right">操作</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRows.map((r, i) => {
                        const key = `${r.email ?? ""}_${r.created_at ?? ""}_${i}`;
                        const busy = busyKey === `${r.email ?? ""}_${r.created_at ?? ""}`;
                        return (
                          <tr key={key} className="border-t border-slate-200">
                            <Td className="whitespace-nowrap text-slate-700">
                              {formatDate(r.created_at)}
                            </Td>
                            <Td className="whitespace-nowrap font-bold text-slate-900">
                              {String(r.plan ?? "")}
                            </Td>
                            <Td className="max-w-[220px]">
                              <div className="font-bold text-slate-900">{r.name ?? ""}</div>
                              <div className="text-xs text-slate-500">{r.name_kana ?? ""}</div>
                            </Td>
                            <Td className="max-w-[260px]">
                              <div className="truncate font-semibold text-slate-800">{r.email ?? ""}</div>
                              <button
                                className="mt-1 text-xs font-bold text-indigo-600 hover:underline"
                                onClick={async () => {
                                  if (!r.email) return;
                                  const ok = await copyToClipboard(String(r.email));
                                  setMsg(ok ? "メールをコピーしました" : "コピーに失敗しました");
                                }}
                              >
                                コピー
                              </button>
                            </Td>
                            <Td className="max-w-[220px]">
                              <div className="truncate text-slate-800">
                                {r.ref_name ? (
                                  <span className="font-semibold">{r.ref_name}</span>
                                ) : (
                                  <span className="text-slate-400">（なし）</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                {r.ref_id ? `ID: ${r.ref_id}` : ""}
                              </div>
                            </Td>
                            <Td className="whitespace-nowrap font-semibold text-slate-800">
                              {r.region ?? ""}
                            </Td>
                            <Td className="whitespace-nowrap p-3 text-right">
                              <button
                                onClick={() => approve(r)}
                                disabled={busy}
                                className={clsx(
                                  "rounded-xl px-4 py-2 text-sm font-extrabold text-white transition",
                                  busy
                                    ? "cursor-not-allowed bg-slate-300"
                                    : "bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 active:scale-[0.99]"
                                )}
                              >
                                {busy ? "処理中…" : "承認して発行"}
                              </button>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* スマホ用の補助 */}
                <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                  ※ スマホは横スクロール対応（表が崩れません）
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-slate-400">© LIFAI</footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone = "emerald",
}: {
  label: string;
  value: string;
  tone?: "emerald" | "indigo" | "slate";
}) {
  const dot =
    tone === "emerald" ? "bg-emerald-500" : tone === "indigo" ? "bg-indigo-500" : "bg-slate-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
        <span className={clsx("h-2 w-2 rounded-full", dot)} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
      <div className="text-sm font-extrabold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
    </div>
  );
}

function Th({ children, className }: { children: any; className?: string }) {
  return <th className={clsx("px-3 py-3", className)}>{children}</th>;
}
function Td({ children, className }: { children: any; className?: string }) {
  return <td className={clsx("px-3 py-3 align-top", className)}>{children}</td>;
}
