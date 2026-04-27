"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserNode = {
  login_id: string;
  name?: string;
  plan?: string;
  ep_balance?: number;
  bp_balance?: number;
  referrer_login_id?: string;
  [k: string]: any;
};

type TreeRow = {
  node: UserNode;
  depth: number;
  isLast: boolean[];
};

function buildRows(users: UserNode[], rootId: string | null): TreeRow[] {
  const map = new Map<string, UserNode>();
  users.forEach(u => map.set(u.login_id, u));

  const childrenMap = new Map<string, string[]>();
  users.forEach(u => {
    const pid = u.referrer_login_id ?? "";
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(u.login_id);
  });

  const roots = rootId
    ? [rootId]
    : users.filter(u => !u.referrer_login_id).map(u => u.login_id);

  const rows: TreeRow[] = [];
  const visited = new Set<string>();

  function walk(id: string, depth: number, isLast: boolean[]) {
    if (visited.has(id) || !map.has(id)) return;
    visited.add(id);
    const node = map.get(id)!;
    rows.push({ node, depth, isLast });
    const children = childrenMap.get(id) ?? [];
    children.forEach((cid, i) => {
      walk(cid, depth + 1, [...isLast, i === children.length - 1]);
    });
  }

  roots.forEach((id, i) => walk(id, 0, [i === roots.length - 1]));
  return rows;
}

export default function TreeTab() {
  const [users,     setUsers]     = useState<UserNode[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string | null>(null);
  const [rootSearch, setRootSearch] = useState("");
  const [rootId,    setRootId]    = useState<string | null>(null);
  const [modal,     setModal]     = useState<{ target: string; newParent: string } | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [feedback,  setFeedback]  = useState<string | null>(null);
  const [dragId,    setDragId]    = useState<string | null>(null);
  const [overId,    setOverId]    = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    fetch("/api/admin/list", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        const arr: UserNode[] = Array.isArray(json.items) ? json.items
          : Array.isArray(json.rows) ? json.rows : [];
        setUsers(arr);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => buildRows(users, rootId), [users, rootId]);

  const handleConfirm = async () => {
    if (!modal) return;
    setBusy(true); setFeedback(null);
    try {
      const res = await fetch("/api/admin/ref-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLoginId: modal.target, newReferrerLoginId: modal.newParent }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "reassign_failed");
      setFeedback(`✅ ${modal.target} の紹介者を ${modal.newParent} に変更しました`);
      setModal(null);
      load();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setFeedback(`❌ ${
        msg === "circular_reference" ? "循環参照になるため変更できません"
        : msg === "target_not_found" ? "対象ユーザーが見つかりません"
        : msg === "self_referral"    ? "自分自身には紹介できません"
        : msg
      }`);
      setModal(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ルートの login_id を入力（空=全体）"
          value={rootSearch}
          onChange={e => setRootSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") setRootId(rootSearch.trim() || null); }}
          className="w-72 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={() => setRootId(rootSearch.trim() || null)}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-600"
        >
          絞り込む
        </button>
        {rootId && (
          <button
            onClick={() => { setRootId(null); setRootSearch(""); }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            全体表示
          </button>
        )}
        <span className="text-xs text-zinc-500">{rows.length} 件</span>
        <span className="text-xs text-zinc-500">ドラッグ＆ドロップで紹介者変更</span>
      </div>

      {feedback && (
        <div className={[
          "mb-4 rounded-lg px-4 py-2 text-sm font-bold",
          feedback.startsWith("✅") ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300",
        ].join(" ")}>
          {feedback}
        </div>
      )}
      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-zinc-800" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">ユーザーが見つかりません</p>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          {/* ヘッダー */}
          <div className="grid grid-cols-[1fr_80px_80px_90px] gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
            <span className="text-[11px] font-bold text-zinc-400">ユーザー</span>
            <span className="text-[11px] font-bold text-zinc-400 text-right">EP</span>
            <span className="text-[11px] font-bold text-zinc-400 text-right">BP</span>
            <span className="text-[11px] font-bold text-zinc-400">プラン</span>
          </div>

          {/* 行リスト */}
          <div className="divide-y divide-zinc-800/60">
            {rows.map(({ node, depth, isLast }) => {
              const isDragging = dragId === node.login_id;
              const isOver     = overId === node.login_id && dragId !== node.login_id;

              return (
                <div
                  key={node.login_id}
                  draggable
                  onDragStart={() => setDragId(node.login_id)}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onDragOver={e => { e.preventDefault(); setOverId(node.login_id); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragId && dragId !== node.login_id) {
                      setModal({ target: dragId, newParent: node.login_id });
                    }
                    setDragId(null); setOverId(null);
                  }}
                  className={[
                    "grid grid-cols-[1fr_80px_80px_90px] gap-2 px-4 py-2 transition-colors",
                    isOver     ? "bg-amber-900/30 border-l-2 border-amber-500"
                    : isDragging ? "opacity-40"
                    : "hover:bg-zinc-800/40",
                  ].join(" ")}
                  style={{ cursor: "grab" }}
                >
                  {/* インデント＋ユーザー情報 */}
                  <div className="flex items-center gap-1 min-w-0">
                    {/* ツリー罫線 */}
                    {Array.from({ length: depth }).map((_, i) => (
                      <span
                        key={i}
                        className="shrink-0 text-zinc-700 select-none"
                        style={{ width: 20, textAlign: "center", fontSize: 12 }}
                      >
                        {i === depth - 1
                          ? (isLast[i] ? "└" : "├")
                          : (isLast[i] ? " " : "│")}
                      </span>
                    ))}
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-zinc-200 truncate">
                        {node.login_id}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {node.name ?? "—"}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-right text-emerald-400 self-center font-bold">
                    {(node.ep_balance ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-right text-amber-400 self-center">
                    {(node.bp_balance ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-400 self-center truncate">
                    {node.plan ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 紹介者変更確認モーダル */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, padding: 24, maxWidth: 400, width: "90%" }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ color: "#fff", fontWeight: "bold", marginBottom: 8 }}>紹介者を変更しますか？</p>
            <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 4 }}>
              <span style={{ color: "#f59e0b", fontFamily: "monospace" }}>{modal.target}</span> の紹介者を
            </p>
            <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 20 }}>
              <span style={{ color: "#34d399", fontFamily: "monospace" }}>{modal.newParent}</span> に変更します。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setModal(null)}
                disabled={busy}
                style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #52525b", background: "transparent", color: "#a1a1aa", cursor: "pointer", fontSize: 14 }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: busy ? "not-allowed" : "pointer", fontSize: 14, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "変更中…" : "変更する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
