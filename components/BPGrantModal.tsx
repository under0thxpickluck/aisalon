"use client";

// components/BPGrantModal.tsx
import { useEffect, useState } from "react";

type Props = {
  amount: number;
  onClose: () => void;
};

export default function BPGrantModal({ amount, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // マウント後に少し遅らせてフェードイン
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        cursor: "pointer",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(2,6,23,0.22)",
          maxWidth: "340px",
          width: "90%",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          cursor: "default",
        }}
      >
        {/* 画像 */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <img
            src="/getBP.png"
            alt="BP獲得"
            style={{ width: "120px", height: "120px", objectFit: "contain" }}
          />
        </div>

        {/* BP獲得テキスト */}
        <p
          style={{
            fontSize: "32px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}
        >
          +{amount} BP 獲得！
        </p>

        <p style={{ marginTop: "8px", fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
          売却BPが付与されました
        </p>

        <button
          onClick={handleClose}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "12px",
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "white",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
