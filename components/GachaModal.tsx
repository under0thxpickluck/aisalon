"use client";

// components/GachaModal.tsx
import { useEffect, useState } from "react";

type GachaResult = {
  prize_bp:   number;
  net:        number;
  bp_balance: number;
};

type Props = {
  loginId:    string;
  onClose:    () => void;
  onBpEarned: (amount: number) => void;
};

const GACHA_TABLE = [
  { bp: 50,   pct: "40%" },
  { bp: 100,  pct: "30%" },
  { bp: 200,  pct: "15%" },
  { bp: 500,  pct: "10%" },
  { bp: 1000, pct: "4%"  },
  { bp: 5000, pct: "1%"  },
] as const;

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

  const handleSpin = async () => {
    if (spinning || !loginId) return;
    setSpinning(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/gacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));

      if (!data.ok) {
        const reason = data.reason || data.error || "failed";
        setErrMsg(
          reason === "insufficient_bp"
            ? "BPが不足しています（100BP必要）"
            : `エラー: ${reason}`
        );
        return;
      }

      setResult({
        prize_bp:   data.prize_bp,
        net:        data.net,
        bp_balance: data.bp_balance,
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
          background:  "#18181b",
          borderRadius: "16px",
          padding:     "24px",
          maxWidth:    "360px",
          width:       "90%",
          boxShadow:   "0 32px 80px rgba(0,0,0,0.5)",
          border:      "1px solid rgba(255,255,255,0.08)",
          transform:   visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition:  "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          cursor:      "default",
        }}
      >
        {/* ===== 結果画面 ===== */}
        {result ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#a1a1aa", marginBottom: "16px" }}>
              🎰 BPガチャ 結果
            </p>

            <p
              style={{
                fontSize:     "40px",
                fontWeight:   900,
                color:        "#f59e0b",
                letterSpacing: "-0.02em",
                margin:       "0 0 8px",
              }}
            >
              ✨ +{result.prize_bp}BP 獲得！
            </p>

            <p
              style={{
                fontSize:   "13px",
                fontWeight: 700,
                color:      result.net >= 0 ? "#4ade80" : "#f87171",
                marginBottom: "24px",
              }}
            >
              {result.net >= 0
                ? `+${result.net}BPのプラス！`
                : `${result.net}BPのマイナス`}
            </p>

            <p style={{ fontSize: "11px", color: "#71717a", marginBottom: "20px" }}>
              現在の残高: {result.bp_balance}BP
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleAgain}
                style={{
                  flex:         1,
                  padding:      "12px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   "#f59e0b",
                  color:        "#000",
                  fontSize:     "14px",
                  fontWeight:   700,
                  cursor:       "pointer",
                }}
              >
                もう一度
              </button>
              <button
                onClick={handleClose}
                style={{
                  flex:         1,
                  padding:      "12px",
                  borderRadius: "12px",
                  border:       "1px solid rgba(255,255,255,0.12)",
                  background:   "transparent",
                  color:        "#a1a1aa",
                  fontSize:     "14px",
                  fontWeight:   700,
                  cursor:       "pointer",
                }}
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
              100BPを消費して抽選します
            </p>

            {/* 排出率テーブル */}
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "1fr 1fr",
                gap:                 "6px",
                marginBottom:        "20px",
              }}
            >
              {GACHA_TABLE.map(({ bp, pct }) => (
                <div
                  key={bp}
                  style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                    background:     "#27272a",
                    borderRadius:   "8px",
                    padding:        "6px 10px",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b" }}>
                    {bp.toLocaleString()}BP
                  </span>
                  <span style={{ fontSize: "11px", color: "#71717a" }}>{pct}</span>
                </div>
              ))}
            </div>

            {errMsg && (
              <p style={{ fontSize: "12px", color: "#f87171", marginBottom: "12px", textAlign: "center" }}>
                {errMsg}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={handleSpin}
                disabled={spinning}
                style={{
                  width:        "100%",
                  padding:      "13px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   spinning ? "#78350f" : "#f59e0b",
                  color:        "#000",
                  fontSize:     "14px",
                  fontWeight:   700,
                  cursor:       spinning ? "not-allowed" : "pointer",
                  opacity:      spinning ? 0.7 : 1,
                }}
              >
                {spinning ? "抽選中…" : "🎰 スピン（100BP）"}
              </button>

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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
