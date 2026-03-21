"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type TapStatus = {
  today_taps: number;
  today_bp: number;
  today_ep: number;
  taps_remaining: number;
  max_combo: number;
  today_max_combo: number;
  total_taps: number;
};

type TapResult = {
  ok: boolean;
  reward_type?: string;
  reward_amount?: number;
  is_rare?: boolean;
  bp?: number;
  ep?: number;
  today_bp?: number;
  today_ep?: number;
  taps_remaining?: number;
  error?: string;
};

export default function TapMiningPage() {
  const [userId, setUserId] = useState<string>("");
  const [status, setStatus] = useState<TapStatus | null>(null);
  const [combo, setCombo] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isTapping, setIsTapping] = useState(false);
  const [floats, setFloats] = useState<{ id: number; text: string; color: string; x: number }[]>([]);
  const [rareEffect, setRareEffect] = useState(false);
  const [fever, setFever] = useState(false);
  const [feverTimer, setFeverTimer] = useState(0);
  const [tickerEvents, setTickerEvents] = useState<{masked_name:string; reward:number; type:string}[]>([]);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feverIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const floatIdRef = useRef(0);

  // userId取得
  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) {
        const auth = JSON.parse(raw);
        setUserId(String(auth?.id ?? ""));
      }
    } catch {}
  }, []);

  // ステータス取得
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/tap/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setStatus(d); })
      .catch(() => {});
  }, [userId]);

  // Ticker取得（30秒ごと）
  useEffect(() => {
    const fetchTicker = () => {
      fetch("/api/minigames/tap/ticker")
        .then(r => r.json())
        .then(d => { if (d.ok && d.events) setTickerEvents(d.events); })
        .catch(() => {});
    };
    fetchTicker();
    const interval = setInterval(fetchTicker, 30000);
    return () => clearInterval(interval);
  }, []);

  // コンボリセットタイマー
  const resetComboTimer = () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), 1200);
  };

  // フィーバー発動
  const startFever = () => {
    if (fever) return;
    setFever(true);
    setFeverTimer(10);
    if (feverIntervalRef.current) clearInterval(feverIntervalRef.current);
    feverIntervalRef.current = setInterval(() => {
      setFeverTimer(t => {
        if (t <= 1) {
          clearInterval(feverIntervalRef.current!);
          setFever(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleTap = async () => {
    if (!userId || !status || status.taps_remaining <= 0) return;
    if (isTapping) return;

    const now = Date.now();
    const newCombo = (now - lastTapTime) < 1200 ? combo + 1 : 1;
    setCombo(newCombo);
    setLastTapTime(now);
    resetComboTimer();

    // フィーバー判定
    if (newCombo === 50) startFever();

    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 100);

    try {
      const res = await fetch("/api/minigames/tap/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, comboCount: newCombo }),
      });
      const data: TapResult = await res.json();

      if (data.ok) {
        const x  = 40 + Math.random() * 20;
        const id = floatIdRef.current++;
        let text  = data.reward_type === "BP" ? `+${data.reward_amount}BP` : `+${data.reward_amount}EP`;
        let color = data.reward_type === "BP" ? "text-purple-400" : "text-yellow-400";

        if (data.is_rare && data.reward_amount != null && data.reward_amount >= 10000) {
          text  = `💥 +${data.reward_amount}EP 大当たり!!!`;
          color = "text-red-400";
          setRareEffect(true);
          setTimeout(() => setRareEffect(false), 3000);
        } else if (data.is_rare && data.reward_amount != null && data.reward_amount >= 500) {
          text  = `🌟 +${data.reward_amount}EP EPIC!!!`;
          color = "text-orange-400";
          setRareEffect(true);
          setTimeout(() => setRareEffect(false), 2000);
        } else if (data.is_rare) {
          text  = `✨ +${data.reward_amount}EP RARE!`;
          color = "text-yellow-400";
          setRareEffect(true);
          setTimeout(() => setRareEffect(false), 1500);
        }

        setFloats(prev => [...prev, { id, text, color, x }]);
        setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1200);

        setStatus(prev => prev ? {
          ...prev,
          today_taps:      prev.today_taps + 1,
          today_bp:        data.today_bp ?? prev.today_bp,
          today_ep:        data.today_ep ?? prev.today_ep,
          taps_remaining:  data.taps_remaining ?? prev.taps_remaining - 1,
          today_max_combo: Math.max(prev.today_max_combo, newCombo),
        } : prev);
      } else if (data.error === "insufficient_bp") {
        const id = floatIdRef.current++;
        setFloats(prev => [...prev, { id, text: "💸 BP不足!", color: "text-red-400", x: 45 }]);
        setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1500);
      } else if (data.error === "daily_limit_reached") {
        setStatus(prev => prev ? { ...prev, taps_remaining: 0 } : prev);
      }
    } catch {}
  };

  const comboMultiplier = combo >= 100 ? 1.5 : combo >= 50 ? 1.2 : combo >= 20 ? 1.1 : 1.0;

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-md mx-auto relative overflow-hidden ${rareEffect ? "animate-pulse" : ""}`}>
      {/* レア演出オーバーレイ */}
      {rareEffect && (
        <div className="fixed inset-0 bg-yellow-400/20 z-50 pointer-events-none flex items-center justify-center">
          <div className="text-4xl font-black text-yellow-400 animate-bounce">✨ RARE! EP獲得！</div>
        </div>
      )}

      {/* Ticker */}
      {tickerEvents.length > 0 && (
        <div className="fixed top-0 left-0 right-0 bg-black/80 text-yellow-400 text-xs py-1 px-4 z-40 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            {tickerEvents.map((e, i) => (
              <span key={i} className="mr-8">
                🎉 {e.masked_name} が {e.reward}EP を獲得！
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/mini-games" className="text-white/40 text-sm">← Arcade</Link>
        <h1 className="font-bold text-lg">⛏️ Tap Mining</h1>
        <div className="w-16" />
      </div>

      {/* ステータスバー */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">今日のBP</p>
          <p className="font-bold text-purple-400">{status?.today_bp ?? 0}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">残りタップ</p>
          <p className="font-bold text-white">{status?.taps_remaining ?? 500}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">今日のEP</p>
          <p className="font-bold text-yellow-400">{status?.today_ep ?? 0}</p>
        </div>
      </div>

      {/* コンボ表示 */}
      <div className="text-center mb-4">
        {combo >= 20 && (
          <div className="text-sm font-bold text-orange-400 animate-pulse">
            🔥 {combo} COMBO! × {comboMultiplier}
          </div>
        )}
        {fever && (
          <div className="text-sm font-bold text-red-400">
            ⚡ FEVER! {feverTimer}s
          </div>
        )}
      </div>

      {/* メインタップボタン */}
      <div className="relative flex items-center justify-center my-8">
        {/* フロートテキスト */}
        {floats.map(f => (
          <div
            key={f.id}
            className={`absolute text-sm font-bold ${f.color} pointer-events-none animate-bounce`}
            style={{ left: `${f.x}%`, top: "-20px" }}
          >
            {f.text}
          </div>
        ))}

        <button
          onClick={handleTap}
          disabled={!userId || !status || status.taps_remaining <= 0}
          className={`
            w-48 h-48 rounded-full font-black text-2xl transition-all duration-100 select-none
            ${isTapping ? "scale-90" : "scale-100"}
            ${fever
              ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]"
              : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            }
            ${(!userId || !status || status.taps_remaining <= 0) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-90"}
          `}
        >
          {status?.taps_remaining === 0 ? "🔒" : "⛏️"}
          <div className="text-sm font-normal mt-1">
            {status?.taps_remaining === 0 ? "明日また来てね" : "TAP!"}
          </div>
        </button>
      </div>

      {/* 上限メッセージ */}
      {status?.taps_remaining === 0 && (
        <div className="bg-white/5 rounded-xl p-4 text-center text-sm text-white/50 mb-4">
          本日のタップ上限に達しました🎉<br/>明日リセットされます
        </div>
      )}

      {/* 今日の記録 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-white/60 mb-3">📊 今日の記録</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">タップ数</span>
            <span>{status?.today_taps ?? 0} / 500</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">最大コンボ</span>
            <span>{status?.today_max_combo ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">獲得BP</span>
            <span className="text-purple-400">{status?.today_bp ?? 0} BP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">獲得EP</span>
            <span className="text-yellow-400">{status?.today_ep ?? 0} EP</span>
          </div>
        </div>
      </div>

      {/* デイリーボーナス進捗 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-bold text-white/60 mb-3">🎁 デイリーボーナス</h3>
        <div className="space-y-2">
          {[
            { taps: 1,   label: "初タップ",    bp: 5  },
            { taps: 50,  label: "50タップ",    bp: 3  },
            { taps: 100, label: "100タップ",   bp: 5  },
            { taps: 300, label: "300タップ",   bp: 10 },
          ].map(b => (
            <div key={b.taps} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full ${(status?.today_taps ?? 0) >= b.taps ? "bg-green-400" : "bg-white/10"}`} />
                <span className={`${(status?.today_taps ?? 0) >= b.taps ? "text-white/40 line-through" : "text-white/70"}`}>
                  {b.label}
                </span>
              </div>
              <span className="text-purple-400">+{b.bp}BP</span>
            </div>
          ))}
        </div>
      </div>

      {/* 累計記録 */}
      <div className="text-center text-xs text-white/20">
        総タップ数: {status?.total_taps ?? 0} / 最大コンボ: {status?.max_combo ?? 0}
      </div>
    </div>
  );
}
