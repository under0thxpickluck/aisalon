"use client";

import { useEffect, useState } from "react";

type Item = { title: string; ep: number };

type Props = {
  items: Item[];
  onClose: () => void;
};

export default function MusicSellApprovedModal({ items, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const totalEp = items.reduce((sum, i) => sum + i.ep, 0);

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
        backgroundColor: "rgba(0,0,0,0.6)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        cursor: "pointer",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#18181b] border-slate-200 dark:border-white/[0.08]"
        style={{
          borderRadius: "16px",
          padding: "24px",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          maxWidth: "340px",
          width: "90%",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          cursor: "default",
          border: "1px solid",
        }}
      >
        <p
          className="text-slate-500 dark:text-[#a1a1aa]"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            margin: "0 0 8px",
          }}
        >
          楽曲売却申請
        </p>

        <p style={{ fontSize: "28px", margin: "0 0 4px" }}>🎵</p>

        <p
          className="text-slate-900 dark:text-[#f4f4f5]"
          style={{
            fontSize: "15px",
            fontWeight: 700,
            margin: "0 0 16px",
          }}
        >
          売却申請が承認されました！
        </p>

        {items.length > 1 ? (
          <div style={{ marginBottom: "16px" }}>
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <span className="text-slate-700 dark:text-[#d4d4d8]" style={{ fontSize: "13px", textAlign: "left", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#34d399", marginLeft: "8px" }}>
                  +{item.ep} EP
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-[#a1a1aa]" style={{ fontSize: "13px", margin: "0 0 8px" }}>
            {items[0]?.title}
          </p>
        )}

        <p
          style={{
            fontSize: "40px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: "#34d399",
            margin: "0 0 8px",
          }}
        >
          +{totalEp} EP 獲得！
        </p>

        <p
          className="text-slate-500 dark:text-[#a1a1aa]"
          style={{
            fontSize: "12px",
            margin: "0 0 24px",
          }}
        >
          EPはウォレットに反映されました
        </p>

        <button
          onClick={handleClose}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            background: "#34d399",
            color: "#000",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          確認する
        </button>
      </div>
    </div>
  );
}
