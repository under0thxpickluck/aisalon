"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserNode = {
  login_id: string;
  name?: string;
  plan?: string;
  ep_balance?: number;
  referrer_login_id?: string;
  [k: string]: any;
};

type LayoutNode = UserNode & {
  x: number;
  y: number;
  children: string[];
};

const NODE_W      = 180;
const NODE_H      = 72;
const LEVEL_H     = 130;
const SIBLING_GAP = 30;

function buildTree(users: UserNode[], rootId: string | null): Map<string, LayoutNode> {
  const map        = new Map<string, UserNode>();
  users.forEach(u => map.set(u.login_id, u));

  const childrenMap = new Map<string, string[]>();
  users.forEach(u => {
    const pid = u.referrer_login_id ?? "";
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(u.login_id);
  });

  const roots = rootId
    ? [rootId]
    : users.filter(u => !u.referrer_login_id).map(u => u.login_id).slice(0, 50);

  const layoutMap  = new Map<string, LayoutNode>();
  const levels: string[][] = [];
  const queue      = roots.map(id => ({ id, level: 0 }));
  const visited    = new Set<string>();

  while (queue.length > 0 && layoutMap.size < 50) {
    const { id, level } = queue.shift()!;
    if (visited.has(id) || !map.has(id)) continue;
    visited.add(id);

    if (!levels[level]) levels[level] = [];
    levels[level].push(id);

    const children = (childrenMap.get(id) ?? []).filter(c => !visited.has(c));
    layoutMap.set(id, { ...map.get(id)!, x: 0, y: level * LEVEL_H, children });
    children.forEach(c => queue.push({ id: c, level: level + 1 }));
  }

  levels.forEach(ids => {
    const totalW = ids.length * NODE_W + (ids.length - 1) * SIBLING_GAP;
    const startX = -totalW / 2;
    ids.forEach((id, i) => {
      const node = layoutMap.get(id);
      if (node) node.x = startX + i * (NODE_W + SIBLING_GAP);
    });
  });

  return layoutMap;
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cy = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
}

export default function TreeTab() {
  const [users,      setUsers]      = useState<UserNode[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState<string | null>(null);
  const [rootSearch, setRootSearch] = useState("");
  const [rootId,     setRootId]     = useState<string | null>(null);
  const [dragId,     setDragId]     = useState<string | null>(null);
  const [overId,     setOverId]     = useState<string | null>(null);
  const [modal,      setModal]      = useState<{ target: string; newParent: string } | null>(null);
  const [busy,       setBusy]       = useState(false);
  const [feedback,   setFeedback]   = useState<string | null>(null);

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

  const layoutMap = useMemo(() => buildTree(users, rootId), [users, rootId]);

  const allNodes = Array.from(layoutMap.values());
  const xs = allNodes.map(n => n.x);
  const ys = allNodes.map(n => n.y);
  const minX = Math.min(...xs, 0) - 20;
  const maxX = Math.max(...xs, 0) + NODE_W + 20;
  const minY = Math.min(...ys, 0) - 20;
  const maxY = Math.max(...ys, 0) + NODE_H + 20;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setModal({ target: dragId, newParent: targetId });
    setDragId(null); setOverId(null);
  };

  const handleConfirm = async () => {
    if (!modal) return;
    setBusy(true); setFeedback(null);
    try {
      const res  = await fetch("/api/admin/ref-reassign", {
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
          placeholder="ルートユーザーの login_id を入力"
          value={rootSearch}
          onChange={e => setRootSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") setRootId(rootSearch.trim() || null); }}
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={() => setRootId(rootSearch.trim() || null)}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-600"
        >
          表示
        </button>
        {rootId && (
          <button
            onClick={() => { setRootId(null); setRootSearch(""); }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            全体表示
          </button>
        )}
        <span className="text-xs text-zinc-500">{layoutMap.size} ノード（最大 50）</span>
        <span className="text-xs text-zinc-500">ドラッグ＆ドロップで紹介者を変更</span>
      </div>

      {feedback && (
        <div className={[
          "mb-4 rounded-lg px-4 py-2 text-sm font-bold",
          feedback.startsWith("✅") ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"
        ].join(" ")}>
          {feedback}
        </div>
      )}

      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-zinc-800" />
      ) : layoutMap.size === 0 ? (
        <p className="text-sm text-zinc-500">ユーザーが見つかりません</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <svg
            width={svgW}
            height={svgH}
            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            style={{ display: "block" }}
          >
            {allNodes.map(node =>
              node.children.map(childId => {
                const child = layoutMap.get(childId);
                if (!child) return null;
                return (
                  <path
                    key={`${node.login_id}-${childId}`}
                    d={cubicBezier(
                      node.x + NODE_W / 2, node.y + NODE_H,
                      child.x + NODE_W / 2, child.y
                    )}
                    fill="none"
                    stroke="#52525b"
                    strokeWidth={1.5}
                  />
                );
              })
            )}

            {allNodes.map(node => {
              const isOver     = overId === node.login_id && dragId !== node.login_id;
              const isDragging = dragId === node.login_id;
              return (
                <foreignObject
                  key={node.login_id}
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                >
                  <div
                    draggable
                    onDragStart={() => setDragId(node.login_id)}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    onDragOver={e => { e.preventDefault(); setOverId(node.login_id); }}
                    onDrop={e => handleDrop(e, node.login_id)}
                    style={{
                      width: NODE_W, height: NODE_H, boxSizing: "border-box",
                      padding: "8px", borderRadius: "10px",
                      border:      isOver     ? "2px solid #f59e0b"
                                 : isDragging ? "2px dashed #6b7280"
                                 : "1px solid #3f3f46",
                      background:  isOver     ? "#292524"
                                 : isDragging ? "#1c1c1e"
                                 : "#18181b",
                      cursor: "grab", userSelect: "none",
                      opacity: isDragging ? 0.5 : 1,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: "bold", color: "#e4e4e7", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {node.login_id}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {node.name ?? ""} / {node.plan ?? "—"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#34d399" }}>
                      EP: {(node.ep_balance ?? 0).toLocaleString()}
                    </p>
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>
      )}

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
