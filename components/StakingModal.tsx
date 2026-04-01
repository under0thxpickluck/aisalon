"use client";

// components/StakingModal.tsx
import { useEffect, useState } from "react";

type StakeItem = {
  stake_id:    string;
  staked_bp:   number;
  rate:        number;
  interest_bp: number;
  total_bp:    number;
  started_at:  string;
  expires_at:  string;
  status:      string;
  claimed_at:  string;
  claimable:   boolean;
};

type Props = {
  loginId:    string;
  onClose:    () => void;
  onBpChanged: () => void;
};

const STAKING_TUTORIAL_SLIDES = [
  {
    icon: "💎",
    title: "ステーキングとは？",
    body: "手持ちのBPを一定期間「預ける」と、満期後に利息付きで受け取れる仕組みです。銀行の定期預金のようなイメージ。預けたBPは満期まで引き出せないので、余裕のある分で運用しましょう。",
  },
  {
    icon: "📅",
    title: "3つのプランを選ぼう",
    body: "30日で+10%、60日で+25%、90日で+50%。期間が長いほど受取額が大きくなります。最低100BPから預けられます。BP数を入力するとリターンの予測が表示されます。",
  },
  {
    icon: "⚠️",
    title: "ステーキング率は変動します",
    body: "表示されているレート（+10% / +25% / +50%）は現在の基準値です。LIFAIのBP・EP流通率の状況によって今後変動する場合があります。あらかじめご了承のうえ、ご利用ください。",
  },
] as const;

const PLANS = [
  { days: 30 as const, rate: 0.10, label: "30日", desc: "+10%" },
  { days: 60 as const, rate: 0.25, label: "60日", desc: "+25%" },
  { days: 90 as const, rate: 0.50, label: "90日", desc: "+50%" },
];

function formatDate(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function expiresInDays(isoStr: string): number {
  if (!isoStr) return 0;
  return Math.ceil((new Date(isoStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function StakingModal({ loginId, onClose, onBpChanged }: Props) {
  const [visible,       setVisible]       = useState(false);
  const [amount,        setAmount]        = useState("");
  const [selectedDays,  setSelectedDays]  = useState<30 | 60 | 90>(30);
  const [stakes,        setStakes]        = useState<StakeItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [staking,       setStaking]       = useState(false);
  const [claiming,      setClaiming]      = useState<string | null>(null);
  const [errMsg,        setErrMsg]        = useState("");
  const [showTutorial,  setShowTutorial]  = useState(false);
  const [tutorialStep,  setTutorialStep]  = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const loadStakes = async () => {
    if (!loginId) { setLoading(false); return; }
    try {
      const res  = await fetch(`/api/staking?loginId=${encodeURIComponent(loginId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) setStakes(data.stakes ?? []);
    } catch {
      // サイレント失敗
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStakes(); }, [loginId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleStake = async () => {
    const bp = Number(amount);
    if (!bp || bp < 100) { setErrMsg("100BP以上で入力してください"); return; }
    setStaking(true);
    setErrMsg("");
    try {
      const res  = await fetch("/api/staking", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ loginId, amount: bp, days: selectedDays }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        const reason = data.reason || data.error || "failed";
        setErrMsg(
          reason === "insufficient_bp" ? "BPが不足しています" :
          reason === "min_100"         ? "最低100BP必要です"  :
          `エラー: ${reason}`
        );
        return;
      }
      setAmount("");
      onBpChanged();
      await loadStakes();
    } catch {
      setErrMsg("通信エラーが発生しました");
    } finally {
      setStaking(false);
    }
  };

  const handleClaim = async (stakeId: string) => {
    setClaiming(stakeId);
    try {
      const res  = await fetch("/api/staking", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ loginId, stake_id: stakeId }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        onBpChanged();
        await loadStakes();
      }
    } catch {
      // サイレント失敗
    } finally {
      setClaiming(null);
    }
  };

  const selectedPlan = PLANS.find((p) => p.days === selectedDays)!;
  const amountNum    = Number(amount);
  const hasPreview   = amountNum >= 100;
  const interestBp   = hasPreview ? Math.floor(amountNum * selectedPlan.rate) : 0;
  const totalBp      = hasPreview ? amountNum + interestBp : 0;
  const matureDate   = hasPreview
    ? formatDate(new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000).toISOString())
    : "";

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
        backgroundColor: "rgba(0,0,0,0.6)",
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
        {/* ===== チュートリアル画面 ===== */}
        {showTutorial ? (
          <div style={{ textAlign: "center" }}>
            {/* スライドインジケーター */}
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "20px" }}>
              {STAKING_TUTORIAL_SLIDES.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height:       "6px",
                    borderRadius: "999px",
                    background:   i === tutorialStep ? "#f59e0b" : "rgba(255,255,255,0.12)",
                    width:        i === tutorialStep ? "24px" : "6px",
                    transition:   "width 0.2s ease, background 0.2s ease",
                  }}
                />
              ))}
            </div>

            <div style={{ fontSize: "40px", marginBottom: "12px" }}>
              {STAKING_TUTORIAL_SLIDES[tutorialStep].icon}
            </div>
            <p style={{ fontSize: "15px", fontWeight: 900, color: "#f4f4f5", marginBottom: "10px" }}>
              {STAKING_TUTORIAL_SLIDES[tutorialStep].title}
            </p>
            <p style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: 1.7, marginBottom: "24px", textAlign: "left" }}>
              {STAKING_TUTORIAL_SLIDES[tutorialStep].body}
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              {tutorialStep > 0 && (
                <button
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#a1a1aa", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  ← 戻る
                </button>
              )}
              {tutorialStep < STAKING_TUTORIAL_SLIDES.length - 1 ? (
                <button
                  onClick={() => setTutorialStep(tutorialStep + 1)}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  次へ →
                </button>
              ) : (
                <button
                  onClick={() => { setShowTutorial(false); setTutorialStep(0); }}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  はじめる
                </button>
              )}
            </div>
            <button
              onClick={() => { setShowTutorial(false); setTutorialStep(0); }}
              style={{ marginTop: "10px", width: "100%", background: "none", border: "none", color: "#52525b", fontSize: "12px", cursor: "pointer" }}
            >
              スキップ
            </button>
          </div>
        ) : (
        <>
        {/* ===== セクション1: 新規ステーク ===== */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "15px", fontWeight: 900, color: "#f4f4f5", margin: 0 }}>
            🔒 BPをステークする
          </p>
          <button
            onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
            title="使い方を見る"
            style={{ width: "26px", height: "26px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#a1a1aa", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          >
            ?
          </button>
        </div>

        {/* 期間選択 */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {PLANS.map((p) => (
            <button
              key={p.days}
              onClick={() => setSelectedDays(p.days)}
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
              <div style={{ fontSize: "11px", marginTop: "2px" }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* BP入力 */}
        <input
          type="number"
          min={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="ステークするBP数"
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
        <p style={{ fontSize: "11px", color: "#71717a", marginBottom: "12px" }}>最低100BP〜</p>

        {/* 予想リターン */}
        {hasPreview && (
          <div
            style={{
              background:   "#27272a",
              borderRadius: "10px",
              padding:      "12px",
              marginBottom: "12px",
              fontSize:     "12px",
              color:        "#a1a1aa",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>預入</span>
              <span style={{ color: "#f4f4f5", fontWeight: 700 }}>{amountNum.toLocaleString()}BP</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>利息</span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>+{interestBp.toLocaleString()}BP（{selectedPlan.desc}）</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>受取</span>
              <span style={{ color: "#f59e0b", fontWeight: 700 }}>{totalBp.toLocaleString()}BP</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>満期</span>
              <span style={{ color: "#f4f4f5" }}>{selectedDays}日後（{matureDate}）</span>
            </div>
          </div>
        )}

        {errMsg && (
          <p style={{ fontSize: "12px", color: "#f87171", marginBottom: "10px" }}>{errMsg}</p>
        )}

        <button
          onClick={handleStake}
          disabled={staking}
          style={{
            width:        "100%",
            padding:      "12px",
            borderRadius: "10px",
            border:       "none",
            background:   staking ? "#78350f" : "#f59e0b",
            color:        "#000",
            fontSize:     "14px",
            fontWeight:   700,
            cursor:       staking ? "not-allowed" : "pointer",
            opacity:      staking ? 0.7 : 1,
            marginBottom: "24px",
          }}
        >
          {staking ? "処理中…" : "ステークする"}
        </button>

        {/* ===== セクション2: ステーク一覧 ===== */}
        <p style={{ fontSize: "13px", fontWeight: 800, color: "#f4f4f5", marginBottom: "10px" }}>
          📋 ステーク中
        </p>

        {loading ? (
          <div style={{ height: "48px", background: "#27272a", borderRadius: "10px", animation: "pulse 1.5s infinite" }} />
        ) : stakes.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#71717a", textAlign: "center", padding: "16px 0" }}>
            まだステークがありません
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {stakes.map((s) => (
              <div
                key={s.stake_id}
                style={{
                  background:   "#27272a",
                  borderRadius: "10px",
                  padding:      "12px",
                  display:      "flex",
                  justifyContent: "space-between",
                  alignItems:   "center",
                  gap:          "8px",
                }}
              >
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                    {s.staked_bp.toLocaleString()}BP → {s.total_bp.toLocaleString()}BP
                    <span style={{ fontSize: "11px", color: "#a1a1aa", marginLeft: "6px" }}>
                      (+{Math.round(s.rate * 100)}%)
                    </span>
                  </p>
                  <p style={{ fontSize: "11px", color: "#71717a", margin: "2px 0 0" }}>
                    満期: {formatDate(s.expires_at)}
                    {s.status === "active" && !s.claimable && (
                      <span style={{ marginLeft: "6px" }}>（あと{expiresInDays(s.expires_at)}日）</span>
                    )}
                  </p>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {s.claimable ? (
                    <button
                      onClick={() => handleClaim(s.stake_id)}
                      disabled={claiming === s.stake_id}
                      style={{
                        padding:      "6px 12px",
                        borderRadius: "8px",
                        border:       "none",
                        background:   claiming === s.stake_id ? "#14532d" : "#16a34a",
                        color:        "#fff",
                        fontSize:     "12px",
                        fontWeight:   700,
                        cursor:       claiming === s.stake_id ? "not-allowed" : "pointer",
                      }}
                    >
                      {claiming === s.stake_id ? "処理中…" : "✅ 受け取る"}
                    </button>
                  ) : s.status === "claimed" ? (
                    <span
                      style={{
                        padding:      "4px 10px",
                        borderRadius: "8px",
                        background:   "#3f3f46",
                        color:        "#71717a",
                        fontSize:     "11px",
                        fontWeight:   600,
                      }}
                    >
                      受取済み
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#71717a" }}>⏳ 満期待ち</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 閉じるボタン */}
        <button
          onClick={handleClose}
          style={{
            width:        "100%",
            marginTop:    "16px",
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
        </>
        )}
      </div>
    </div>
  );
}
