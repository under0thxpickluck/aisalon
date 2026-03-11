"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../lib/auth";
import { useAIBot } from "@/components/AIBot";

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
  stock_total: number;
  stock_sold: number;
  stock_reserved: number;
  status: string;
};

function itemTypeLabel(type: string) {
  switch (type) {
    case "image_pack": return "🖼️ 画像パック";
    case "music_pack": return "🎵 音楽パック";
    case "other_pack": return "📦 その他";
    default: return type;
  }
}

function CurrencyBadge({ currency }: { currency: string }) {
  if (currency === "BP") {
    return (
      <span style={{
        background: "linear-gradient(90deg,#06B6D4,#22D3EE)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 9999,
        letterSpacing: "0.05em",
        flexShrink: 0,
      }}>BP</span>
    );
  }
  return (
    <>
      <style>{`@keyframes ep-glow{0%,100%{box-shadow:0 0 6px 1px rgba(167,139,250,.4)}50%{box-shadow:0 0 16px 4px rgba(167,139,250,.8)}}`}</style>
      <span style={{
        background: "linear-gradient(90deg,#7C3AED,#A78BFA)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 9999,
        animation: "ep-glow 2.8s ease-in-out infinite",
        letterSpacing: "0.05em",
        flexShrink: 0,
      }}>EP</span>
    </>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      background: "rgba(255,255,255,0.07)",
      color: "rgba(234,240,255,0.75)",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 9999,
      border: "1px solid rgba(255,255,255,0.10)",
    }}>{itemTypeLabel(type)}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
      <svg
        className="h-6 w-6 animate-spin"
        style={{ color: "#7C3AED" }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

function ItemCard({ item }: { item: MarketItem }) {
  const available = item.stock_total - item.stock_sold - item.stock_reserved;
  return (
    <Link href={`/market/${item.item_id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#111D35",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          padding: 20,
          boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          cursor: "pointer",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        className="hover:-translate-y-[2px] hover:shadow-[0_16px_50px_rgba(99,102,241,0.2)] active:scale-[0.99]"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <TypeBadge type={item.item_type} />
              <CurrencyBadge currency={item.currency} />
            </div>
            <p style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#EAF0FF",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: 1.5,
            }}>{item.title}</p>
            <p style={{ fontSize: 11, color: "rgba(234,240,255,0.4)", marginTop: 4 }}>
              出品者: {item.seller_name || item.seller_id}
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#EAF0FF", lineHeight: 1 }}>
              {item.price.toLocaleString()}
            </p>
            <p style={{ fontSize: 10, color: "rgba(234,240,255,0.4)", marginTop: 2 }}>{item.currency}</p>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "rgba(234,240,255,0.3)" }}>
            在庫 {available} · アセット {item.asset_count}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>詳細 →</span>
        </div>
      </div>
    </Link>
  );
}

// ── Tutorial ────────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    title: "LIFAIマーケットへようこそ！",
    desc: "メンバー同士でコンテンツを売買できるマーケットプレイスです。EP・BPを使って取引できます。",
  },
  {
    title: "商品を探す",
    desc: "商品カードをクリックして詳細を確認し、購入できます。代金はエスクローで安全に保護されます。",
    highlightId: "item-grid",
  },
  {
    title: "タイプで絞り込む",
    desc: "画像パック（100枚〜）、音楽パック（10曲〜）、その他から絞り込めます。",
    highlightId: "filter-type",
  },
  {
    title: "通貨で絞り込む",
    desc: "BP（ボーナスポイント）とEP（エナジーポイント）の2通貨に対応しています。",
    highlightId: "filter-currency",
  },
  {
    title: "キーワード検索",
    desc: "タイトルや説明文でキーワード検索できます。入力後0.5秒で自動検索します。",
    highlightId: "search-input",
  },
  {
    title: "購入履歴を確認",
    desc: "このデバイスで購入した商品は「購入履歴」から確認・受領確定ができます。",
    highlightId: "orders-link",
  },
  {
    title: "出品してみよう！",
    desc: "あなたのコンテンツを出品して収益を得ましょう。1日5件まで、最低価格50から。手数料は5.5%です。",
    highlightId: "create-link",
  },
];

const TUTORIAL_KEY = "lifai_market_tutorial_seen";

function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const total = TUTORIAL_STEPS.length;
  const current = TUTORIAL_STEPS[step];

  const handleClose = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TUTORIAL_KEY, "1");
    }
    onClose();
  };

  const handleNext = () => {
    if (step < total - 1) setStep(s => s + 1);
    else handleClose();
  };

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  return (
    <>
      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(480px, calc(100vw - 32px))",
        background: "#0F1A2E",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 24,
        padding: "20px 24px",
        zIndex: 60,
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(234,240,255,0.4)", letterSpacing: "0.08em" }}>
            {step + 1} / {total}
          </span>
          <button
            onClick={handleClose}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(234,240,255,0.4)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            スキップ
          </button>
        </div>

        {/* Step progress bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              height: 3,
              flex: 1,
              borderRadius: 9999,
              background: i <= step
                ? "linear-gradient(90deg,#6366F1,#A78BFA)"
                : "rgba(255,255,255,0.08)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        <p style={{ fontSize: 14, fontWeight: 800, color: "#EAF0FF", marginBottom: 8 }}>{current.title}</p>
        <p style={{ fontSize: 12, color: "rgba(234,240,255,0.6)", lineHeight: 1.75 }}>{current.desc}</p>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {step > 0 && (
            <button
              onClick={handlePrev}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#EAF0FF",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← 前へ
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              padding: "10px",
              borderRadius: 14,
              background: "linear-gradient(90deg,#6366F1,#A78BFA)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
            }}
          >
            {step < total - 1 ? "次へ →" : "はじめる"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: "8px 14px",
  fontSize: 12,
  color: "#EAF0FF",
  outline: "none",
};

export default function MarketPage() {
  const router = useRouter();
  const { trackEvent } = useAIBot();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allItems, setAllItems] = useState<MarketItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemType, setItemType] = useState("");
  const [currency, setCurrency] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);

  // 検索 debounce 500ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 500);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    setIsLoggedIn(true);
    if (typeof window !== "undefined" && !localStorage.getItem(TUTORIAL_KEY)) {
      setShowTutorial(true);
    }
    trackEvent("page_view", { page_id: "market_home" });
  }, [router, trackEvent]);

  // フィルター・検索が変わるたびに再フェッチ
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setPage(1);
    setAllItems([]);

    (async () => {
      try {
        const params = new URLSearchParams({ page: "1", limit: "50" });
        if (itemType) params.set("item_type", itemType);
        if (currency) params.set("currency", currency);
        if (debouncedQ) params.set("q", debouncedQ);
        const res = await fetch(`/api/market/list?${params}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({ ok: false }));
        if (cancelled) return;
        if (!data.ok) { setError(data.error || "取得失敗"); return; }
        setAllItems(data.items || []);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isLoggedIn, itemType, currency, debouncedQ]);

  // クライアントサイドフィルタリング
  const filteredItems = allItems.filter(item => {
    if (itemType && item.item_type !== itemType) return false;
    if (currency && item.currency !== currency) return false;
    if (debouncedQ.trim()) {
      const search = debouncedQ.trim().toLowerCase();
      const inTitle = item.title.toLowerCase().includes(search);
      const inDesc  = (item.desc || "").toLowerCase().includes(search);
      if (!inTitle && !inDesc) return false;
    }
    return true;
  });

  // クライアントサイドページング
  const displayItems = filteredItems.slice(0, page * PAGE_SIZE);
  const hasMore = displayItems.length < filteredItems.length;
  const loadMore = () => setPage(p => p + 1);

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

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{
          background: "#0F1A2E",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: 24,
          boxShadow: "0 26px 70px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link
                href="/top"
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
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(234,240,255,0.65)",
              }}>
                <span style={{ fontSize: 16 }}>🛒</span>
                マーケット
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                id="orders-link"
                href="/market/orders"
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(234,240,255,0.65)",
                  textDecoration: "none",
                }}
              >
                📦 購入履歴
              </Link>
              <Link
                id="create-link"
                href="/market/create"
                style={{
                  borderRadius: 14,
                  background: "linear-gradient(90deg,#6366F1,#A78BFA)",
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
                  transition: "transform 0.1s",
                }}
                className="active:scale-[0.98]"
              >
                ＋ 出品する
              </Link>
            </div>
          </div>

          <h1 style={{ marginTop: 24, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", color: "#EAF0FF" }}>
            LIFAIマーケット
          </h1>
          <p style={{ marginTop: 4, fontSize: 12, color: "rgba(234,240,255,0.5)" }}>
            メンバー同士でコンテンツをやりとりできます。画像は100枚〜 / 音楽は10曲〜 / 最低価格50から
          </p>

          {/* Filter bar */}
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <input
              id="search-input"
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="タイトルで検索…"
              style={{ ...inputStyle, flex: 1, minWidth: 160 }}
            />
            <select
              id="filter-type"
              value={itemType}
              onChange={e => { setItemType(e.target.value); setPage(1); }}
              style={inputStyle}
            >
              <option value="" style={{ background: "#0F1A2E" }}>全タイプ</option>
              <option value="image_pack" style={{ background: "#0F1A2E" }}>🖼️ 画像パック</option>
              <option value="music_pack" style={{ background: "#0F1A2E" }}>🎵 音楽パック</option>
              <option value="other_pack" style={{ background: "#0F1A2E" }}>📦 その他</option>
            </select>
            <select
              id="filter-currency"
              value={currency}
              onChange={e => { setCurrency(e.target.value); setPage(1); }}
              style={inputStyle}
            >
              <option value="" style={{ background: "#0F1A2E" }}>全通貨</option>
              <option value="BP" style={{ background: "#0F1A2E" }}>BP</option>
              <option value="EP" style={{ background: "#0F1A2E" }}>EP</option>
            </select>
            {(itemType || currency || debouncedQ) && !loading && (
              <span style={{
                alignSelf: "center",
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 9999,
                padding: "2px 10px",
                fontSize: 10,
                fontWeight: 700,
                color: "#A78BFA",
              }}>
                {filteredItems.length}件
              </span>
            )}
          </div>

          {/* Item grid */}
          <div style={{ marginTop: 24 }} id="item-grid">
            {error && (
              <div style={{
                borderRadius: 16,
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.08)",
                padding: "12px 16px",
                fontSize: 13,
                color: "#FCA5A5",
              }}>
                {error}
              </div>
            )}
            {loading && <Spinner />}
            {!loading && !error && filteredItems.length === 0 && (
              <div style={{ padding: "64px 0", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "rgba(234,240,255,0.3)" }}>
                  {(itemType || currency || debouncedQ)
                    ? "条件に一致する商品がありません"
                    : "まだ出品がありません。最初の出品者になりましょう。"}
                </p>
                {!itemType && !currency && !debouncedQ && (
                  <Link
                    href="/market/create"
                    style={{
                      display: "inline-block",
                      marginTop: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#A78BFA",
                      textDecoration: "none",
                    }}
                  >
                    ＋ 出品する →
                  </Link>
                )}
              </div>
            )}
            {!loading && (
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {displayItems.map(item => (
                  <ItemCard key={item.item_id} item={item} />
                ))}
              </div>
            )}
            {hasMore && !loading && (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <button
                  onClick={loadMore}
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    padding: "10px 32px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(234,240,255,0.65)",
                    cursor: "pointer",
                  }}
                >
                  もっと見る
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}
