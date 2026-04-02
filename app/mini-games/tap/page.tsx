"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type TapStatus = {
  today_taps:      number;
  today_bp:        number;
  today_ep:        number;
  taps_remaining:  number;
  max_combo:       number;
  today_max_combo: number;
  total_taps:      number;
};

type BatchResult = {
  ok:                boolean;
  processedTapCount?: number;
  bpCost?:           number;
  bpReward?:         number;
  epReward?:         number;
  rareRewards?:      { type: string; amount: number }[];
  todayTaps?:        number;
  tapsRemaining?:    number;
  bpBalance?:        number;
  epBalance?:        number;
  today_bp?:         number;
  today_ep?:         number;
  error?:            string;
};

export default function TapMiningPage() {
  // ── パスワードゲート ──
  const [tapAuthed,   setTapAuthed]   = useState(false);
  const [tapPw,       setTapPw]       = useState("");
  const [tapPwError,  setTapPwError]  = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("tap_authed") === "1") setTapAuthed(true);
  }, []);

  const tryAuth = () => {
    if (tapPw === "nagoya01@") {
      sessionStorage.setItem("tap_authed", "1");
      setTapAuthed(true);
    } else {
      setTapPwError(true);
    }
  };

  // ── コア State ──
  const [userId,              setUserId]              = useState("");
  const [status,              setStatus]              = useState<TapStatus | null>(null);
  const [optimisticRemaining, setOptimisticRemaining] = useState<number | null>(null);
  const [combo,               setCombo]               = useState(0);
  const [lastTapTime,         setLastTapTime]         = useState(0);
  const [isTapping,           setIsTapping]           = useState(false);
  const [floats,              setFloats]              = useState<{ id: number; text: string; color: string; x: number }[]>([]);
  const [rareEffect,          setRareEffect]          = useState(false);
  const [fever,               setFever]               = useState(false);
  const [feverTimer,          setFeverTimer]          = useState(0);
  const [tickerEvents,        setTickerEvents]        = useState<{ masked_name: string; reward: number; type: string }[]>([]);
  const [showHelp,            setShowHelp]            = useState(false);

  // ── バッチ用 Refs ──
  const pendingTapsRef      = useRef(0);
  const flushTimerRef       = useRef<NodeJS.Timeout | null>(null);
  const isFlushingRef       = useRef(false);
  const sessionIdRef        = useRef(`tap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const batchStartRef       = useRef<number | null>(null);
  const maxComboInBatchRef  = useRef(0);
  const userIdRef           = useRef("");
  const floatIdRef          = useRef(0);
  const comboTimerRef       = useRef<NodeJS.Timeout | null>(null);
  const feverIntervalRef    = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── 初期化 ──
  useEffect(() => {
    const seen = localStorage.getItem("tap_help_seen");
    if (!seen) setShowHelp(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) {
        const auth = JSON.parse(raw);
        setUserId(String(auth?.id ?? ""));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/tap/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setStatus(d); })
      .catch(() => {});
  }, [userId]);

  // status が来たら optimisticRemaining を初期化（一度だけ）
  useEffect(() => {
    if (status && optimisticRemaining === null) {
      setOptimisticRemaining(status.taps_remaining);
    }
  }, [status, optimisticRemaining]);

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

  // ── バッチ flush ──
  const flushTaps = useCallback(async () => {
    const count = pendingTapsRef.current;
    if (count === 0 || !userIdRef.current || isFlushingRef.current) return;

    isFlushingRef.current  = true;
    pendingTapsRef.current = 0;
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }

    const startedAt = batchStartRef.current ?? Date.now();
    const endedAt   = Date.now();
    batchStartRef.current       = null;
    const maxCombo              = maxComboInBatchRef.current;
    maxComboInBatchRef.current  = 0;

    try {
      const res  = await fetch("/api/minigames/tap/batch-play", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:    userIdRef.current,
          sessionId: sessionIdRef.current,
          tapCount:  count,
          maxCombo,
          startedAt,
          endedAt,
        }),
      });
      const data: BatchResult = await res.json();

      if (data.ok) {
        // サーバー値で状態を同期
        setStatus(prev => prev ? {
          ...prev,
          today_taps:      data.todayTaps      ?? prev.today_taps,
          today_bp:        data.today_bp        ?? prev.today_bp,
          today_ep:        data.today_ep        ?? prev.today_ep,
          taps_remaining:  data.tapsRemaining   ?? prev.taps_remaining,
          today_max_combo: Math.max(prev.today_max_combo, maxCombo),
        } : prev);
        // optimisticRemaining を実残数で補正（必須）
        if (data.tapsRemaining !== undefined) setOptimisticRemaining(data.tapsRemaining);

        // レア報酬演出（サーバー確認後のみ）
        data.rareRewards?.forEach(r => {
          const id = floatIdRef.current++;
          const x  = 40 + Math.random() * 20;
          let text: string, color: string;
          if (r.amount >= 10000) {
            text = `💥 +${r.amount}EP 大当たり!!!`; color = "text-red-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 3000);
          } else if (r.amount >= 500) {
            text = `🌟 +${r.amount}EP EPIC!!!`; color = "text-orange-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 2000);
          } else {
            text = `✨ +${r.amount}EP RARE!`; color = "text-yellow-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 1500);
          }
          setFloats(prev => [...prev, { id, text, color, x }]);
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1500);
        });
      } else if (data.error === "daily_limit_reached") {
        setOptimisticRemaining(0);
        setStatus(prev => prev ? { ...prev, taps_remaining: 0 } : prev);
      }
    } catch {}
    finally { isFlushingRef.current = false; }
  }, []);

  // ── 離脱時 flush（pagehide 最優先 / visibilitychange / beforeunload 補助） ──
  useEffect(() => {
    const buildPayload = () => ({
      userId:    userIdRef.current,
      sessionId: sessionIdRef.current,
      tapCount:  pendingTapsRef.current,
      maxCombo:  maxComboInBatchRef.current,
      startedAt: batchStartRef.current ?? Date.now(),
      endedAt:   Date.now(),
    });

    const sendBatch = () => {
      const count = pendingTapsRef.current;
      if (count === 0 || !userIdRef.current) return;
      const payload = buildPayload();
      pendingTapsRef.current = 0;
      const blob    = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/minigames/tap/batch-play", blob);
      } else {
        fetch("/api/minigames/tap/batch-play", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), keepalive: true,
        }).catch(() => {});
      }
    };

    const onPageHide        = () => sendBatch();
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") sendBatch(); };
    const onBeforeUnload    = () => sendBatch();

    window.addEventListener("pagehide",         onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload",      onBeforeUnload);

    return () => {
      window.removeEventListener("pagehide",         onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload",      onBeforeUnload);
      // unmount 時は試行のみ（完了保証なし）
      flushTaps();
    };
  }, [flushTaps]);

  // ── コンボ・フィーバー ──
  const resetComboTimer = () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), 1200);
  };

  const startFever = () => {
    if (fever) return;
    setFever(true);
    setFeverTimer(10);
    if (feverIntervalRef.current) clearInterval(feverIntervalRef.current);
    feverIntervalRef.current = setInterval(() => {
      setFeverTimer(t => {
        if (t <= 1) { clearInterval(feverIntervalRef.current!); setFever(false); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── メインタップ処理（バッチ版） ──
  const handleTap = () => {
    const effectiveRemaining = optimisticRemaining ?? (status?.taps_remaining ?? 0);
    if (!userId || !status || effectiveRemaining <= 0) return;

    const now      = Date.now();
    const newCombo = (now - lastTapTime) < 1200 ? combo + 1 : 1;
    setCombo(newCombo);
    setLastTapTime(now);
    maxComboInBatchRef.current = Math.max(maxComboInBatchRef.current, newCombo);
    resetComboTimer();
    if (newCombo === 50) startFever();

    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 100);

    // 即時フロートエフェクト（演出のみ・金額なし）
    const id = floatIdRef.current++;
    const x  = 40 + Math.random() * 20;
    setFloats(prev => [...prev, { id, text: "⛏️", color: "text-white/50", x }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 700);

    // 楽観的残数更新（0未満にしない）
    setOptimisticRemaining(r => Math.max(0, (r ?? (status?.taps_remaining ?? 0)) - 1));

    // バッチ蓄積
    if (!batchStartRef.current) batchStartRef.current = now;
    pendingTapsRef.current++;

    if (pendingTapsRef.current >= 10) {
      flushTaps();
    } else {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => flushTaps(), 2000);
    }
  };

  const comboMultiplier    = combo >= 100 ? 1.5 : combo >= 50 ? 1.2 : combo >= 20 ? 1.1 : 1.0;
  const effectiveRemaining = optimisticRemaining ?? (status?.taps_remaining ?? 0);

  // ── パスワードゲート（早期リターン） ──
  if (!tapAuthed) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] gap-4">
      <div className="text-4xl mb-2">⛏️</div>
      <h1 className="text-white font-bold text-xl">Tap Mining</h1>
      <p className="text-white/40 text-sm">パスワードを入力してください</p>
      <input
        type="password"
        value={tapPw}
        onChange={e => { setTapPw(e.target.value); setTapPwError(false); }}
        onKeyDown={e => { if (e.key === "Enter") tryAuth(); }}
        className="border border-white/20 bg-white/5 text-white rounded-xl px-4 py-2 text-sm w-64 text-center"
        placeholder="パスワード"
        autoFocus
      />
      {tapPwError && <p className="text-red-400 text-xs">パスワードが違います</p>}
      <button
        onClick={tryAuth}
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold"
      >
        入室する
      </button>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-md mx-auto relative overflow-hidden ${rareEffect ? "animate-pulse" : ""}`}>

      {/* ルール説明モーダル */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-black mb-4 text-center">⛏️ Tap Miningとは？</h2>
            <div className="text-sm text-white/70 space-y-3">
              <div>
                <p className="font-bold text-white mb-1">■ 基本ルール</p>
                <p>・1タップ = 1BP消費</p>
                <p>・1日最大500回まで</p>
                <p>・毎日リセット</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ 報酬</p>
                <p>・BPまたはEPがランダムで獲得できます</p>
                <p>・最低でも0.1BPは必ずもらえます</p>
                <p>・ごく稀に大量EPが当たることもあります</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">■ ポイント</p>
                <p>・EPはアプリ内ポイントです（換金不可）</p>
                <p>・運が良いと大当たりも…？</p>
              </div>
            </div>
            <button
              onClick={() => { localStorage.setItem("tap_help_seen", "1"); setShowHelp(false); }}
              className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold text-sm"
            >
              OK、はじめる！
            </button>
          </div>
        </div>
      )}

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
        <button onClick={() => setShowHelp(true)} className="text-white/40 text-lg w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">?</button>
      </div>

      {/* ステータスバー */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-white/40">今日のBP</p>
          <p className="font-bold text-purple-400">{status?.today_bp ?? 0}</p>
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
          disabled={!userId || !status || effectiveRemaining <= 0}
          className={`
            w-48 h-48 rounded-full font-black text-2xl transition-all duration-100 select-none
            ${isTapping ? "scale-90" : "scale-100"}
            ${fever
              ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]"
              : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            }
            ${(!userId || !status || effectiveRemaining <= 0) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-90"}
          `}
        >
          {effectiveRemaining <= 0 ? "🔒" : "⛏️"}
          <div className="text-sm font-normal mt-1">
            {effectiveRemaining <= 0 ? "明日また来てね" : "TAP!"}
          </div>
        </button>
      </div>

      {/* 上限メッセージ */}
      {effectiveRemaining <= 0 && (
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

      {/* 累計記録 */}
      <div className="text-center text-xs text-white/20">
        総タップ数: {status?.total_taps ?? 0} / 最大コンボ: {status?.max_combo ?? 0}
      </div>
    </div>
  );
}
