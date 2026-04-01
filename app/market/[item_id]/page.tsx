"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../../lib/auth";
import { useLifaiCat } from "@/components/LifaiCat";

type MarketItem = {
  item_id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  desc: string;
  item_type: string;
  asset_count: number;
  currency: string;
  price: number;
  delivery_mode: string;
  stock_total: number;
  stock_sold: number;
  stock_reserved: number;
  status: string;
};

type LocalOrder = {
  order_id: string;
  item_id: string;
  item_title: string;
  item_type: string;
  price: number;
  currency: string;
  status: "paid" | "confirmed" | "refunded";
  created_at: string;
};

const ORDERS_KEY = "market_orders_v1";

function getLocalOrders(): LocalOrder[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch { return []; }
}

function saveLocalOrder(order: LocalOrder) {
  const orders = getLocalOrders();
  const idx = orders.findIndex(o => o.order_id === order.order_id);
  if (idx >= 0) { orders[idx] = order; } else { orders.unshift(order); }
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function updateLocalOrderStatus(order_id: string, status: LocalOrder["status"]) {
  const orders = getLocalOrders();
  const idx = orders.findIndex(o => o.order_id === order_id);
  if (idx >= 0) {
    orders[idx].status = status;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }
}

function itemTypeLabel(type: string) {
  switch (type) {
    case "image_pack": return "🖼️ 画像パック";
    case "music_pack": return "🎵 音楽パック";
    case "other_pack": return "📦 その他";
    default: return type;
  }
}

const REPORT_REASONS = [
  { value: "spam", label: "スパム" },
  { value: "copyright", label: "著作権侵害" },
  { value: "fraud", label: "詐欺・虚偽" },
  { value: "other", label: "その他" },
];

// ── PurchaseToast ────────────────────────────────────────────────────────────

function PurchaseToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <>
      <style>{`
        @keyframes toast-in{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes check-draw{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
      `}</style>
      <div style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0F1A2E",
        border: "1px solid rgba(16,185,129,0.3)",
        borderRadius: 20,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 16px 60px rgba(0,0,0,0.6)",
        zIndex: 100,
        animation: "toast-in 0.35s ease-out",
        width: "min(400px, calc(100vw - 32px))",
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(16,185,129,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polyline
              points="3,9 7.5,13.5 15,5"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={24}
              style={{ animation: "check-draw 0.5s ease-out 0.1s both" }}
            />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#6EE7B7", margin: 0 }}>購入完了</p>
          <p style={{ fontSize: 11, color: "rgba(234,240,255,0.55)", marginTop: 3, lineHeight: 1.6 }}>
            エスクローに預けました。受領後に確定ボタンを押してください。
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "rgba(234,240,255,0.3)",
            cursor: "pointer",
            fontSize: 18,
            padding: "0 4px",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const item_id = params?.item_id as string;

  const [item, setItem] = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [myId, setMyId] = useState("");
  const [myCode, setMyCode] = useState("");

  const { trackEvent } = useLifaiCat();
  const [activeOrder, setActiveOrder] = useState<LocalOrder | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [showToast, setShowToast] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const [reportReason, setReportReason] = useState("spam");
  const [reportMsg, setReportMsg] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id =
      (auth as any)?.id || (auth as any)?.loginId ||
      (auth as any)?.login_id || (auth as any)?.email || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    setMyId(id);
    setMyCode(code);

    if (item_id) {
      const existing = getLocalOrders().find(
        o => o.item_id === item_id && o.status === "paid"
      );
      if (existing) setActiveOrder(existing);
    }
  }, [router, item_id]);

  useEffect(() => {
    if (!item_id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/market/item?item_id=${encodeURIComponent(item_id)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({ ok: false }));
        if (!data.ok) { setError(data.error || "商品が見つかりません"); return; }
        setItem(data.item);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [item_id]);

  const handleBuy = async () => {
    if (!myId || !myCode) { setBuyError("ログインが必要です"); return; }
    setBuying(true);
    setBuyError("");
    try {
      const res = await fetch("/api/market/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myId, code: myCode, item_id }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        const errCode = data.gas?.error || data.error || "購入に失敗しました";
        setBuyError(errCode);
        if (errCode === "insufficient_balance") {
          trackEvent("error_event", { error_code: "insufficient_balance" });
        }
        return;
      }
      const order: LocalOrder = {
        order_id: data.order_id,
        item_id,
        item_title: item?.title || "",
        item_type: item?.item_type || "",
        price: item?.price || 0,
        currency: item?.currency || "EP",
        status: "paid",
        created_at: new Date().toISOString(),
      };
      saveLocalOrder(order);
      setActiveOrder(order);
      setShowToast(true);
    } catch (e) {
      setBuyError(String(e));
    } finally {
      setBuying(false);
    }
  };

  const handleConfirm = async () => {
    if (!activeOrder || !myId || !myCode) return;
    setConfirming(true);
    setConfirmError("");
    try {
      const res = await fetch("/api/market/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myId, code: myCode, order_id: activeOrder.order_id }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) { setConfirmError(data.gas?.error || data.error || "確定に失敗しました"); return; }
      updateLocalOrderStatus(activeOrder.order_id, "confirmed");
      setActiveOrder(null);
      setConfirmDone(true);
    } catch (e) {
      setConfirmError(String(e));
    } finally {
      setConfirming(false);
    }
  };

  const handleReport = async () => {
    if (!myId || !myCode) { setReportError("ログインが必要です"); return; }
    setReporting(true);
    setReportError("");
    try {
      const res = await fetch("/api/market/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myId, code: myCode, item_id, reason: reportReason, message: reportMsg }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) { setReportError(data.gas?.error || data.error || "通報に失敗しました"); return; }
      setReportDone(true);
    } catch (e) {
      setReportError(String(e));
    } finally {
      setReporting(false);
    }
  };

  // ── Shared styles ──
  const cardStyle: React.CSSProperties = {
    background: "#0F1A2E",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 26px 70px rgba(0,0,0,0.5)",
  };
  const subCardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "14px 16px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: "8px 12px",
    fontSize: 12,
    color: "#EAF0FF",
    outline: "none",
    boxSizing: "border-box",
  };

  if (loading) {
    return (
      <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#0B1220" }}>
        <p style={{ fontSize: 13, color: "rgba(234,240,255,0.4)" }}>読み込み中…</p>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#0B1220" }}>
        <p style={{ fontSize: 13, color: "#FCA5A5" }}>{error || "商品が見つかりません"}</p>
        <Link href="/market" style={{ fontSize: 12, fontWeight: 700, color: "#A78BFA", textDecoration: "none" }}>
          ← マーケットに戻る
        </Link>
      </main>
    );
  }

  const available = item.stock_total - item.stock_sold - item.stock_reserved;
  const isOwnItem = !!myId && item.seller_id === myId;
  const canBuy =
    !isOwnItem && available > 0 && item.status === "active" && !activeOrder && !confirmDone;

  return (
    <main style={{ minHeight: "100vh", background: "#0B1220", color: "#EAF0FF" }}>
      {/* Radial glow */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: -10,
        pointerEvents: "none",
        background: [
          "radial-gradient(ellipse 800px 500px at 15% -10%, rgba(99,102,241,0.18) 0%, transparent 60%)",
          "radial-gradient(ellipse 600px 400px at 85% 0%, rgba(124,58,237,0.12) 0%, transparent 55%)",
        ].join(","),
      }} />

      {showToast && <PurchaseToast onDismiss={() => setShowToast(false)} />}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
        <div style={cardStyle}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/market"
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(234,240,255,0.65)",
                textDecoration: "none",
              }}
            >
              ← 戻る
            </Link>
          </div>

          {/* 商品情報 */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 9999,
                padding: "2px 10px",
                fontSize: 10,
                fontWeight: 700,
                color: "#A78BFA",
              }}>
                {itemTypeLabel(item.item_type)}
              </span>
              {item.status !== "active" && (
                <span style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 9999,
                  padding: "2px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(234,240,255,0.45)",
                }}>
                  {item.status === "sold_out" ? "売り切れ" : "非公開"}
                </span>
              )}
            </div>

            <h1 style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color: "#EAF0FF", letterSpacing: "-0.01em" }}>
              {item.title}
            </h1>
            <p style={{ marginTop: 8, fontSize: 13, color: "rgba(234,240,255,0.6)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
              {item.desc}
            </p>

            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              <div style={subCardStyle}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(234,240,255,0.4)" }}>価格</p>
                <p style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#EAF0FF" }}>
                  {item.price.toLocaleString()}{" "}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(234,240,255,0.4)" }}>{item.currency}</span>
                </p>
              </div>
              <div style={subCardStyle}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(234,240,255,0.4)" }}>在庫</p>
                <p style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#EAF0FF" }}>{available}</p>
              </div>
              <div style={subCardStyle}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(234,240,255,0.4)" }}>アセット数</p>
                <p style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#EAF0FF" }}>{item.asset_count}</p>
              </div>
            </div>

            <p style={{ marginTop: 14, fontSize: 12, color: "rgba(234,240,255,0.4)" }}>
              出品者: {item.seller_name || item.seller_id}
            </p>
            {isOwnItem && (
              <p style={{ marginTop: 6, fontSize: 10, color: "rgba(167,139,250,0.6)" }}>
                ℹ 売上から5.5%の手数料が差し引かれます
              </p>
            )}
          </div>

          {/* 購入セクション */}
          <div style={{ marginTop: 28, ...subCardStyle, padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "rgba(234,240,255,0.7)", marginBottom: 12 }}>購入</p>

            {/* 利用規約・注意 */}
            <div style={{
              marginBottom: 12,
              borderRadius: 12,
              border: "1px solid rgba(167,139,250,0.15)",
              background: "rgba(124,58,237,0.05)",
              padding: "8px 12px",
              fontSize: 10,
              color: "rgba(167,139,250,0.7)",
              lineHeight: 1.75,
            }}>
              <span>⚠ EP/BPは換金できません　</span>
              <span>⚠ 外部売買は禁止されています</span>
            </div>

            {confirmDone ? (
              <div style={{
                borderRadius: 16,
                border: "1px solid rgba(16,185,129,0.25)",
                background: "rgba(16,185,129,0.08)",
                padding: "16px",
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#6EE7B7" }}>✅ 受領確定が完了しました</p>
                <p style={{ marginTop: 4, fontSize: 12, color: "rgba(110,231,183,0.7)" }}>
                  出品者に代金が支払われました。ありがとうございました。
                </p>
              </div>
            ) : activeOrder ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  borderRadius: 16,
                  border: "1px solid rgba(99,102,241,0.25)",
                  background: "rgba(99,102,241,0.08)",
                  padding: "14px 16px",
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#A5B4FC" }}>購入済み（エスクロー保留中）</p>
                  <p style={{ marginTop: 4, fontSize: 10, color: "rgba(165,180,252,0.6)" }}>
                    注文ID: {activeOrder.order_id}
                  </p>
                  <p style={{ marginTop: 8, fontSize: 12, color: "rgba(165,180,252,0.8)", lineHeight: 1.6 }}>
                    商品の受け取りが完了したら「受領確定」ボタンを押してください。
                    確定後に出品者へ代金が支払われます。
                  </p>
                </div>
                {confirmError && <p style={{ fontSize: 12, color: "#FCA5A5" }}>{confirmError}</p>}
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    background: confirming ? "rgba(5,150,105,0.4)" : "linear-gradient(90deg,#059669,#10B981)",
                    padding: "13px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    border: "none",
                    cursor: confirming ? "not-allowed" : "pointer",
                    opacity: confirming ? 0.6 : 1,
                    boxShadow: confirming ? "none" : "0 4px 20px rgba(16,185,129,0.3)",
                    transition: "opacity 0.15s",
                  }}
                >
                  {confirming ? "確定中…" : "✅ 受領確定する"}
                </button>
              </div>
            ) : canBuy ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, color: "rgba(234,240,255,0.55)", lineHeight: 1.6 }}>
                  {item.currency} {item.price.toLocaleString()} が残高から引き落とされます。
                  代金は受領確定後に出品者へ支払われます。
                </p>
                <p style={{ fontSize: 10, color: "rgba(234,240,255,0.35)", lineHeight: 1.6 }}>
                  ※ 購入後7日間、受領確定がない場合は自動確定されます。返金申請・通報中は自動確定が停止します。
                </p>
                {buyError && <p style={{ fontSize: 12, color: "#FCA5A5" }}>{buyError}</p>}
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    background: buying ? "rgba(99,102,241,0.4)" : "linear-gradient(90deg,#6366F1,#A78BFA)",
                    padding: "13px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    border: "none",
                    cursor: buying ? "not-allowed" : "pointer",
                    opacity: buying ? 0.6 : 1,
                    boxShadow: buying ? "none" : "0 4px 20px rgba(99,102,241,0.35)",
                    transition: "opacity 0.15s",
                  }}
                >
                  {buying ? "処理中…" : `購入する（${item.price.toLocaleString()} ${item.currency}）`}
                </button>
              </div>
            ) : isOwnItem ? (
              <p style={{ fontSize: 12, color: "rgba(234,240,255,0.4)" }}>自分の出品は購入できません。</p>
            ) : available <= 0 ? (
              <p style={{ fontSize: 12, color: "rgba(234,240,255,0.4)" }}>在庫がありません。</p>
            ) : (
              <p style={{ fontSize: 12, color: "rgba(234,240,255,0.4)" }}>現在購入できません。</p>
            )}
          </div>

          {/* 通報セクション */}
          {!isOwnItem && (
            <div style={{ marginTop: 24 }}>
              <details>
                <summary style={{
                  cursor: "pointer",
                  listStyle: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(234,240,255,0.3)",
                }}>
                  ⚠️ この商品を通報する
                </summary>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {reportDone ? (
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6EE7B7" }}>通報を受け付けました。</p>
                  ) : (
                    <>
                      <select
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                        style={inputStyle}
                      >
                        {REPORT_REASONS.map(r => (
                          <option key={r.value} value={r.value} style={{ background: "#0F1A2E" }}>{r.label}</option>
                        ))}
                      </select>
                      <textarea
                        value={reportMsg}
                        onChange={e => setReportMsg(e.target.value)}
                        placeholder="詳細（任意）"
                        rows={3}
                        style={{ ...inputStyle, resize: "none" }}
                      />
                      {reportError && <p style={{ fontSize: 12, color: "#FCA5A5" }}>{reportError}</p>}
                      <button
                        onClick={handleReport}
                        disabled={reporting}
                        style={{
                          alignSelf: "flex-start",
                          borderRadius: 14,
                          border: "1px solid rgba(239,68,68,0.3)",
                          background: "rgba(239,68,68,0.08)",
                          padding: "8px 16px",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#FCA5A5",
                          cursor: reporting ? "not-allowed" : "pointer",
                          opacity: reporting ? 0.5 : 1,
                        }}
                      >
                        {reporting ? "送信中…" : "通報する"}
                      </button>
                    </>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}
