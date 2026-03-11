"use client";

// components/RadioCard.tsx
import { useCallback, useEffect, useRef, useState } from "react";

type ServiceLinks = Record<string, string>;

type Song = {
  song_id:       string;
  title:         string;
  artist:        string;
  service_links: ServiceLinks;
  thumbnail_url: string;
};

type RadioStatus = {
  today_count:     number;
  daily_limit:     number;
  remaining:       number;
  started_mission: { mission_id: string; song_id: string; started_at: string } | null;
};

type Phase = "list" | "listening" | "submit" | "done";

type Props = {
  loginId:    string;
  onEpEarned: () => void;
};

const SERVICE_LABELS: Record<string, string> = {
  spotify: "Spotify",
  apple:   "Apple Music",
  youtube: "YouTube",
  amazon:  "Amazon",
};

const COUNTDOWN_SECS = 120;

export default function RadioCard({ loginId, onEpEarned }: Props) {
  const [songs,        setSongs]        = useState<Song[]>([]);
  const [status,       setStatus]       = useState<RadioStatus | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [phase,        setPhase]        = useState<Phase>("list");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [missionId,    setMissionId]    = useState<string>("");
  const [serviceName,  setServiceName]  = useState<string>("");
  const [secondsLeft,  setSecondsLeft]  = useState(COUNTDOWN_SECS);
  const [note,         setNote]         = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [errMsg,       setErrMsg]       = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!loginId) { setLoading(false); return; }
    try {
      const [songsRes, statusRes] = await Promise.all([
        fetch("/api/radio?action=songs", { cache: "no-store" }),
        fetch(`/api/radio?action=status&loginId=${encodeURIComponent(loginId)}`, { cache: "no-store" }),
      ]);
      const [songsData, statusData] = await Promise.all([
        songsRes.json().catch(() => ({ ok: false })),
        statusRes.json().catch(() => ({ ok: false })),
      ]);
      if (songsData.ok)  setSongs(songsData.songs  ?? []);
      if (statusData.ok) setStatus(statusData as RadioStatus);
    } catch {
      // サイレント失敗
    } finally {
      setLoading(false);
    }
  }, [loginId]);

  useEffect(() => { loadData(); }, [loadData]);

  // カウントダウン
  useEffect(() => {
    if (phase !== "listening") return;
    setSecondsLeft(COUNTDOWN_SECS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const handleStart = async (song: Song, svcKey: string, svcUrl: string) => {
    if (!loginId) return;
    setErrMsg("");
    try {
      const res  = await fetch("/api/radio", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "start", loginId, song_id: song.song_id }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        const reason = data.reason || data.error || "failed";
        setErrMsg(
          reason === "daily_limit"     ? "今日の上限に達しています" :
          reason === "already_started" ? "この曲は既に視聴開始しています" :
          `エラー: ${reason}`
        );
        return;
      }
      // 外部リンクを新タブで開く
      window.open(svcUrl, "_blank", "noopener,noreferrer");
      setSelectedSong(song);
      setMissionId(data.mission_id);
      setServiceName(SERVICE_LABELS[svcKey] || svcKey);
      setPhase("listening");
    } catch {
      setErrMsg("通信エラーが発生しました");
    }
  };

  const handleSubmit = async () => {
    if (!missionId || submitting) return;
    setSubmitting(true);
    try {
      const res  = await fetch("/api/radio", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "submit", loginId, mission_id: missionId, screenshot_note: note }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        onEpEarned();
        setPhase("done");
      } else {
        setErrMsg(`エラー: ${data.reason || data.error || "failed"}`);
      }
    } catch {
      setErrMsg("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = async () => {
    setPhase("list");
    setSelectedSong(null);
    setMissionId("");
    setNote("");
    setErrMsg("");
    setLoading(true);
    await loadData();
  };

  // ===== フェーズ2: 視聴中 =====
  if (phase === "listening" && selectedSong) {
    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const secs = String(secondsLeft % 60).padStart(2, "0");
    return (
      <div className="mt-6 rounded-2xl bg-zinc-900 p-4">
        <p className="mb-1 text-xs font-extrabold text-zinc-100">📻 LIFAI RADIO</p>
        <p className="mb-4 text-xs text-zinc-400">
          🎵 {selectedSong.title} を視聴中
        </p>
        <p className="mb-4 text-xs text-zinc-400">
          {serviceName}で2分以上再生してください
        </p>
        <div className="mb-4 text-center">
          <span className="text-4xl font-extrabold text-amber-400">{mins}:{secs}</span>
        </div>
        {secondsLeft === 0 && (
          <button
            onClick={() => setPhase("submit")}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500"
          >
            ✅ 視聴完了を申請する
          </button>
        )}
      </div>
    );
  }

  // ===== フェーズ3: 申請 =====
  if (phase === "submit") {
    return (
      <div className="mt-6 rounded-2xl bg-zinc-900 p-4">
        <p className="mb-4 text-xs font-extrabold text-zinc-100">📻 視聴完了を申請</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="再生中の画面メモ（任意）"
          rows={3}
          style={{
            width:        "100%",
            padding:      "10px",
            borderRadius: "10px",
            border:       "1px solid rgba(255,255,255,0.12)",
            background:   "#27272a",
            color:        "#f4f4f5",
            fontSize:     "13px",
            resize:       "vertical",
            boxSizing:    "border-box",
            marginBottom: "12px",
          }}
        />
        {errMsg && <p className="mb-2 text-xs text-red-400">{errMsg}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={[
            "w-full rounded-xl py-3 text-sm font-bold transition",
            submitting ? "bg-amber-900 text-amber-300 cursor-not-allowed" : "bg-amber-500 text-black hover:bg-amber-400",
          ].join(" ")}
        >
          {submitting ? "送信中…" : "申請する"}
        </button>
      </div>
    );
  }

  // ===== フェーズ4: 完了 =====
  if (phase === "done") {
    return (
      <div className="mt-6 rounded-2xl bg-zinc-900 p-4 text-center">
        <p className="mb-2 text-2xl font-extrabold text-amber-400">✨ +5EP 獲得しました！</p>
        <p className="mb-4 text-xs text-zinc-400">お疲れさまでした</p>
        <button
          onClick={handleBack}
          className="rounded-xl border border-zinc-600 px-6 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
        >
          戻る
        </button>
      </div>
    );
  }

  // ===== フェーズ1: 曲一覧 =====
  const remaining = status?.remaining ?? 0;
  const dailyLimit = status?.daily_limit ?? 1;

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl bg-zinc-900 p-4">
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-zinc-700" />
        {[0, 1].map((i) => (
          <div key={i} className="mb-2 h-16 animate-pulse rounded-xl bg-zinc-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-extrabold text-zinc-100">📻 LIFAI RADIO</p>
        <div>
          {remaining > 0 ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-400">
              今日あと{remaining}回 +5EP/回
            </span>
          ) : (
            <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
              今日の上限に達しました
            </span>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-zinc-400">作業用BGMを聴いてEP獲得</p>

      {errMsg && <p className="mb-2 text-xs text-red-400">{errMsg}</p>}

      {songs.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-500">楽曲がまだ登録されていません</p>
      ) : (
        <div className="flex flex-col gap-3">
          {songs.map((song) => {
            const svcEntries = Object.entries(song.service_links).filter(([, url]) => url);
            return (
              <div
                key={song.song_id}
                className="rounded-xl bg-zinc-800 p-3"
              >
                <p className="text-sm font-bold text-zinc-100">{song.title}</p>
                <p className="mb-2 text-xs text-zinc-400">{song.artist}</p>
                <div className="flex flex-wrap gap-2">
                  {svcEntries.map(([svcKey, svcUrl]) => (
                    <button
                      key={svcKey}
                      disabled={remaining === 0}
                      onClick={() => handleStart(song, svcKey, svcUrl)}
                      className={[
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        remaining === 0
                          ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                          : "bg-amber-500 text-black hover:bg-amber-400",
                      ].join(" ")}
                    >
                      {SERVICE_LABELS[svcKey] || svcKey}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-right text-[10px] text-zinc-500">
        本日 {status?.today_count ?? 0}/{dailyLimit}回 視聴済み
      </p>
    </div>
  );
}
