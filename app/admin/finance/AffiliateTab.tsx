"use client";

import { useEffect, useMemo, useState } from "react";

type LedgerItem = {
  ts: string;
  kind: string;
  login_id: string;
  email: string;
  amount: number;
  memo: string;
};

type AffiliateMeta = {
  from?: string;
  level?: number;
  amount_usd?: number;
  rate_pct?: number;
};

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function parseMeta(memo: string): AffiliateMeta {
  try { return JSON.parse(memo) as AffiliateMeta; } catch { return {}; }
}

export default function AffiliateTab() {
  const [ledger,    setLedger]    = useState<LedgerItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string | null>(null);
  const [filterId,  setFilterId]  = useState("");
  const [filterLvl, setFilterLvl] = useState("");

  useEffect(() => {
    fetch("/api/admin/wallet-ledger", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        setLedger(Array.isArray(json.items) ? json.items : []);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const affiliateRows = useMemo(
    () => ledger.filter(l => l.kind === "affiliate_reward")
         .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    [ledger]
  );

  const filtered = useMemo(() => {
    let rows = affiliateRows;
    if (filterId.trim()) {
      const q = filterId.trim().toLowerCase();
      rows = rows.filter(r => r.login_id.toLowerCase().includes(q));
    }
    if (filterLvl) {
      const lvl = Number(filterLvl);
      rows = rows.filter(r => parseMeta(r.memo).level === lvl);
    }
    return rows;
  }, [affiliateRows, filterId, filterLvl]);

  const totalEp   = useMemo(() => affiliateRows.reduce((s, r) => s + r.amount, 0), [affiliateRows]);
  const uniqueIds = useMemo(() => new Set(affiliateRows.map(r => r.login_id)).size, [affiliateRows]);
  const lastDate  = useMemo(() => affiliateRows[0]?.ts ?? "", [affiliateRows]);

  return (
    <div>
      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "総付与 EP",      value: `${totalEp.toLocaleString()} EP` },
          { label: "対象ユーザー数", value: `${uniqueIds} 人` },
          { label: "最終付与日",     value: fmt(lastDate) },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-1 text-xs text-zinc-400">{c.label}</p>
            <p className="text-lg font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="受取人 login_id で絞り込み"
          value={filterId}
          onChange={e => setFilterId(e.target.value)}
          className="w-56 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <select
          value={filterLvl}
          onChange={e => setFilterLvl(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">全レベル</option>
          {[1,2,3,4,5].map(l => (
            <option key={l} value={l}>L{l}</option>
          ))}
        </select>
        <span className="flex items-center text-xs text-zinc-500">{filtered.length} 件</span>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">対象なし</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400">日時</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400">受取人</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400">送出元</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-center">Lv</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">USD額</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">EP付与</th>
                <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">料率</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const meta = parseMeta(l.memo);
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                    <td className="px-3 py-2 text-xs text-zinc-400 whitespace-nowrap">{fmt(l.ts)}</td>
                    <td className="px-3 py-2 text-xs font-mono text-zinc-200">{l.login_id}</td>
                    <td className="px-3 py-2 text-xs font-mono text-zinc-400">{meta.from ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      {meta.level != null ? (
                        <span className="rounded-full bg-indigo-900/60 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          L{meta.level}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-300">
                      {meta.amount_usd != null ? `$${meta.amount_usd}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold text-right text-emerald-400">
                      +{l.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-400">
                      {meta.rate_pct != null ? `${meta.rate_pct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
