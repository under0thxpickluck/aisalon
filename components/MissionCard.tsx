"use client";

// components/MissionCard.tsx
import { useEffect, useState } from "react";

type MissionItem = {
  done: boolean;
  reward: number;
};

type MissionsData = {
  today: string;
  missions: {
    login:   MissionItem;
    fortune: MissionItem;
    music:   MissionItem;
  };
  all_complete_bonus: MissionItem;
  bp_balance: number;
};

type Props = {
  loginId: string;
  onBpEarned: (amount: number) => void;
};

const MISSION_LABELS: Record<string, string> = {
  login:   "ログイン",
  fortune: "占いをする",
  music:   "音楽を聴く",
};

export default function MissionCard({ loginId, onBpEarned }: Props) {
  const [data, setData] = useState<MissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loginId) {
      setLoading(false);
      return;
    }

    fetch(`/api/missions?loginId=${encodeURIComponent(loginId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setData(res as MissionsData);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loginId]);

  const handleComplete = async (missionType: string) => {
    if (!data || completing) return;
    const mission = data.missions[missionType as keyof typeof data.missions];
    if (!mission || mission.done) return;

    setCompleting(missionType);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, mission_type: missionType }),
      });
      const result = await res.json().catch(() => ({ ok: false }));

      if (result.ok) {
        setData((prev) => {
          if (!prev) return prev;
          const updated: MissionsData = {
            ...prev,
            bp_balance: result.bp_balance ?? prev.bp_balance,
            missions: {
              ...prev.missions,
              [missionType]: { ...prev.missions[missionType as keyof typeof prev.missions], done: true },
            },
            all_complete_bonus: result.all_complete_bonus
              ? { ...prev.all_complete_bonus, done: true }
              : prev.all_complete_bonus,
          };
          return updated;
        });
        onBpEarned(result.bp_earned ?? 0);
      } else if (result.error === "already_completed_today") {
        // サーバー側で1日1回制限に引っかかった場合もdone表示にする
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            missions: {
              ...prev.missions,
              [missionType]: { ...prev.missions[missionType as keyof typeof prev.missions], done: true },
            },
          };
        });
      }
    } catch {
      // サイレント失敗
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl bg-zinc-900 p-4">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-zinc-700" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-2 h-10 animate-pulse rounded-xl bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { missions, all_complete_bonus } = data;
  const missionList = [
    { key: "login",   ...missions.login },
    { key: "fortune", ...missions.fortune },
    { key: "music",   ...missions.music },
  ];

  const allThreeDone =
    missions.login.done && missions.fortune.done && missions.music.done;

  return (
    <div className="mt-6 rounded-2xl bg-zinc-900 p-4">
      <p className="mb-3 text-xs font-extrabold text-zinc-100">📋 今日のミッション</p>

      <div className="flex flex-col gap-2">
        {missionList.map(({ key, done, reward }) => {
          const isLoading = completing === key;
          return (
            <button
              key={key}
              disabled={done || isLoading}
              onClick={() => handleComplete(key)}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2 text-left transition",
                done
                  ? "bg-zinc-800 opacity-50 cursor-not-allowed"
                  : "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 cursor-pointer",
              ].join(" ")}
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                <span>{done ? "✅" : "⬜"}</span>
                <span className={done ? "line-through text-zinc-400" : ""}>
                  {MISSION_LABELS[key]}
                </span>
              </span>
              <span className="text-xs font-extrabold text-amber-400">+{reward}BP</span>
            </button>
          );
        })}

        {/* 全完了ボーナス */}
        <div
          className={[
            "flex items-center justify-between rounded-xl px-3 py-2",
            allThreeDone ? "bg-zinc-800" : "bg-zinc-800 opacity-40",
          ].join(" ")}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
            <span>🎁</span>
            <span className={all_complete_bonus.done ? "line-through text-zinc-400" : ""}>
              全完了ボーナス
            </span>
            {all_complete_bonus.done && (
              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">
                獲得済み
              </span>
            )}
          </span>
          <span className="text-xs font-extrabold text-amber-400">+{all_complete_bonus.reward}BP</span>
        </div>
      </div>

      <p className="mt-3 text-right text-[10px] text-zinc-500">最大 50BP/日</p>
    </div>
  );
}
