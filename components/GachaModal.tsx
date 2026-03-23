"use client";

// components/GachaModal.tsx
import { useEffect, useState } from "react";

type GachaResult = {
  prize_bp:    number;
  net:         number;
  bp_balance:  number;
  results?:    { prize_bp: number; rarity: string }[];
  fragments?:  number;
  gacha_count?: number;
  rarity?:     string;
};

type Props = {
  loginId:    string;
  onClose:    () => void;
  onBpEarned: (amount: number) => void;
};

const GACHA_TABLE = [
  { bp: 80,    pct: "30%",  rarity: "common"    },
  { bp: 100,   pct: "25%",  rarity: "common"    },
  { bp: 150,   pct: "20%",  rarity: "uncommon"  },
  { bp: 250,   pct: "12%",  rarity: "rare"      },
  { bp: 500,   pct: "8%",   rarity: "epic"      },
  { bp: 1000,  pct: "4%",   rarity: "legendary" },
  { bp: 5000,  pct: "0.9%", rarity: "mythic"    },
  { bp: 20000, pct: "0.1%", rarity: "god"       },
] as const;

const RARITY_STYLE: Record<string, { color: string; label: string }> = {
  common:    { color: "#a1a1aa", label: "COMMON"    },
  uncommon:  { color: "#4ade80", label: "UNCOMMON"  },
  rare:      { color: "#60a5fa", label: "RARE"      },
  epic:      { color: "#c084fc", label: "EPIC"      },
  legendary: { color: "#fbbf24", label: "LEGENDARY" },
  mythic:    { color: "#f472b6", label: "MYTHIC"    },
  god:       { color: "#f87171", label: "GOD"       },
};

export default function GachaModal({ loginId, onClose, onBpEarned }: Props) {
  const [visible,  setVisible]  = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result,   setResult]   = useState<GachaResult | null>(null);
  const [errMsg,   setErrMsg]   = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleSpin = async (is10 = false) => {
    if (spinning || !loginId) return;
    setSpinning(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/gacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, is10 }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));

      if (!data.ok) {
        const reason = data.reason || data.error || "failed";
        setErrMsg(
          reason === "insufficient_bp"
            ? `BPが不足しています（${is10 ? "1000" : "100"}BP必要）`
            : `エラー: ${reason}`
        );
        return;
      }

      setResult({
        prize_bp:    data.prize_bp,
        net:         data.net,
        bp_balance:  data.bp_balance,
        results:     data.results,
        fragments:   data.fragments,
        gacha_count: data.gacha_count,
        rarity:      data.rarity,
      });
      onBpEarned(data.prize_bp);
    } catch {
      setErrMsg("通信エラーが発生しました");
    } finally {
      setSpinning(false);
    }
  };

  const handleAgain = () => {
    setResult(null);
    setErrMsg("");
  };

  return (
    <div
      onClick={result ? undefined : handleClose}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          9999,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        opacity:         visible ? 1 : 0,
        transition:      "opacity 0.3s ease",
        cursor:          result ? "default" : "pointer",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   "#18181b",
          borderRadius: "16px",
          padding:      "24px",
          maxWidth:     "380px",
          width:        "92%",
          boxShadow:    "0 32px 80px rgba(0,0,0,0.5)",
          border:       "1px solid rgba(255,255,255,0.08)",
          transform:    visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition:   "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          cursor:       "default",
          maxHeight:    "90vh",
          overflowY:    "auto",
        }}
      >
        {/* ===== 結果画面 ===== */}
        {result ? (
          <div style={{ textAlign: "center" }}>
            {(() => {
              const style = RARITY_STYLE[result.rarity ?? "common"] ?? RARITY_STYLE.common;
              return (
                <div style={{ marginBottom: "16px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: style.color, marginBottom: "6px" }}>
                    {style.label}
                  </p>
                  <p style={{
                    fontSize:      "44px",
                    fontWeight:    900,
                    color:         style.color,
                    letterSpacing: "-0.02em",
                    margin:        "0 0 6px",
                    animation:     result.prize_bp >= 5000 ? "pulse 1s infinite" : undefined,
                  }}>
                    +{result.prize_bp.toLocaleString()}BP
                  </p>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: result.net >= 0 ? "#4ade80" : "#f87171" }}>
                    差引: {result.net >= 0 ? "+" : ""}{result.net}BP
                  </p>
                </div>
              );
            })()}

            {/* 欠片 */}
            {result.fragments !== undefined && (
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#71717a" }}>欠片</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#fb923c" }}>🔮 {result.fragments}個</span>
              </div>
            )}

            {/* 天井ゲージ */}
            {result.gacha_count !== undefined && (
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>
                  <span>天井ゲージ</span>
                  <span>{result.gacha_count} / 100回</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                  <div style={{
                    background:   "linear-gradient(90deg,#eab308,#ef4444)",
                    height:       "100%",
                    borderRadius: "999px",
                    width:        `${Math.min(100, result.gacha_count)}%`,
                    transition:   "width 0.6s ease",
                  }} />
                </div>
                {result.gacha_count >= 50 && (
                  <p style={{ fontSize: "11px", color: "#fbbf24", marginTop: "5px" }}>⚡ 50回超え：高レア確率UP中！</p>
                )}
              </div>
            )}

            {/* 10連個別結果 */}
            {result.results && result.results.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "12px" }}>
                {result.results.map((r, i) => {
                  const s = RARITY_STYLE[r.rarity] ?? RARITY_STYLE.common;
                  return (
                    <div key={i} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "6px 4px", textAlign: "center" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: s.color }}>{r.prize_bp.toLocaleString()}</p>
                      <p style={{ fontSize: "9px", color: "#71717a" }}>{s.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ fontSize: "11px", color: "#52525b", marginBottom: "16px" }}>
              現在の残高: {result.bp_balance.toLocaleString()}BP
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleAgain}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#7c3aed", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                もう一度
              </button>
              <button
                onClick={handleClose}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#a1a1aa", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
          /* ===== 通常画面 ===== */
          <>
            <p style={{ fontSize: "16px", fontWeight: 900, color: "#f4f4f5", marginBottom: "4px" }}>
              🎰 BPガチャ
            </p>
            <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "16px" }}>
              10連最後は250BP以上保証・100回天井あり
            </p>

            {/* 排出率テーブル */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "20px" }}>
              {GACHA_TABLE.map(({ bp, pct, rarity }) => {
                const style = RARITY_STYLE[rarity];
                return (
                  <div
                    key={bp}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#27272a", borderRadius: "8px", padding: "6px 10px" }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: style.color }}>
                      {bp.toLocaleString()}BP
                    </span>
                    <span style={{ fontSize: "10px", color: "#52525b" }}>{pct}</span>
                  </div>
                );
              })}
            </div>

            {errMsg && (
              <p style={{ fontSize: "12px", color: "#f87171", marginBottom: "12px", textAlign: "center" }}>
                {errMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <button
                onClick={() => handleSpin(false)}
                disabled={spinning}
                style={{
                  flex:         1,
                  padding:      "13px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   spinning ? "#4c1d95" : "linear-gradient(135deg,#7c3aed,#6366f1)",
                  color:        "#fff",
                  fontSize:     "13px",
                  fontWeight:   700,
                  cursor:       spinning ? "not-allowed" : "pointer",
                  opacity:      spinning ? 0.6 : 1,
                }}
              >
                {spinning ? "抽選中…" : "1回引く\n100BP"}
              </button>
              <button
                onClick={() => handleSpin(true)}
                disabled={spinning}
                style={{
                  flex:         1,
                  padding:      "13px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   spinning ? "#78350f" : "linear-gradient(135deg,#d97706,#dc2626)",
                  color:        "#fff",
                  fontSize:     "13px",
                  fontWeight:   700,
                  cursor:       spinning ? "not-allowed" : "pointer",
                  opacity:      spinning ? 0.6 : 1,
                }}
              >
                {spinning ? "抽選中…" : "10連\n1000BP"}
              </button>
            </div>

            <button
              onClick={handleClose}
              disabled={spinning}
              style={{
                width:        "100%",
                padding:      "11px",
                borderRadius: "12px",
                border:       "1px solid rgba(255,255,255,0.12)",
                background:   "transparent",
                color:        "#a1a1aa",
                fontSize:     "13px",
                fontWeight:   600,
                cursor:       spinning ? "not-allowed" : "pointer",
              }}
            >
              閉じる
            </button>
          </>
        )}
      </div>
    </div>
  );
}
