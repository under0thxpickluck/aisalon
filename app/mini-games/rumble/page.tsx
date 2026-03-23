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

type RankingEntry = { user_id: string; total_rp: number; display_name: string };

type Equipment = {
  id: string; slot: string; rarity: string;
  name: string; bonus: number; equipped: boolean;
  enhance_level?: number; luck?: number; stability?: number;
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
  const [countdown, setCountdown] = useState("");
  const [shards, setShards]       = useState(0);
  const [enhanceResult, setEnhanceResult] = useState<{result:string; after_level:number; shard_spent:number} | null>(null);
  const [rankContext, setRankContext] = useState<any>(null);
  const [showHelp, setShowHelp]         = useState(false);
  const [showEquipHelp, setShowEquipHelp] = useState(false);
  const [showRankHelp, setShowRankHelp]   = useState(false);
  const [displayName, setDisplayName]     = useState("");
  const [nameInput, setNameInput]         = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameBusy, setNameBusy]           = useState(false);
  const [nameMsg, setNameMsg]             = useState("");

  useEffect(() => {
    const seen = localStorage.getItem("rumble_help_seen");
    if (!seen) setShowHelp(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) { const auth = JSON.parse(raw); setUserId(String(auth?.id ?? "")); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem(`rumble_display_name_${userId}`);
    if (saved) { setDisplayName(saved); setNameInput(saved); }
  }, [userId]);

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

  useEffect(() => {
    const calcCountdown = () => {
      const now    = new Date();
      const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const target = new Date(nowJst);
      target.setHours(19, 0, 0, 0);
      if (nowJst.getHours() >= 19) target.setDate(target.getDate() + 1);
      while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
      const diff = target.getTime() - nowJst.getTime();
      const h    = Math.floor(diff / 3600000);
      const m    = Math.floor((diff % 3600000) / 60000);
      const s    = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/rumble/shard-status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setShards(d.shards); }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (tab !== "ランキング" || !userId) return;
    fetch(`/api/minigames/rumble/my-rank-context?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setRankContext(d); }).catch(() => {});
  }, [tab, userId]);

  const handleSetName = async () => {
    const trimmed = nameInput.trim();
    if (!userId || nameBusy) return;
    setNameBusy(true); setNameMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/set-name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, display_name: trimmed }) });
      const data = await res.json();
      if (data.ok) {
        setDisplayName(trimmed);
        localStorage.setItem(`rumble_display_name_${userId}`, trimmed);
        setNameMsg("保存しました！");
        setTimeout(() => { setShowNameModal(false); setNameMsg(""); }, 1000);
      } else {
        if (data.error === "name_too_long") setNameMsg("16文字以内で入力してください");
        else if (data.error === "invalid_chars") setNameMsg("使用できない文字が含まれています");
        else setNameMsg("エラーが発生しました");
      }
    } catch { setNameMsg("通信エラー"); }
    finally { setNameBusy(false); }
  };

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

  const handleDismantle = async (itemId: string) => {
    if (!userId || busy) return;
    if (!confirm("本当に分解しますか？")) return;
    setBusy(true);
    try {
      const res  = await fetch("/api/minigames/rumble/dismantle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, itemId }) });
      const data = await res.json();
      if (data.ok) {
        setShards(data.remaining_shard);
        setEquipment(prev => prev.filter(e => e.id !== itemId));
        setMsg(`🔨 分解完了！ +${data.gained_shard} shard`);
      } else { setMsg(data.error === "item_locked" ? "ロック中は分解できません" : "エラーが発生しました"); }
    } catch { setMsg("通信エラー"); } finally { setBusy(false); }
  };

  const handleEnhance = async (itemId: string) => {
    if (!userId || busy) return;
    setBusy(true); setEnhanceResult(null);
    try {
      const res  = await fetch("/api/minigames/rumble/enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, itemId }) });
      const data = await res.json();
      if (data.ok) {
        setShards(data.remaining_shard);
        setEnhanceResult({ result: data.result, after_level: data.after_level, shard_spent: data.shard_spent });
        if (data.result === "success") {
          setEquipment(prev => prev.map(e => e.id === itemId ? { ...e, bonus: data.updated.bonus, luck: data.updated.luck, stability: data.updated.stability, enhance_level: data.after_level } : e));
        }
      } else { setMsg(data.error === "insufficient_shard" ? `Shard不足（残高: ${data.shards}）` : "エラー"); }
    } catch { setMsg("通信エラー"); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-md mx-auto">
      {/* Rumbleルール説明モーダル */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">⚔️ Rumble Leagueとは？</h2>
            <div className="text-sm text-white/70 space-y-3">
              <div>
                <p className="font-bold text-white mb-1">■ 基本ルール</p>
                <p>・1日1回、100BPで参加</p>
                <p>・月〜金の5日間でランキングを競います</p>
                <p>・金曜日に最終順位が確定します</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ 勝敗の仕組み</p>
                <p>・スコアで順位が決まります</p>
                <p>・スコアはレベル・装備・運で決まります</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ 報酬</p>
                <p>・順位に応じてEPがもらえます</p>
                <p>・上位ほど報酬がアップ</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ ポイント</p>
                <p>・毎日参加するほど有利</p>
                <p>・装備を強化すると順位が上がりやすくなります</p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem("rumble_help_seen", "1");
                setShowHelp(false);
              }}
              className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold text-sm"
            >
              OK、はじめる！
            </button>
          </div>
        </div>
      )}

      {/* 装備説明モーダル */}
      {showEquipHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">🛡️ 装備について</h2>
            <div className="text-sm text-white/70 space-y-3">
              <div>
                <p className="font-bold text-white mb-1">■ 装備の特徴</p>
                <p>・4部位（頭・胴・手・足）に装着できます</p>
                <p>・同じ装備でも性能はランダムです</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ 強化</p>
                <p>・装備は強化してさらに強くできます</p>
                <p>・強化には素材（upgrade_shard）が必要です</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ 分解</p>
                <p>・不要な装備は素材に変換できます</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ ポイント</p>
                <p>・良い数値の装備を厳選するのが重要です</p>
              </div>
            </div>
            <button onClick={() => setShowEquipHelp(false)}
              className="w-full mt-5 py-3 rounded-xl bg-white/10 font-bold text-sm">
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ランキング説明モーダル */}
      {showRankHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">🏆 ランキングの見方</h2>
            <div className="text-sm text-white/70 space-y-3">
              <div>
                <p className="font-bold text-white mb-1">■ ランキングの見方</p>
                <p>・現在順位：あなたの位置</p>
                <p>・RP：ランキングポイント</p>
                <p>・報酬帯：現在もらえる報酬</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ ポイント</p>
                <p>・上の順位に近づくほど報酬アップ</p>
                <p>・参加しないと順位が下がることがあります</p>
              </div>
            </div>
            <button onClick={() => setShowRankHelp(false)}
              className="w-full mt-5 py-3 rounded-xl bg-white/10 font-bold text-sm">
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 表示名設定モーダル */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">✏️ 表示名を設定</h2>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={16}
              placeholder="16文字以内"
              className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none border border-white/10 focus:border-purple-500"
            />
            <p className="text-xs text-white/30 mb-4">{'使用不可: < > " \' & \\ /'}</p>
            {nameMsg && <p className={`text-xs text-center mb-3 ${nameMsg.includes("保存") ? "text-green-400" : "text-red-400"}`}>{nameMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNameModal(false); setNameMsg(""); }} className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-bold">キャンセル</button>
              <button onClick={handleSetName} disabled={nameBusy || !nameInput.trim()} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold disabled:opacity-40">
                {nameBusy ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/mini-games" className="text-white/40 text-sm">← Arcade</Link>
        <h1 className="font-bold text-lg">⚔️ Rumble League</h1>
        <button onClick={() => setShowHelp(true)} className="text-white/40 text-lg w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">?</button>
      </div>

      {/* 表示名バッジ */}
      <div className="flex justify-center mb-4">
        <button onClick={() => setShowNameModal(true)} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/60 hover:bg-white/10 transition">
          <span>👤</span>
          <span>{displayName || "表示名を設定"}</span>
          <span className="text-white/30">✏️</span>
        </button>
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

          {/* カウントダウン */}
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-xs text-white/40">次のバトルまで</p>
            <p className="text-2xl font-black text-purple-400 font-mono">{countdown}</p>
          </div>

          {/* 報酬帯 */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs font-bold text-white/60 mb-2">🏆 週次報酬</p>
            {[
              { label: "🥇 1位",    ep: 1500 },
              { label: "🥈 2位",    ep: 1000 },
              { label: "🥉 3位",    ep: 700  },
              { label: "4〜10位",   ep: 400  },
              { label: "11〜50位",  ep: 80   },
              { label: "51〜100位", ep: 10   },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs py-1">
                <span className="text-white/60">{r.label}</span>
                <span className="text-yellow-400">{r.ep.toLocaleString()} EP</span>
              </div>
            ))}
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
            <p>• スコア = 100 + レベルボーナス + 装備ボーナス + 乱数（0〜50）</p>
            <p>• 月〜金の累計RPで週次ランキング決定</p>
            <p>• 金曜終了後にランキングリセット</p>
          </div>
        </div>
      )}

      {/* ランキングタブ */}
      {tab === "ランキング" && (
        <div className="space-y-3">
          {/* 自分の順位カード */}
          {rankContext && !rankContext.not_entered && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-2xl text-purple-400">{rankContext.my_rank}位</span>
                <span className="text-white font-bold">{rankContext.my_rp} RP</span>
              </div>
              <p className="text-xs text-white/60 mb-3">現在の報酬帯: <span className="text-yellow-400">{rankContext.current_tier?.label} ({rankContext.current_tier?.ep?.toLocaleString()}EP)</span></p>
              {rankContext.next_better_tier && (
                <p className="text-xs text-green-400">▲ {rankContext.next_better_tier.label}まであと {rankContext.next_better_tier.rp_needed} RP</p>
              )}
              {rankContext.next_worse_tier && (
                <p className="text-xs text-red-400/70">▼ {rankContext.next_worse_tier.label}まで余裕 {rankContext.next_worse_tier.rp_buffer} RP</p>
              )}
              {rankContext.surrounding && (
                <div className="mt-3 space-y-1">
                  {rankContext.surrounding.map((r: any) => (
                    <div key={r.rank} className={`flex justify-between text-xs py-1 px-2 rounded ${r.is_me ? "bg-purple-500/20 text-white font-bold" : "text-white/40"}`}>
                      <span>{r.rank}位 {r.is_me ? "👤 " : ""}{r.display_name || r.user_id}</span>
                      <span>{r.total_rp} RP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/40">週間累計RPランキング</p>
            <button onClick={() => setShowRankHelp(true)} className="text-white/30 text-xs">？ 見方</button>
          </div>
          {ranking.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">まだ参加者がいません</p>
          ) : ranking.map((r, i) => (
            <div key={r.user_id} className={`flex items-center justify-between p-3 rounded-xl ${r.user_id === userId ? "bg-purple-500/20 border border-purple-500/30" : "bg-white/5"}`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-white/40"}`}>
                  {i + 1}
                </span>
                <span className="text-sm">{r.user_id === userId ? "👤 " + (r.display_name || r.user_id) : (r.display_name || r.user_id)}</span>
              </div>
              <span className="font-bold text-purple-400">{r.total_rp} RP</span>
            </div>
          ))}
        </div>
      )}

      {/* 装備タブ */}
      {tab === "装備" && (
        <div className="space-y-3">
          {/* シャード残高 */}
          <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-white/60">🔧 upgrade_shard</span>
            <span className="font-bold text-orange-400">{shards}</span>
          </div>

          {enhanceResult && (
            <div className={`rounded-xl p-3 text-sm text-center ${enhanceResult.result === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {enhanceResult.result === "success" ? `✨ 強化成功！ +${enhanceResult.after_level}` : `💨 強化失敗... (${enhanceResult.shard_spent} shard消費)`}
            </div>
          )}

          {msg && <div className="bg-blue-500/10 text-blue-400 rounded-xl p-3 text-sm text-center">{msg}</div>}

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">装備してスコアを強化しよう</p>
            <button onClick={() => setShowEquipHelp(true)} className="text-white/30 text-xs">？ 装備とは</button>
          </div>
          {["head","body","hand","leg"].map(slot => {
            const slotItems = equipment.filter(e => e.slot === slot);
            return (
              <div key={slot} className="bg-white/5 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-2">
                  {slot === "head" ? "🪖 頭" : slot === "body" ? "🛡️ 胴" : slot === "hand" ? "🧤 手" : "👢 足"}
                </p>
                <div className="space-y-2">
                  {slotItems.map(item => (
                    <div key={item.id} className={`p-3 rounded-lg border ${RARITY_BG[item.rarity]} bg-white/3`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${RARITY_COLOR[item.rarity]}`}>
                          {item.name}{(item.enhance_level ?? 0) > 0 ? ` [+${item.enhance_level}]` : ""} (+{item.bonus})
                        </span>
                      </div>
                      {((item.luck ?? 0) > 0 || (item.stability ?? 0) > 0) && (
                        <div className="flex gap-3 text-xs text-white/40 mb-2">
                          {(item.luck ?? 0) > 0 && <span>🍀 Luck {item.luck}%</span>}
                          {(item.stability ?? 0) > 0 && <span>🛡 Stab {item.stability}%</span>}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => handleEquip(item.id)} disabled={item.equipped || busy}
                          className={`flex-1 text-xs py-1 rounded ${item.equipped ? "bg-green-500/20 text-green-400" : "bg-purple-600 text-white"}`}>
                          {item.equipped ? "装備中" : "装備"}
                        </button>
                        <button onClick={() => handleEnhance(item.id)} disabled={busy}
                          className="text-xs px-2 py-1 rounded bg-orange-600/80 text-white">
                          強化
                        </button>
                        <button onClick={() => handleDismantle(item.id)} disabled={item.equipped || busy}
                          className="text-xs px-2 py-1 rounded bg-white/10 text-white/50">
                          分解
                        </button>
                      </div>
                    </div>
                  ))}
                  {slotItems.length === 0 && <p className="text-xs text-white/20">なし（ガチャで入手）</p>}
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
