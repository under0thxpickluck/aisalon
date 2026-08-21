"use client";

import { useEffect, useMemo, useState } from "react";

// 財務管理「サブスク」タブ。
// Music Boost の契約を1行=1契約で一覧表示する（active / expired / canceled すべて）。
// データ元: /api/admin/subscriptions（Basic 認証つき）

type SubscriptionItem = {
  id: string;
  login_id: string;
  name: string;
  email: string;
  plan_id: string;
  plan_label: string;
  percent: number;
  price_jpy: number;
  slots_used: number;
  status: string;
  started_at: string;
  expires_at: string;
  canceled_at: string;
  days_left: number | null;
};

type Summary = {
  active_count: number;
  mrr_jpy: number;
  used_slots: number;
  total_slots: number;
  available_slots: number;
  names_joined: boolean;
};

type SortKey = "user" | "plan" | "price" | "status" | "started_at" | "expires_at";
type Filter  = "all" | "active" | "expired" | "canceled";

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtYen(n: number) {
  return `¥${n.toLocaleString()}`;
}

const STATUS_LABEL: Record<string, string> = {
  active:   "契約中",
  expired:  "期限切れ",
  canceled: "解約",
};

const STATUS_CLASS: Record<string, string> = {
  active:   "bg-emerald-900/60 text-emerald-300",
  expired:  "bg-zinc-800 text-zinc-400",
  canceled: "bg-red-900/60 text-red-300",
};

function SortTh({
  label, sortKey, current, order, onSort, align = "left",
}: {
  label: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  order: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-3 py-2 font-bold hover:text-zinc-200 ${alignClass}`}
    >
      {label}
      <span className="ml-1 text-[10px] text-amber-500">
        {current === sortKey ? (order === "asc" ? "▲" : "▼") : ""}
      </span>
    </th>
  );
}

export default function SubscriptionsTab() {
  const [items,   setItems]   = useState<SubscriptionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [filter,  setFilter]  = useState<Filter>("active");
  const [query,   setQuery]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [order,   setOrder]   = useState<"asc" | "desc">("desc");

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch("/api/admin/subscriptions", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        setItems(Array.isArray(json.items) ? json.items : []);
        setSummary(json.summary ?? null);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setOrder(o => (o === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setOrder(k === "price" || k === "started_at" || k === "expires_at" ? "desc" : "asc"); }
  };

  const counts = useMemo(() => ({
    all:      items.length,
    active:   items.filter(i => i.status === "active").length,
    expired:  items.filter(i => i.status === "expired").length,
    canceled: items.filter(i => i.status === "canceled").length,
  }), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(i => {
      if (filter !== "all" && i.status !== filter) return false;
      if (!q) return true;
      return (
        i.login_id.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.plan_label.toLowerCase().includes(q)
      );
    });

    const time = (s: string) => {
      const t = new Date(s).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const cmp = (a: SubscriptionItem, b: SubscriptionItem) => {
      switch (sortKey) {
        case "user":       return (a.name || a.login_id).localeCompare(b.name || b.login_id, "ja");
        case "plan":       return a.percent - b.percent;
        case "price":      return a.price_jpy - b.price_jpy;
        case "status":     return a.status.localeCompare(b.status);
        case "expires_at": return time(a.expires_at) - time(b.expires_at);
        default:           return time(a.started_at) - time(b.started_at);
      }
    };
    return [...filtered].sort((a, b) => (order === "asc" ? cmp(a, b) : -cmp(a, b)));
  }, [items, filter, query, sortKey, order]);

  // 表示中の行の月額合計（絞り込みに追従するので「この条件だといくらか」が見える）
  const visibleTotal = useMemo(
    () => visible.reduce((sum, i) => sum + i.price_jpy, 0),
    [visible]
  );

  return (
    <div>
      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      {/* サマリカード */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "契約中",         value: `${summary.active_count} 件` },
            { label: "月額合計（MRR）", value: fmtYen(summary.mrr_jpy), color: "text-amber-400" },
            { label: "使用枠",         value: `${summary.used_slots.toLocaleString()} / ${summary.total_slots.toLocaleString()}` },
            { label: "空き枠",         value: `${summary.available_slots.toLocaleString()} 枠`, color: "text-emerald-400" },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-zinc-900 p-4">
              <p className="mb-1 text-xs text-zinc-400">{c.label}</p>
              <p className={`text-lg font-bold ${c.color ?? "text-white"}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {summary && !summary.names_joined && (
        <p className="mb-3 rounded-lg bg-amber-900/40 px-3 py-2 text-xs text-amber-300">
          ユーザー名簿の取得に失敗したため、名前とメールが空欄になっています（契約データ自体は正常です）。
        </p>
      )}

      {/* フィルタ・検索 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(["active", "expired", "canceled", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg px-4 py-1.5 text-xs font-bold transition",
              filter === f ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200",
            ].join(" ")}
          >
            {f === "all" ? `全件 (${counts.all})` : `${STATUS_LABEL[f]} (${counts[f]})`}
          </button>
        ))}

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="名前 / login_id / メール / プランで検索"
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />

        <button
          onClick={load}
          className="ml-auto rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          更新
        </button>
      </div>

      <p className="mb-3 text-xs text-zinc-500">
        Music Boost の契約履歴です。月額はプラン表（円建て）から算出しています。
        シートの price_usd 列は旧ドル建ての行が混在するため表示には使っていません。
      </p>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-zinc-500">対象なし</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <SortTh label="ユーザー" sortKey="user"       current={sortKey} order={order} onSort={handleSort} />
                  <th className="px-3 py-2 font-bold">メール</th>
                  <SortTh label="プラン"   sortKey="plan"       current={sortKey} order={order} onSort={handleSort} />
                  <SortTh label="月額"     sortKey="price"      current={sortKey} order={order} onSort={handleSort} align="right" />
                  <th className="px-3 py-2 font-bold text-right">枠</th>
                  <SortTh label="状態"     sortKey="status"     current={sortKey} order={order} onSort={handleSort} align="center" />
                  <SortTh label="開始日"   sortKey="started_at" current={sortKey} order={order} onSort={handleSort} />
                  <SortTh label="期限"     sortKey="expires_at" current={sortKey} order={order} onSort={handleSort} />
                  <th className="px-3 py-2 font-bold text-right">残</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(item => {
                  const isActive = item.status === "active";
                  const soon     = isActive && item.days_left !== null && item.days_left <= 7;
                  return (
                    <tr key={item.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                      <td className="px-3 py-2">
                        <p className="font-bold text-zinc-200">{item.name || "（名前未登録）"}</p>
                        <p className="font-mono text-[10px] text-zinc-500">{item.login_id}</p>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{item.email || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="font-bold text-zinc-200">{item.plan_label}</span>
                        <span className="ml-2 text-[10px] text-purple-300">{item.percent}%</span>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-300">{fmtYen(item.price_jpy)}</td>
                      <td className="px-3 py-2 text-right text-zinc-400">{item.slots_used.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[item.status] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-400">{fmtDate(item.started_at)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                        {item.status === "canceled" && item.canceled_at
                          ? <>{fmtDate(item.canceled_at)}<span className="ml-1 text-[10px] text-red-400">解約</span></>
                          : fmtDate(item.expires_at)}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap ${soon ? "font-bold text-amber-400" : "text-zinc-500"}`}>
                        {isActive && item.days_left !== null
                          ? (item.days_left >= 0 ? `残${item.days_left}日` : "超過")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            表示中 {visible.length} 件 / 月額合計 <span className="font-bold text-zinc-300">{fmtYen(visibleTotal)}</span>
          </p>
        </>
      )}
    </div>
  );
}
