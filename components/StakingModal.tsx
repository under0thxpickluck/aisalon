"use client";

// components/StakingModal.tsx
// epbp.md 仕様: 日次プール分配型ステーキング（BP / EP）
// IS_ENABLED = false の間はフォームを表示するが操作不可（調整中グレーアウト）

import { useEffect, useState } from "react";

// ★ここをtrueにすると機能が有効になる
const IS_ENABLED = false;

type AssetType = "BP" | "EP";
type LockDays  = 30 | 60 | 90;

const PLANS = [
  { days: 30 as LockDays, weight: 1.00, label: "30日", weightLabel: "×1.00" },
  { days: 60 as LockDays, weight: 1.04, label: "60日", weightLabel: "×1.04" },
  { days: 90 as LockDays, weight: 1.10, label: "90日", weightLabel: "×1.10" },
];

// 仮のプール情報（実装後はAPIから取得）
const MOCK_POOL: Record<AssetType, { dailyPool: number; totalEffective: number }> = {
  BP: { dailyPool: 120,  totalEffective: 5000   },
  EP: { dailyPool: 5000, totalEffective: 200000 },
};

function formatDate(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  loginId:     string;
  onClose:     () => void;
  onBpChanged: () => void;
};

export default function StakingModal({ loginId: _loginId, onClose, onBpChanged: _onBpChanged }: Props) {
  const [visible,     setVisible]     = useState(false);
  const [asset,       setAsset]       = useState<AssetType>("BP");

  // BP / EP それぞれ独立したステート
  const [bpAmount,    setBpAmount]    = useState("");
  const [bpDays,      setBpDays]      = useState<LockDays>(30);
  const [epAmount,    setEpAmount]    = useState("");
  const [epDays,      setEpDays]      = useState<LockDays>(30);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  // 現在選択中アセットの値
  const amount      = asset === "BP" ? bpAmount    : epAmount;
  const setAmount   = asset === "BP" ? setBpAmount : setEpAmount;
  const selectedDays = asset === "BP" ? bpDays      : epDays;
  const setDays      = asset === "BP" ? setBpDays   : setEpDays;

  const pool        = MOCK_POOL[asset];
  const plan        = PLANS.find((p) => p.days === selectedDays)!;
  const amountNum   = Number(amount);
  const hasPreview  = amountNum >= 1;

  const effectiveAmount = hasPreview ? amountNum * plan.weight : 0;
  const estimatedDaily  = hasPreview
    ? (effectiveAmount / (pool.totalEffective + effectiveAmount)) * pool.dailyPool
    : 0;
  const estimatedYieldPct = pool.totalEffective > 0
    ? (pool.dailyPool / pool.totalEffective) * 100
    : 0;
  const matureDate = hasPreview
    ? formatDate(new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000).toISOString())
    : "";

  // グレーアウト用スタイル（タブ以外に適用）
  const disabledStyle: React.CSSProperties = IS_ENABLED
    ? {}
    : { pointerEvents: "none", opacity: 0.45 };

  return (
    <div
      onClick={handleClose}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          9999,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        backgroundColor: "rgba(0,0,0,0.65)",
        opacity:         visible ? 1 : 0,
        transition:      "opacity 0.3s ease",
        cursor:          "pointer",
        overflowY:       "auto",
        padding:         "24px 0",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   "#18181b",
          borderRadius: "16px",
          padding:      "24px",
          maxWidth:     "400px",
          width:        "90%",
          boxShadow:    "0 32px 80px rgba(0,0,0,0.5)",
          border:       "1px solid rgba(255,255,255,0.08)",
          transform:    visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition:   "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          cursor:       "default",
        }}
      >
        {/* ===== ヘッダー ===== */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 900, color: "#f4f4f5", margin: 0 }}>
              💎 BP/EP ステーキング
            </p>
            <p style={{ fontSize: "11px", color: "#71717a", margin: "2px 0 0" }}>
              預けた分だけ日次プールを分配
            </p>
          </div>
          {!IS_ENABLED && (
            <span style={{
              background:   "rgba(245,158,11,0.15)",
              border:       "1px solid rgba(245,158,11,0.4)",
              borderRadius: "8px",
              padding:      "4px 10px",
              fontSize:     "11px",
              fontWeight:   700,
              color:        "#f59e0b",
              flexShrink:   0,
            }}>
              🔧 調整中
            </span>
          )}
        </div>

        {/* ===== 調整中バナー ===== */}
        {!IS_ENABLED && (
          <div style={{
            background:   "rgba(245,158,11,0.08)",
            border:       "1px solid rgba(245,158,11,0.25)",
            borderRadius: "10px",
            padding:      "10px 14px",
            marginBottom: "18px",
            fontSize:     "12px",
            color:        "#fbbf24",
            lineHeight:   1.6,
          }}>
            ⚠️ 現在このシステムは調整中です。<br />
            まもなく公開予定ですので、少々お待ちください。
          </div>
        )}

        {/* ===== BP / EP タブ（グレーアウト外 — 常にクリック可能） ===== */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          {(["BP", "EP"] as AssetType[]).map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              style={{
                flex:         1,
                padding:      "9px",
                borderRadius: "10px",
                border:       asset === a ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
                background:   asset === a ? "rgba(245,158,11,0.15)" : "transparent",
                color:        asset === a ? "#f59e0b" : "#71717a",
                fontSize:     "13px",
                fontWeight:   700,
                cursor:       "pointer",
                transition:   "all 0.15s ease",
              }}
            >
              {a} ステーキング
            </button>
          ))}
        </div>

        {/* ===== フォーム本体（IS_ENABLED=false のときグレーアウト） ===== */}
        <div style={disabledStyle}>

          {/* プール情報 */}
          <div style={{
            background:          "#27272a",
            borderRadius:        "10px",
            padding:             "12px",
            marginBottom:        "18px",
            display:             "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap:                 "8px",
            textAlign:           "center",
          }}>
            <div>
              <p style={{ fontSize: "10px", color: "#71717a", margin: "0 0 2px" }}>日次プール</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                {pool.dailyPool.toLocaleString()} {asset}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "10px", color: "#71717a", margin: "0 0 2px" }}>総ステーク</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                {pool.totalEffective.toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "10px", color: "#71717a", margin: "0 0 2px" }}>推定利回り</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#4ade80", margin: 0 }}>
                〜{estimatedYieldPct.toFixed(1)}%/日
              </p>
            </div>
          </div>

          {/* ロック期間選択 */}
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#71717a", marginBottom: "8px" }}>
            ロック期間（重み）
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {PLANS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                style={{
                  flex:         1,
                  padding:      "8px 4px",
                  borderRadius: "10px",
                  border:       selectedDays === p.days ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
                  background:   selectedDays === p.days ? "rgba(245,158,11,0.15)" : "transparent",
                  color:        selectedDays === p.days ? "#f59e0b" : "#a1a1aa",
                  fontSize:     "12px",
                  fontWeight:   700,
                  cursor:       "pointer",
                  textAlign:    "center",
                }}
              >
                <div>{p.label}</div>
                <div style={{ fontSize: "10px", marginTop: "3px", opacity: 0.8 }}>{p.weightLabel}</div>
              </button>
            ))}
          </div>

          {/* 入力 */}
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`預ける${asset}数`}
            style={{
              width:        "100%",
              padding:      "10px 12px",
              borderRadius: "10px",
              border:       "1px solid rgba(255,255,255,0.12)",
              background:   "#27272a",
              color:        "#f4f4f5",
              fontSize:     "14px",
              outline:      "none",
              boxSizing:    "border-box",
              marginBottom: "4px",
            }}
          />
          <p style={{ fontSize: "11px", color: "#71717a", marginBottom: "12px" }}>
            報酬はプール参加状況により毎日変動します
          </p>

          {/* 予想サマリー */}
          {hasPreview && (
            <div style={{
              background:   "#27272a",
              borderRadius: "10px",
              padding:      "12px",
              marginBottom: "12px",
              fontSize:     "12px",
              color:        "#a1a1aa",
            }}>
              <Row label="預入"           value={`${amountNum.toLocaleString()} ${asset}`} />
              <Row label="実効量"         value={`${effectiveAmount.toFixed(2)} ${asset}（${plan.weightLabel}）`} />
              <Row label="見込み日次報酬" value={`〜${estimatedDaily.toFixed(2)} ${asset}/日`} valueColor="#4ade80" />
              <Row label="ロック満了"     value={`${plan.days}日後（${matureDate}）`} last />
            </div>
          )}

          {/* ステークボタン */}
          <button
            disabled
            style={{
              width:        "100%",
              padding:      "12px",
              borderRadius: "10px",
              border:       "none",
              background:   "#f59e0b",
              color:        "#000",
              fontSize:     "14px",
              fontWeight:   700,
              cursor:       "not-allowed",
              marginBottom: "20px",
              opacity:      0.6,
            }}
          >
            {asset}をステークする
          </button>

          {/* ポジション一覧 */}
          <p style={{ fontSize: "13px", fontWeight: 800, color: "#f4f4f5", marginBottom: "10px" }}>
            📋 ステーク中
          </p>
          <p style={{ fontSize: "12px", color: "#52525b", textAlign: "center", padding: "12px 0" }}>
            まだステークがありません
          </p>

        </div>{/* /disabledStyle */}

        {/* 閉じるボタン（常に有効） */}
        <button
          onClick={handleClose}
          style={{
            width:        "100%",
            marginTop:    "8px",
            padding:      "11px",
            borderRadius: "10px",
            border:       "1px solid rgba(255,255,255,0.12)",
            background:   "transparent",
            color:        "#a1a1aa",
            fontSize:     "13px",
            fontWeight:   600,
            cursor:       "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// ===== 内部ユーティリティ =====
function Row({
  label, value, valueColor, last,
}: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: last ? 0 : "4px" }}>
      <span>{label}</span>
      <span style={{ color: valueColor ?? "#f4f4f5", fontWeight: 700 }}>{value}</span>
    </div>
  );
}
