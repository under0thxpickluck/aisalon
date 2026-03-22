"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const PLANS = [
  { id: "starter",  label: "Starter",  percent: 2,  price: 9,    slots: 10,  color: "from-gray-600 to-gray-500"     },
  { id: "light",    label: "Light",    percent: 5,  price: 29,   slots: 25,  color: "from-blue-700 to-blue-500"     },
  { id: "basic",    label: "Basic",    percent: 10, price: 59,   slots: 50,  color: "from-green-700 to-green-500"   },
  { id: "growth",   label: "Growth",   percent: 15, price: 99,   slots: 75,  color: "from-teal-700 to-teal-500"     },
  { id: "pro",      label: "Pro",      percent: 20, price: 149,  slots: 100, color: "from-purple-700 to-purple-500" },
  { id: "advanced", label: "Advanced", percent: 25, price: 199,  slots: 125, color: "from-indigo-700 to-indigo-500" },
  { id: "premium",  label: "Premium",  percent: 30, price: 299,  slots: 150, color: "from-pink-700 to-pink-500"     },
  { id: "elite",    label: "Elite",    percent: 35, price: 499,  slots: 175, color: "from-orange-700 to-orange-500" },
  { id: "master",   label: "Master",   percent: 40, price: 699,  slots: 200, color: "from-red-700 to-red-500"       },
  { id: "legend",   label: "Legend",   percent: 45, price: 1000, slots: 225, color: "from-yellow-600 to-yellow-400" },
];

type BoostStatus = {
  current_boost: {
    plan_id: string; percent: number; price_usd: number;
    slots_used: number; status: string; started_at: string; expires_at: string;
  } | null;
  total_slots: number;
  used_slots: number;
  available_slots: number;
};

export default function MusicBoostPage() {
  const [userId, setUserId]     = useState("");
  const [status, setStatus]     = useState<BoostStatus | null>(null);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) { const auth = JSON.parse(raw); setUserId(String(auth?.id ?? "")); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/music-boost/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setStatus(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSubscribe = async (planId: string) => {
    if (!userId || busy) return;
    setBusy(true); setMsg("");
    try {
      const res  = await fetch("/api/music-boost/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ ${PLANS.find(p => p.id === planId)?.label}プランを契約しました！`);
        const s = await fetch(`/api/music-boost/status?userId=${encodeURIComponent(userId)}`).then(r => r.json());
        if (s.ok) setStatus(s);
      } else {
        if (data.error === "no_slots_available") setMsg(`❌ 枠が不足しています（残り${data.available}枠、必要${data.needed}枠）`);
        else setMsg("❌ エラーが発生しました: " + data.error);
      }
    } catch { setMsg("❌ 通信エラーが発生しました"); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!userId || busy || !confirm("本当に解約しますか？")) return;
    setBusy(true); setMsg("");
    try {
      const res  = await fetch("/api/music-boost/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg("✅ 解約しました");
        const s = await fetch(`/api/music-boost/status?userId=${encodeURIComponent(userId)}`).then(r => r.json());
        if (s.ok) setStatus(s);
      } else { setMsg("❌ エラー: " + data.error); }
    } catch { setMsg("❌ 通信エラー"); }
    finally { setBusy(false); }
  };

  const currentPlan = status?.current_boost ? PLANS.find(p => p.id === status.current_boost!.plan_id) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/top" className="text-white/40 text-sm">← Back</Link>
        <h1 className="font-bold text-lg">🚀 Music Boost</h1>
        <div className="w-16" />
      </div>

      {/* 説明 */}
      <div className="bg-white/5 rounded-xl p-4 mb-6 text-sm text-white/60">
        <p>音楽ブーストは、企業案件や協力依頼時の優先度を高める月額オプションです。</p>
        <p className="mt-1">ブースト率が高いほど優先的に提案されやすくなります。</p>
        <p className="mt-1 text-white/30 text-xs">本機能は共有枠を使用するため、空きがない場合は新規契約・変更ができません。</p>
      </div>

      {/* 枠状況 */}
      {status && (
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/60">全体枠</span>
            <span className="font-bold">{status.used_slots.toLocaleString()} / {status.total_slots.toLocaleString()}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, (status.used_slots / status.total_slots) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-1">残り {status.available_slots.toLocaleString()} 枠</p>
        </div>
      )}

      {/* 現在のブースト */}
      {status?.current_boost && currentPlan && (
        <div className={`bg-gradient-to-r ${currentPlan.color} rounded-xl p-5 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-xl">{currentPlan.label}</span>
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">契約中</span>
          </div>
          <p className="text-3xl font-black mb-1">{status.current_boost.percent}%</p>
          <p className="text-white/80 text-sm mb-3">${status.current_boost.price_usd}/月</p>
          <p className="text-white/60 text-xs">
            有効期限: {new Date(status.current_boost.expires_at).toLocaleDateString("ja-JP")}
          </p>
          <button onClick={handleCancel} disabled={busy}
            className="mt-4 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition">
            解約する
          </button>
        </div>
      )}

      {msg && (
        <div className={`rounded-xl p-3 text-sm text-center mb-4 ${msg.startsWith("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {msg}
        </div>
      )}

      {/* プラン一覧 */}
      <h2 className="font-bold text-sm text-white/60 mb-3">
        {status?.current_boost ? "プランを変更する" : "プランを選ぶ"}
      </h2>
      <div className="space-y-3">
        {PLANS.map(plan => {
          const isCurrent  = status?.current_boost?.plan_id === plan.id;
          const canAfford  = status ? plan.slots - (isCurrent ? plan.slots : 0) <= status.available_slots : true;
          return (
            <div key={plan.id}
              onClick={() => setSelected(selected === plan.id ? null : plan.id)}
              className={`rounded-xl p-4 border cursor-pointer transition ${
                isCurrent ? "border-purple-500 bg-purple-500/10" :
                selected === plan.id ? "border-white/30 bg-white/10" :
                "border-white/10 bg-white/5 hover:bg-white/8"
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${plan.color}`} />
                  <div>
                    <p className="font-bold">{plan.label}</p>
                    <p className="text-xs text-white/40">{plan.slots}枠使用</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-purple-400">{plan.percent}%</p>
                  <p className="text-sm text-white/60">${plan.price}/月</p>
                </div>
              </div>
              {selected === plan.id && !isCurrent && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSubscribe(plan.id); }}
                  disabled={busy || !canAfford}
                  className={`w-full mt-3 py-2 rounded-lg text-sm font-bold transition ${
                    canAfford
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}>
                  {busy ? "処理中..." : canAfford ? `${plan.label}プランを契約` : "枠不足"}
                </button>
              )}
              {isCurrent && (
                <p className="text-xs text-purple-400 mt-2">✓ 現在のプラン</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 注意書き */}
      <div className="mt-8 text-xs text-white/20 space-y-1">
        <p>• EPは換金不可です</p>
        <p>• ブースト率・枠数は予告なく変更される場合があります</p>
        <p>• 不正利用が確認された場合はアカウントを停止します</p>
        <p>• 運営判断で報酬・優先度の調整を行うことがあります</p>
      </div>
    </div>
  );
}
