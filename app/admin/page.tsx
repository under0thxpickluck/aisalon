"use client";

import { useEffect, useMemo, useState } from "react";

// ─── 型定義 ───────────────────────────────────────────────
type SellRequest = {
  request_id: string;
  user_id: string;
  seller_id?: string;
  user_name?: string;
  item_id: string;
  item_title?: string;
  requested_at: string;
  status?: string;
};

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
  rowIndex?: number;
  [k: string]: any;
};

type MemberRow = {
  login_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  created_at: string;
  bp_balance: number;
  ep_balance: number;
  login_streak: number;
  total_login_count: number;
  subscription_plan: string;
  last_login_at: string;
};

type Summary = {
  total_members: number;
  pending_count: number;
  total_bp_issued: number;
  total_ep_issued: number;
};

type StakingSummary = {
  active_count: number;
  total_staked_bp: number;
  claimable_count: number;
};

type GachaSummary = {
  total_spins: number;
  total_cost_bp: number;
  total_prize_bp: number;
};

type RadioSummary = {
  total_submissions: number;
  total_ep_granted: number;
};

type DashboardData = {
  summary: Summary;
  staking_summary: StakingSummary;
  gacha_summary: GachaSummary;
  radio_summary: RadioSummary;
};

// ─── ユーティリティ ────────────────────────────────────────
function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh  = String(d.getHours()).padStart(2, "0");
  const mm  = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

// ─── サブコンポーネント ────────────────────────────────────
function SummaryCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="mb-1 text-sm text-zinc-400">{icon} {label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={clsx("text-sm font-bold", color ?? "text-white")}>{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-2xl bg-zinc-800" />;
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={clsx("whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-zinc-400", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={clsx("px-3 py-3 align-top text-sm text-zinc-200", className)}>{children}</td>;
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-6">
      <p className="text-sm font-bold text-zinc-200">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{desc}</p>
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────────
export default function AdminPage() {
  // --- 既存: pending 申請 ---
  const [rows,     setRows]     = useState<ApplyRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busyKey,  setBusyKey]  = useState<string | null>(null);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [err,      setErr]      = useState<string | null>(null);

  // --- 既存: 売却申請 ---
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [sellLoading,  setSellLoading]  = useState(false);
  const [sellErr,      setSellErr]      = useState<string | null>(null);
  const [sellMsg,      setSellMsg]      = useState<string | null>(null);
  const [grantingId,   setGrantingId]   = useState<string | null>(null);
  const [bpInputs,     setBpInputs]     = useState<Record<string, string>>({});

  // --- 新規: ダッシュボード ---
  const [dashboard,    setDashboard]    = useState<DashboardData | null>(null);
  const [dashLoading,  setDashLoading]  = useState(true);

  // --- 新規: 会員一覧 ---
  const [members,      setMembers]      = useState<MemberRow[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage,  setMembersPage]  = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);
  const PAGE_SIZE = 20;

  // ── データ取得 ────────────────────────────────────────────
  const load = async () => {
    setErr(null); setMsg(null); setLoading(true);
    try {
      const res  = await fetch("/api/admin/list", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "failed");
      const arr = Array.isArray(json.items) ? json.items : Array.isArray(json.rows) ? json.rows : [];
      setRows(arr);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const loadSellRequests = async () => {
    setSellLoading(true); setSellErr(null);
    try {
      const res  = await fetch("/api/admin/sell-requests", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "failed");
      const arr = Array.isArray(json.items) ? json.items : Array.isArray(json.requests) ? json.requests : [];
      setSellRequests(arr);
    } catch (e: any) {
      setSellErr(String(e?.message ?? e));
    } finally {
      setSellLoading(false);
    }
  };

  const loadDashboard = async () => {
    setDashLoading(true);
    try {
      const res  = await fetch("/api/admin/dashboard", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setDashboard(json as DashboardData);
    } catch {
      // サイレント失敗
    } finally {
      setDashLoading(false);
    }
  };

  const loadMembers = async (page = 0) => {
    setMembersLoading(true);
    try {
      const res  = await fetch(`/api/admin/members?page=${page}&pageSize=${PAGE_SIZE}`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setMembers(json.members ?? []);
        setMembersTotal(json.total ?? 0);
        setMembersPage(page);
      }
    } catch {
      // サイレント失敗
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadSellRequests();
    loadDashboard();
    loadMembers(0);
  }, []);

  // ── pending 一覧 ──────────────────────────────────────────
  const pendingRows = useMemo(
    () => rows.filter((r) => {
      const st = String(r.status ?? "pending");
      return st === "pending" || st === "paid" || st === "pending_payment";
    }),
    [rows]
  );

  const approve = async (row: ApplyRow) => {
    setErr(null); setMsg(null);
    const key = `${row.email ?? ""}_${row.created_at ?? ""}`;
    setBusyKey(key);
    try {
      const rowIndex = Number(row.rowIndex || 0);
      if (!rowIndex || rowIndex < 2) throw new Error("rowIndex_missing");
      const res  = await fetch("/api/admin/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "approve_failed");
      const loginId      = String(json?.loginId || "");
      const tempPassword = String(json?.tempPassword || "");
      const code         = String(json?.oneTimeCode || json?.code || "");
      if (loginId && tempPassword) {
        const payload = `ID: ${loginId}\nPW: ${tempPassword}`;
        await copyToClipboard(payload);
        setMsg(`承認しました。ワンタイムコードをコピーしました：${payload}`);
      } else if (code) {
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

  // ── BP付与 ────────────────────────────────────────────────
  const handleGrantBp = async (req: SellRequest) => {
    const bp = Number(bpInputs[req.request_id] ?? "");
    if (!bp || bp <= 0) { setSellErr("BP数を正しく入力してください"); return; }
    setSellErr(null); setSellMsg(null); setGrantingId(req.request_id);
    try {
      const res  = await fetch("/api/admin/grant-bp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: req.request_id, user_id: req.seller_id, bp_amount: bp }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "grant_failed");
      setSellMsg(`BP付与完了：${req.user_name || req.user_id} に ${bp}BP`);
      await loadSellRequests();
    } catch (e: any) {
      setSellErr(String(e?.message ?? e));
    } finally {
      setGrantingId(null);
    }
  };

  // ── ページネーション ──────────────────────────────────────
  const totalPages = Math.ceil(membersTotal / PAGE_SIZE);

  // ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-8">

        {/* ヘッダー */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">LIFAI 管理</h1>
          <button
            onClick={() => { load(); loadSellRequests(); loadDashboard(); loadMembers(membersPage); }}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-600"
          >
            再読み込み
          </button>
        </header>

        {/* 通知 */}
        {msg && <div className="mb-4 rounded-xl bg-emerald-900/50 px-4 py-3 text-sm font-bold text-emerald-300">{msg}</div>}
        {err && <div className="mb-4 rounded-xl bg-red-900/50 px-4 py-3 text-sm font-bold text-red-300">エラー：{err}</div>}

        {/* ═══ セクション1: サマリーカード ═══════════════════════ */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dashLoading ? (
            <>{[0,1,2,3].map(i => <SkeletonCard key={i} />)}</>
          ) : dashboard ? (
            <>
              <SummaryCard icon="👥" label="会員数"       value={`${dashboard.summary.total_members}人`} />
              <SummaryCard icon="⏳" label="承認待ち"     value={`${dashboard.summary.pending_count}件`} />
              <SummaryCard icon="💎" label="総BP発行量"   value={`${dashboard.summary.total_bp_issued.toLocaleString()} BP`} />
              <SummaryCard icon="⭐" label="総EP発行量"   value={`${dashboard.summary.total_ep_issued.toLocaleString()} EP`} />
            </>
          ) : (
            <p className="col-span-4 text-sm text-zinc-500">ダッシュボードの読み込みに失敗しました</p>
          )}
        </section>

        {/* ═══ セクション2: 機能別統計 ══════════════════════════ */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* ガチャ統計 */}
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-base font-semibold text-zinc-200">🎰 ガチャ統計</p>
            {dashLoading ? <div className="h-20 animate-pulse rounded bg-zinc-800" /> : dashboard ? (
              <>
                <StatBlock label="総スピン数"  value={`${dashboard.gacha_summary.total_spins}回`} />
                <StatBlock label="総消費BP"    value={`${dashboard.gacha_summary.total_cost_bp.toLocaleString()} BP`} />
                <StatBlock label="総獲得BP"    value={`${dashboard.gacha_summary.total_prize_bp.toLocaleString()} BP`} />
                <StatBlock
                  label="収支"
                  value={`${dashboard.gacha_summary.total_cost_bp - dashboard.gacha_summary.total_prize_bp >= 0 ? "+" : ""}${(dashboard.gacha_summary.total_cost_bp - dashboard.gacha_summary.total_prize_bp).toLocaleString()} BP`}
                  color={dashboard.gacha_summary.total_cost_bp - dashboard.gacha_summary.total_prize_bp >= 0 ? "text-emerald-400" : "text-red-400"}
                />
              </>
            ) : null}
          </div>

          {/* ステーキング統計 */}
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-base font-semibold text-zinc-200">🔒 ステーキング統計</p>
            {dashLoading ? <div className="h-20 animate-pulse rounded bg-zinc-800" /> : dashboard ? (
              <>
                <StatBlock label="アクティブ数"   value={`${dashboard.staking_summary.active_count}件`} />
                <StatBlock label="ロック中BP"     value={`${dashboard.staking_summary.total_staked_bp.toLocaleString()} BP`} />
                <StatBlock label="受け取り可能"   value={`${dashboard.staking_summary.claimable_count}件`} color="text-amber-400" />
              </>
            ) : null}
          </div>

          {/* RADIO統計 */}
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-base font-semibold text-zinc-200">📻 RADIO統計</p>
            {dashLoading ? <div className="h-20 animate-pulse rounded bg-zinc-800" /> : dashboard ? (
              <>
                <StatBlock label="総申請数"   value={`${dashboard.radio_summary.total_submissions}回`} />
                <StatBlock label="総EP付与"   value={`${dashboard.radio_summary.total_ep_granted.toLocaleString()} EP`} />
              </>
            ) : null}
          </div>
        </section>

        {/* ═══ セクション3: pending承認一覧 ════════════════════ */}
        <section className="mb-6 rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">⏳ pending 一覧</p>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {loading ? (
            <div className="h-20 animate-pulse rounded-xl bg-zinc-800" />
          ) : pendingRows.length === 0 ? (
            <EmptyState title="pending はありません" desc="申請が入るとここに表示されます。" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-zinc-800">
                  <tr>
                    <Th>日時</Th><Th>プラン</Th><Th>氏名</Th>
                    <Th>メール</Th><Th>紹介</Th><Th>地域</Th>
                    <Th className="text-right">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((r, i) => {
                    const key  = `${r.email ?? ""}_${r.created_at ?? ""}_${i}`;
                    const busy = busyKey === `${r.email ?? ""}_${r.created_at ?? ""}`;
                    return (
                      <tr key={key} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="whitespace-nowrap">{formatDate(r.created_at)}</Td>
                        <Td className="font-bold">{String(r.plan ?? "")}</Td>
                        <Td>
                          <div className="font-bold">{r.name ?? ""}</div>
                          <div className="text-xs text-zinc-500">{r.name_kana ?? ""}</div>
                        </Td>
                        <Td>
                          <div className="truncate max-w-[200px] text-zinc-200">{r.email ?? ""}</div>
                          <button className="mt-1 text-xs text-amber-400 hover:underline"
                            onClick={async () => { if (!r.email) return; await copyToClipboard(String(r.email)); setMsg("メールをコピーしました"); }}>
                            コピー
                          </button>
                        </Td>
                        <Td>
                          {r.ref_name ? <span className="font-semibold">{r.ref_name}</span> : <span className="text-zinc-600">（なし）</span>}
                          {r.ref_id ? <div className="text-xs text-zinc-500">ID: {r.ref_id}</div> : null}
                        </Td>
                        <Td>{r.region ?? ""}</Td>
                        <Td className="text-right">
                          <button
                            onClick={() => approve(r)}
                            disabled={busy}
                            className={clsx(
                              "rounded-lg px-4 py-2 text-sm font-bold transition",
                              busy ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                                   : "bg-amber-500 text-black hover:bg-amber-600"
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
          )}
        </section>

        {/* ═══ セクション4: 売却申請管理 ═══════════════════════ */}
        <section className="mb-6 rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">💰 売却申請管理</p>
            <button
              onClick={loadSellRequests}
              disabled={sellLoading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {sellLoading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {sellMsg && <div className="mb-3 rounded-xl bg-emerald-900/50 px-4 py-2 text-sm font-bold text-emerald-300">{sellMsg}</div>}
          {sellErr && <div className="mb-3 rounded-xl bg-red-900/50 px-4 py-2 text-sm font-bold text-red-300">エラー：{sellErr}</div>}

          {sellLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-zinc-800" />
          ) : sellRequests.length === 0 ? (
            <EmptyState title="申請はありません" desc="売却申請が入るとここに表示されます。" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-zinc-800">
                  <tr>
                    <Th>申請日時</Th><Th>申請者</Th><Th>アイテム</Th>
                    <Th>ステータス</Th><Th className="text-right">BP付与</Th>
                  </tr>
                </thead>
                <tbody>
                  {sellRequests.map((req, i) => {
                    const busy = grantingId === req.request_id;
                    return (
                      <tr key={req.request_id || i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="whitespace-nowrap">{formatDate(req.requested_at)}</Td>
                        <Td>
                          <div className="font-bold">{req.user_name || req.user_id}</div>
                          <div className="text-xs text-zinc-500">{req.user_id}</div>
                        </Td>
                        <Td className="max-w-[200px]">
                          <div className="truncate">{req.item_title || req.item_id}</div>
                        </Td>
                        <Td>
                          <span className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            req.status === "granted"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : "bg-amber-900/60 text-amber-300"
                          )}>
                            {req.status === "granted" ? "付与済" : "未処理"}
                          </span>
                        </Td>
                        <Td className="text-right">
                          {req.status !== "granted" && (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number" min={1} placeholder="BP数"
                                value={bpInputs[req.request_id] ?? ""}
                                onChange={e => setBpInputs(prev => ({ ...prev, [req.request_id]: e.target.value }))}
                                className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleGrantBp(req)}
                                disabled={busy}
                                className={clsx(
                                  "rounded-lg px-3 py-1.5 text-sm font-bold transition",
                                  busy ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                                       : "bg-amber-500 text-black hover:bg-amber-600"
                                )}
                              >
                                {busy ? "処理中…" : "BP付与"}
                              </button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ═══ セクション5: 会員一覧テーブル ══════════════════ */}
        <section className="rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">👥 会員一覧</p>
            <button
              onClick={() => loadMembers(membersPage)}
              disabled={membersLoading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {membersLoading ? "読み込み中…" : "再読み込み"}
            </button>
          </div>

          {membersLoading ? (
            <div className="space-y-2">
              {[0,1,2,3].map(i => <div key={i} className="h-10 animate-pulse rounded bg-zinc-800" />)}
            </div>
          ) : members.length === 0 ? (
            <EmptyState title="会員がいません" desc="承認済み会員がいるとここに表示されます。" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-zinc-800">
                    <tr>
                      <Th>ログインID</Th>
                      <Th>氏名</Th>
                      <Th>プラン</Th>
                      <Th>サブスク</Th>
                      <Th>BP残高</Th>
                      <Th>EP残高</Th>
                      <Th>連続ログイン</Th>
                      <Th>累計ログイン</Th>
                      <Th>最終ログイン</Th>
                      <Th>ステータス</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={m.login_id || i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="font-mono text-xs text-zinc-300">{m.login_id || "—"}</Td>
                        <Td>{m.name || "—"}</Td>
                        <Td>{m.plan || "—"}</Td>
                        <Td className="text-xs text-zinc-400">{m.subscription_plan || "free"}</Td>
                        <Td className={m.bp_balance >= 500 ? "font-bold text-amber-400" : ""}>{m.bp_balance.toLocaleString()}</Td>
                        <Td>{m.ep_balance.toLocaleString()}</Td>
                        <Td className={m.login_streak >= 7 ? "font-bold text-emerald-400" : ""}>{m.login_streak}日</Td>
                        <Td>{m.total_login_count}回</Td>
                        <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDate(m.last_login_at)}</Td>
                        <Td>
                          <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {m.status}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ページネーション */}
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
                <span>{membersTotal}人中 {membersPage * PAGE_SIZE + 1}〜{Math.min((membersPage + 1) * PAGE_SIZE, membersTotal)}件</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadMembers(membersPage - 1)}
                    disabled={membersPage === 0 || membersLoading}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    ← 前へ
                  </button>
                  <span className="flex items-center text-xs text-zinc-500">{membersPage + 1} / {totalPages || 1}</span>
                  <button
                    onClick={() => loadMembers(membersPage + 1)}
                    disabled={membersPage >= totalPages - 1 || membersLoading}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    次へ →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-zinc-600">© LIFAI</footer>
      </div>
    </main>
  );
}
