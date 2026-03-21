"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type RumbleStatus = {
  entered_today: boolean;
  today_score:   number | null;
  today_rp:      number | null;
  week_rp:       number;
  week_id:       string;
};

type RankingEntry = { user_id: string; total_rp: number };

type Equipment = {
  id: string; slot: string; rarity: string;
  name: string; bonus: number; equipped: boolean;
};

type GachaResult = {
  item: { id: string; slot: string; rarity: string; name: string; bonus: number };
  bp: number;
};

const RARITY_COLOR: Record<string, string> = {
  common:    "text-gray-400",
  rare:      "text-blue-400",
  epic:      "text-purple-400",
  legendary: "text-yellow-400",
  mythic:    "text-red-400",
};

const RARITY_BG: Record<string, string> = {
  common:    "border-gray-600",
  rare:      "border-blue-500",
  epic:      "border-purple-500",
  legendary: "border-yellow-500",
  mythic:    "border-red-500",
};

const TAB_LIST = ["バトル", "ランキング", "装備", "ガチャ"] as const;
type Tab = typeof TAB_LIST[number];

export default function RumblePage() {
  const [userId, setUserId]       = useState("");
  const [tab, setTab]             = useState<Tab>("バトル");
  const [status, setStatus]       = useState<RumbleStatus | null>(null);
  const [ranking, setRanking]     = useState<RankingEntry[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [busy, setBusy]           = useState(false);
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [msg, setMsg]             = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) { const auth = JSON.parse(raw); setUserId(String(auth?.id ?? "")); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/rumble/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setStatus(d); }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (tab !== "ランキング") return;
    fetch("/api/minigames/rumble/ranking")
      .then(r => r.json()).then(d => { if (d.ok) setRanking(d.ranking); }).catch(() => {});
  }, [tab]);

  useEffect(() => {
    if (tab !== "装備") return;
    fetch(`/api/minigames/rumble/equipment?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setEquipment(d.items); }).catch(() => {});
  }, [tab, userId]);

  const handleEntry = async () => {
    if (!userId || busy) return;
    setBusy(true); setMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (data.ok) {
        setStatus(prev => prev ? { ...prev, entered_today: true, today_score: data.score, today_rp: data.rp, week_rp: prev.week_rp + data.rp } : prev);
        setMsg(`🎉 スコア: ${data.score} / RP: ${data.rp} 獲得！`);
      } else {
        if (data.error === "already_entered_today") setMsg("本日はすでに参加済みです");
        else if (data.error === "insufficient_bp")  setMsg(`BP不足です（残高: ${data.bp}BP）`);
        else setMsg("エラーが発生しました");
      }
    } catch { setMsg("通信エラーが発生しました"); }
    finally { setBusy(false); }
  };

  const handleGacha = async () => {
    if (!userId || busy) return;
    setBusy(true); setGachaResult(null); setMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/gacha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (data.ok) { setGachaResult(data); }
      else {
        if (data.error === "insufficient_bp") setMsg(`BP不足です（残高: ${data.bp}BP）`);
        else setMsg("エラーが発生しました");
      }
    } catch { setMsg("通信エラーが発生しました"); }
    finally { setBusy(false); }
  };

  const handleEquip = async (itemId: string) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const res  = await fetch("/api/minigames/rumble/equip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, itemId }) });
      const data = await res.json();
      if (data.ok) {
        const eqRes  = await fetch(`/api/minigames/rumble/equipment?userId=${encodeURIComponent(userId)}`);
        const eqData = await eqRes.json();
        if (eqData.ok) setEquipment(eqData.items);
      }
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-md mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/mini-games" className="text-white/40 text-sm">← Arcade</Link>
        <h1 className="font-bold text-lg">⚔️ Rumble League</h1>
        <div className="w-16" />
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
        {TAB_LIST.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${tab === t ? "bg-purple-600 text-white" : "text-white/40"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* バトルタブ */}
      {tab === "バトル" && (
        <div className="space-y-4">
          {/* 週間RP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-xs text-white/40 mb-1">今週のRP</p>
              <p className="text-2xl font-black text-purple-400">{status?.week_rp ?? 0}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-xs text-white/40 mb-1">今日のスコア</p>
              <p className="text-2xl font-black text-white">{status?.today_score ?? "-"}</p>
            </div>
          </div>

          {/* 参加ボタン */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-sm text-white/50 mb-2">参加費：100BP / 日</p>
            <p className="text-xs text-white/30 mb-4">月〜金 毎日19:00 JST</p>
            {status?.entered_today ? (
              <div>
                <div className="text-4xl mb-2">✅</div>
                <p className="font-bold text-green-400">本日参加済み</p>
                <p className="text-sm text-white/40 mt-1">スコア: {status.today_score} / RP: {status.today_rp}</p>
              </div>
            ) : (
              <button onClick={handleEntry} disabled={busy}
                className={`w-full py-4 rounded-xl font-black text-lg transition ${busy ? "bg-white/10 text-white/30" : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"}`}>
                {busy ? "参加中..." : "⚔️ バトル参加！"}
              </button>
            )}
          </div>

          {msg && (
            <div className={`rounded-xl p-3 text-sm text-center ${msg.includes("🎉") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {msg}
            </div>
          )}

          {/* ルール説明 */}
          <div className="bg-white/5 rounded-xl p-4 text-xs text-white/40 space-y-1">
            <p>• スコア = 100 + 装備ボーナス + 乱数（0〜50）</p>
            <p>• 月〜金の累計RPで週次ランキング決定</p>
            <p>• 金曜終了後にランキングリセット</p>
          </div>
        </div>
      )}

      {/* ランキングタブ */}
      {tab === "ランキング" && (
        <div className="space-y-2">
          <p className="text-xs text-white/40 text-center mb-4">週間累計RPランキング</p>
          {ranking.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">まだ参加者がいません</p>
          ) : ranking.map((r, i) => (
            <div key={r.user_id} className={`flex items-center justify-between p-3 rounded-xl ${r.user_id === userId ? "bg-purple-500/20 border border-purple-500/30" : "bg-white/5"}`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-white/40"}`}>
                  {i + 1}
                </span>
                <span className="text-sm">{r.user_id === userId ? "👤 " + r.user_id : r.user_id}</span>
              </div>
              <span className="font-bold text-purple-400">{r.total_rp} RP</span>
            </div>
          ))}
        </div>
      )}

      {/* 装備タブ */}
      {tab === "装備" && (
        <div className="space-y-3">
          <p className="text-xs text-white/40 text-center mb-2">装備してスコアを強化しよう</p>
          {["head","body","hand","leg"].map(slot => {
            const slotItems = equipment.filter(e => e.slot === slot);
            const equipped  = slotItems.find(e => e.equipped);
            return (
              <div key={slot} className="bg-white/5 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-2">
                  {slot === "head" ? "🪖 頭" : slot === "body" ? "🛡️ 胴" : slot === "hand" ? "🧤 手" : "👢 足"}
                  {equipped && <span className={`ml-2 ${RARITY_COLOR[equipped.rarity]}`}>{equipped.name} (+{equipped.bonus})</span>}
                  {!equipped && <span className="ml-2 text-white/20">未装備</span>}
                </p>
                <div className="space-y-1">
                  {slotItems.map(item => (
                    <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border ${RARITY_BG[item.rarity]} bg-white/3`}>
                      <span className={`text-xs ${RARITY_COLOR[item.rarity]}`}>{item.name} (+{item.bonus})</span>
                      <button onClick={() => handleEquip(item.id)} disabled={item.equipped || busy}
                        className={`text-xs px-2 py-1 rounded ${item.equipped ? "bg-green-500/20 text-green-400" : "bg-purple-600 text-white"}`}>
                        {item.equipped ? "装備中" : "装備"}
                      </button>
                    </div>
                  ))}
                  {slotItems.length === 0 && <p className="text-xs text-white/20">なし</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ガチャタブ */}
      {tab === "ガチャ" && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">🎲</p>
            <p className="font-bold text-lg mb-1">装備ガチャ</p>
            <p className="text-sm text-white/40 mb-4">100BP / 1回</p>
            <button onClick={handleGacha} disabled={busy}
              className={`w-full py-4 rounded-xl font-black text-lg transition ${busy ? "bg-white/10 text-white/30" : "bg-gradient-to-r from-yellow-600 to-orange-600 hover:scale-105"}`}>
              {busy ? "抽選中..." : "🎲 ガチャを引く！"}
            </button>
          </div>

          {gachaResult && (
            <div className={`bg-white/5 border-2 ${RARITY_BG[gachaResult.item.rarity]} rounded-2xl p-6 text-center`}>
              <p className={`text-xs font-bold uppercase mb-1 ${RARITY_COLOR[gachaResult.item.rarity]}`}>{gachaResult.item.rarity}</p>
              <p className="text-2xl font-black mb-1">{gachaResult.item.name}</p>
              <p className="text-sm text-white/60">{gachaResult.item.slot} / +{gachaResult.item.bonus}ボーナス</p>
            </div>
          )}

          {msg && <div className="bg-red-500/10 text-red-400 rounded-xl p-3 text-sm text-center">{msg}</div>}

          {/* 排出率 */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs font-bold text-white/60 mb-2">排出率</p>
            {[
              { rarity: "Common",    prob: "80%",      color: "text-gray-400" },
              { rarity: "Rare",      prob: "15%",      color: "text-blue-400" },
              { rarity: "Epic",      prob: "4%",       color: "text-purple-400" },
              { rarity: "Legendary", prob: "0.9995%",  color: "text-yellow-400" },
              { rarity: "Mythic",    prob: "0.0005%",  color: "text-red-400" },
            ].map(r => (
              <div key={r.rarity} className="flex justify-between text-xs py-1">
                <span className={r.color}>{r.rarity}</span>
                <span className="text-white/40">{r.prob}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
