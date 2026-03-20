"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../lib/auth";

// ── 定数 ────────────────────────────────────────────────────────────────────

const GENRES = [
  "ポップ", "ロック", "ジャズ", "クラシック", "EDM",
  "ヒップホップ", "R&B", "アニメ", "ローファイ", "シネマティック",
];

const MOODS = [
  "さわやか", "クール", "エモい", "明るい", "落ち着いた",
  "ロマンチック", "激しい", "切ない",
];

type Step = 0 | 1 | 2 | 3 | 4;

type StructureData = {
  bpm: number;
  key: string;
  sections: string[];
  hookSummary: string;
  title: string;
};

// ── ユーティリティ ───────────────────────────────────────────────────────────

function downloadAudio(url: string, title: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title || "lifai_song"}_${Date.now()}.mp3`;
  a.target = "_blank";
  a.click();
}

// ── メインコンポーネント ─────────────────────────────────────────────────────

export default function Music2Page() {
  const router = useRouter();

  // フォーム
  const [theme, setTheme] = useState("");
  const [genre, setGenre] = useState("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // ステップ制御
  const [step, setStep] = useState<Step>(0);

  // ジョブ
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 歌詞
  const [lyricsTitle, setLyricsTitle] = useState("");
  const [editedLyrics, setEditedLyrics] = useState("");
  const [originalLyrics, setOriginalLyrics] = useState("");

  // 構成
  const [structureData, setStructureData] = useState<StructureData | null>(null);

  // 完成
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const [resultLyrics, setResultLyrics] = useState("");
  const [lyricsOpen, setLyricsOpen] = useState(false);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [audioStage, setAudioStage] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");

  // ── 認証チェック ─────────────────────────────────────────────────────────

  useEffect(() => {
    const auth = getAuth();
    if (!auth) router.replace("/login");
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [router]);

  // ── ポーリング停止 ────────────────────────────────────────────────────────

  function stopPoll() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  // ── ステータスポーリング（lyrics_ready まで） ──────────────────────────────

  const pollUntilLyricsReady = useCallback((jid: string) => {
    let ticks = 0;
    const MAX_TICKS = 60; // 2分

    const poll = async () => {
      if (!pollRef.current) return;
      ticks++;
      setProgress(Math.min(85, 10 + ticks * 1.2));

      try {
        const res = await fetch(`/api/song/status?jobId=${jid}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.ok) {
          if (ticks >= MAX_TICKS) {
            stopPoll();
            setErrorMsg("歌詞の生成に失敗しました。もう一度お試しください。");
            setLoading(false);
          } else {
            const t = setTimeout(poll, 2000);
            pollRef.current = t;
          }
          return;
        }

        if (data.status === "lyrics_ready") {
          // 歌詞を取得
          const lRes = await fetch(`/api/song/lyrics?jobId=${jid}`, { cache: "no-store" });
          const lData = await lRes.json();
          stopPoll();
          setProgress(100);
          if (lData.ok) {
            setLyricsTitle(lData.title ?? "");
            setOriginalLyrics(lData.lyrics ?? "");
            setEditedLyrics(lData.lyrics ?? "");
            setLoading(false);
            setStep(1);
          } else {
            setErrorMsg("歌詞の取得に失敗しました。");
            setLoading(false);
          }
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          stopPoll();
          setErrorMsg("歌詞の生成に失敗しました。もう一度お試しください。");
          setLoading(false);
          return;
        }

        if (ticks >= MAX_TICKS) {
          stopPoll();
          setErrorMsg("歌詞の生成がタイムアウトしました。");
          setLoading(false);
          return;
        }
      } catch {
        // ネットワークエラーは無視して継続
      }

      const t = setTimeout(poll, 2000);
      pollRef.current = t;
    };

    const t = setTimeout(poll, 2000);
    pollRef.current = t;
  }, []);

  // ── ステータスポーリング（structure_ready まで） ──────────────────────────

  const pollUntilStructureReady = useCallback((jid: string) => {
    let ticks = 0;
    const MAX_TICKS = 60;

    const poll = async () => {
      if (!pollRef.current) return;
      ticks++;
      setProgress(Math.min(85, 10 + ticks * 1.2));

      try {
        const res = await fetch(`/api/song/status?jobId=${jid}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.ok) {
          if (ticks >= MAX_TICKS) {
            stopPoll();
            setErrorMsg("構成の生成に失敗しました。");
            setLoading(false);
          } else {
            const t = setTimeout(poll, 2000);
            pollRef.current = t;
          }
          return;
        }

        if (data.status === "structure_ready") {
          const sRes = await fetch(`/api/song/structure?jobId=${jid}`, { cache: "no-store" });
          const sData = await sRes.json();
          stopPoll();
          setProgress(100);
          if (sData.ok) {
            setStructureData(sData);
            setLoading(false);
            setStep(2);
          } else {
            setErrorMsg("構成の取得に失敗しました。");
            setLoading(false);
          }
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          stopPoll();
          setErrorMsg("構成の生成に失敗しました。");
          setLoading(false);
          return;
        }

        if (ticks >= MAX_TICKS) {
          stopPoll();
          setErrorMsg("構成の生成がタイムアウトしました。");
          setLoading(false);
          return;
        }
      } catch {
        // ネットワークエラーは無視
      }

      const t = setTimeout(poll, 2000);
      pollRef.current = t;
    };

    const t = setTimeout(poll, 2000);
    pollRef.current = t;
  }, []);

  // ── ステータスポーリング（completed まで） ────────────────────────────────

  const pollUntilCompleted = useCallback((jid: string) => {
    let ticks = 0;
    const INFO_TICKS = 100; // 5分（3秒×100）：インフォメッセージを表示してポーリング継続
    const MAX_TICKS = 200;  // 10分（3秒×200）：本当のタイムアウトエラー

    const poll = async () => {
      if (!pollRef.current) return;
      ticks++;
      setProgress(Math.min(90, 5 + ticks * 0.425));

      try {
        const res = await fetch(`/api/song/status?jobId=${jid}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.ok) {
          if (ticks >= MAX_TICKS) {
            stopPoll();
            setErrorMsg("生成に失敗しました。もう一度お試しください。");
          } else {
            const t = setTimeout(poll, 3000);
            pollRef.current = t;
          }
          return;
        }

        if (data.stage) {
          setAudioStage(data.stage);
        }

        if (data.status === "completed") {
          const rRes = await fetch(`/api/song/result?jobId=${jid}`, { cache: "no-store" });
          const rData = await rRes.json();
          stopPoll();
          setProgress(100);
          if (rData.ok) {
            setResultTitle(rData.title ?? "");
            setAudioUrl(rData.audioUrl ?? null);
            setDownloadUrl(rData.downloadUrl ?? null);
            setResultLyrics(rData.lyrics ?? "");
            setInfoMsg(null);
            setStep(4);
          } else {
            setErrorMsg("曲の取得に失敗しました。");
          }
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          stopPoll();
          setErrorMsg("曲の生成に失敗しました。");
          return;
        }

        if (ticks >= MAX_TICKS) {
          stopPoll();
          setErrorMsg("生成に失敗しました。もう一度お試しください。");
          return;
        }

        if (ticks === INFO_TICKS) {
          setInfoMsg("曲の生成に時間がかかっています。このままお待ちください...");
        }
      } catch {
        // ネットワークエラーは無視
      }

      const t = setTimeout(poll, 3000);
      pollRef.current = t;
    };

    const t = setTimeout(poll, 3000);
    pollRef.current = t;
  }, []);

  // ── Step 0: 曲を作る ─────────────────────────────────────────────────────

  async function handleStart() {
    const auth = getAuth();
    const code = getAuthSecret();
    if (!auth || !code) {
      router.replace("/login");
      return;
    }
    if (!theme.trim() || !genre || selectedMoods.length === 0) return;

    stopPoll();
    setLoading(true);
    setErrorMsg(null);
    setProgress(5);

    const moodStr = selectedMoods.join("・");

    try {
      const res = await fetch("/api/song/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auth.id, code, theme: theme.trim(), genre, mood: moodStr }),
      });
      const data = await res.json();

      if (!data.ok) {
        const msg =
          data.error === "insufficient_bp"
            ? `BPが不足しています（現在: ${data.bp ?? "?"}BP、必要: 10BP）`
            : `エラーが発生しました（${data.error ?? "unknown"}）`;
        setErrorMsg(msg);
        setLoading(false);
        return;
      }

      setJobId(data.jobId);
      const t = setTimeout(() => {}, 0);
      pollRef.current = t;
      pollUntilLyricsReady(data.jobId);
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }

  // ── Step 1: 作り直す（同じ入力で再生成） ──────────────────────────────────

  async function handleRedoLyrics() {
    if (jobId) {
      await fetch("/api/song/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    setStep(0);
    setJobId(null);
    setLyricsTitle("");
    setEditedLyrics("");
    setOriginalLyrics("");
    setErrorMsg(null);
    setLoading(false);
    setProgress(0);
    stopPoll();
  }

  // ── Step 1: キャンセル ────────────────────────────────────────────────────

  async function handleCancelFromStep1() {
    if (jobId) {
      await fetch("/api/song/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    handleFullReset();
  }

  // ── Step 1: 歌詞を承認して構成生成へ ─────────────────────────────────────

  async function handleApproveLyrics() {
    if (!jobId) return;
    setLoading(true);
    setErrorMsg(null);
    setProgress(5);

    try {
      const res = await fetch("/api/song/approve-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, lyrics: editedLyrics }),
      });
      const data = await res.json();

      if (!data.ok) {
        setErrorMsg(`エラー: ${data.error ?? "unknown"}`);
        setLoading(false);
        return;
      }

      const t = setTimeout(() => {}, 0);
      pollRef.current = t;
      pollUntilStructureReady(jobId);
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }

  // ── Step 2: 作り直す（歌詞承認に戻る） ───────────────────────────────────

  function handleRedoStructure() {
    stopPoll();
    setLoading(false);
    setProgress(0);
    setErrorMsg(null);
    setStructureData(null);
    // lyrics_ready に戻す（再ポーリング不要、すでにlyricsDataはある）
    setStep(1);
  }

  // ── Step 2: キャンセル ────────────────────────────────────────────────────

  async function handleCancelFromStep2() {
    if (jobId) {
      await fetch("/api/song/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    handleFullReset();
  }

  // ── Step 2: 構成承認して音楽生成へ ───────────────────────────────────────

  async function handleApproveStructure() {
    if (!jobId) return;
    setLoading(true);
    setErrorMsg(null);
    setProgress(5);

    try {
      const res = await fetch("/api/song/approve-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, approved: true }),
      });
      const data = await res.json();

      if (!data.ok) {
        setErrorMsg(`エラー: ${data.error ?? "unknown"}`);
        setLoading(false);
        return;
      }

      setStep(3);
      const t = setTimeout(() => {}, 0);
      pollRef.current = t;
      pollUntilCompleted(jobId);
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }

  // ── 全リセット ────────────────────────────────────────────────────────────

  function handleFullReset() {
    stopPoll();
    setStep(0);
    setJobId(null);
    setTheme("");
    setGenre("");
    setSelectedMoods([]);
    setLyricsTitle("");
    setEditedLyrics("");
    setOriginalLyrics("");
    setStructureData(null);
    setAudioUrl(null);
    setDownloadUrl(null);
    setResultTitle("");
    setResultLyrics("");
    setLyricsOpen(false);
    setLoading(false);
    setProgress(0);
    setErrorMsg(null);
    setInfoMsg(null);
    setAudioStage(null);
  }

  // ── ムード切り替え ────────────────────────────────────────────────────────

  function toggleMood(mood: string) {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  }

  // if (!unlocked) return (
  //   <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white">
  //     <p className="text-sm text-gray-400">管理者パスワードを入力してください</p>
  //     <input
  //       type="password"
  //       value={pwInput}
  //       onChange={e => setPwInput(e.target.value)}
  //       className="border rounded px-3 py-2 text-sm"
  //     />
  //     <button
  //       onClick={() => { if (pwInput === "nagoya01@") setUnlocked(true); }}
  //       className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
  //     >
  //       入力
  //     </button>
  //   </div>
  // );

  const canStart = theme.trim().length > 0 && genre !== "" && selectedMoods.length > 0 && !loading;

  // ── 共通スタイル ──────────────────────────────────────────────────────────

  const chipBase = "rounded-full border px-3 py-1 text-xs font-semibold transition";
  const chipActive = "border-indigo-500 bg-indigo-600 text-white";
  const chipInactive = "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

  const btnPrimary =
    "w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(99,102,241,.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
  const btnSecondary =
    "rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
  const btnDanger =
    "rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50";

  // ── プログレスバー ────────────────────────────────────────────────────────

  const ProgressBar = ({ label }: { label: string }) => (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="relative mt-2 h-2 w-full rounded-full border border-slate-200 bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
        {/* 猫がバーの先端を走る */}
        <span
          className="absolute -top-3 text-base transition-all duration-500"
          style={{ left: `calc(${progress}% - 10px)` }}
        >
          🐱
        </span>
      </div>
    </div>
  );

  // ── エラー表示 ────────────────────────────────────────────────────────────

  const ErrorBox = () =>
    errorMsg ? (
      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
        <p className="text-sm font-semibold text-rose-700">{errorMsg}</p>
        <button onClick={handleFullReset} className={`mt-3 ${btnDanger}`}>
          最初からやり直す
        </button>
      </div>
    ) : null;

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[720px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">

          {/* ヘッダー */}
          <div className="flex items-center gap-3">
            <Link
              href="/top"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← ホーム
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <span className="text-base">🎵</span>
              音楽生成 NEW
            </div>
            {/* ステップインジケーター */}
            {step > 0 && (
              <div className="ml-auto flex items-center gap-1">
                {([1, 2, 3, 4] as const).map((s) => (
                  <div
                    key={s}
                    className={[
                      "h-2 w-2 rounded-full transition",
                      step >= s ? "bg-indigo-500" : "bg-slate-200",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
            {step === 0 && "新しい曲を作る"}
            {step === 1 && "歌詞案を確認"}
            {step === 2 && "構成案を確認"}
            {step === 3 && "曲を生成しています…"}
            {step === 4 && "曲が完成しました！"}
          </h1>

          <ErrorBox />

          {/* ════════════════════════════════════════════════════
              Step 0：入力フォーム
          ════════════════════════════════════════════════════ */}
          {step === 0 && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                テーマ・ジャンル・雰囲気を選ぶと、AIが歌詞と構成を提案してから曲を生成します。
              </p>

              {/* テーマ */}
              <div className="mt-6">
                <label className="block text-xs font-bold text-slate-700">
                  テーマ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  disabled={loading}
                  placeholder="例: 夏の終わり、新しい出会い、宇宙の旅…"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
                />
              </div>

              {/* ジャンル */}
              <div className="mt-5">
                <label className="block text-xs font-bold text-slate-700">
                  ジャンル <span className="text-rose-500">*</span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(genre === g ? "" : g)}
                      disabled={loading}
                      className={[chipBase, genre === g ? chipActive : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 雰囲気 */}
              <div className="mt-5">
                <label className="block text-xs font-bold text-slate-700">
                  雰囲気 <span className="text-rose-500">*</span>
                  <span className="ml-2 text-[10px] font-normal text-slate-400">複数選択可</span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMood(m)}
                      disabled={loading}
                      className={[chipBase, selectedMoods.includes(m) ? chipActive : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* BP表示 */}
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <span className="text-xs font-bold text-indigo-700">必要BP</span>
                <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">10 BP</span>
                <span className="ml-auto text-[11px] text-indigo-500">歌詞生成→構成生成→音楽生成の3ステップ</span>
              </div>

              {/* ローディング中のプログレス */}
              {loading && <ProgressBar label="歌詞を生成しています…" />}

              {/* 生成ボタン */}
              <div className="mt-6">
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className={btnPrimary}
                >
                  {loading ? "歌詞を生成中…" : "曲を作る"}
                </button>
                {!canStart && !loading && (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    テーマ・ジャンル・雰囲気をすべて選択してください
                  </p>
                )}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════
              Step 1：歌詞確認
          ════════════════════════════════════════════════════ */}
          {step === 1 && !loading && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                AIが歌詞案を作成しました。修正してから「この歌詞で進む」を押してください。
              </p>

              {/* タイトル */}
              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-[10px] font-bold text-indigo-500">タイトル案</p>
                <p className="mt-1 text-base font-extrabold text-slate-900">{lyricsTitle}</p>
              </div>

              {/* 歌詞編集 */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700">
                  歌詞
                  <span className="ml-2 text-[10px] font-normal text-slate-400">
                    自由に編集できます
                  </span>
                </label>
                <textarea
                  value={editedLyrics}
                  onChange={(e) => setEditedLyrics(e.target.value)}
                  rows={14}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {editedLyrics !== originalLyrics && (
                  <p className="mt-1 text-[11px] text-indigo-500">編集済み（オリジナルから変更あり）</p>
                )}
              </div>

              {/* ボタン群 */}
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={handleApproveLyrics} className={btnPrimary}>
                  この歌詞で進む →
                </button>
                <div className="flex gap-2">
                  <button onClick={handleRedoLyrics} className={`flex-1 ${btnSecondary}`}>
                    作り直す
                  </button>
                  <button onClick={handleCancelFromStep1} className={`flex-1 ${btnDanger}`}>
                    キャンセル
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 歌詞承認後のローディング */}
          {step === 1 && loading && (
            <ProgressBar label="構成を生成しています…" />
          )}

          {/* ════════════════════════════════════════════════════
              Step 2：構成確認
          ════════════════════════════════════════════════════ */}
          {step === 2 && !loading && structureData && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                AIが楽曲構成を提案しました。確認してから「これで曲を作る」を押してください。
              </p>

              <div className="mt-5 space-y-3">
                {/* タイトル */}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="text-[10px] font-bold text-indigo-500">タイトル</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">{structureData.title}</p>
                </div>

                {/* BPM / Key */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500">BPM</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{structureData.bpm}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500">Key</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{structureData.key}</p>
                  </div>
                </div>

                {/* セクション */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-500">セクション構成</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {structureData.sections.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* hookSummary */}
                {structureData.hookSummary && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500">サビのポイント</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">{structureData.hookSummary}</p>
                  </div>
                )}
              </div>

              {/* ボタン群 */}
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={handleApproveStructure} className={btnPrimary}>
                  これで曲を作る →
                </button>
                {/* Beta版注記 */}
                <p className="text-xs text-orange-400 text-center mt-2">
                  ⚠️ Beta版のため、現在は30秒・1セクション（サビのみ）の生成となります
                </p>
                <div className="flex gap-2">
                  <button onClick={handleRedoStructure} className={`flex-1 ${btnSecondary}`}>
                    歌詞に戻る
                  </button>
                  <button onClick={handleCancelFromStep2} className={`flex-1 ${btnDanger}`}>
                    キャンセル
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && loading && (
            <ProgressBar label="構成を生成しています…" />
          )}

          {/* ════════════════════════════════════════════════════
              Step 3：曲生成中
          ════════════════════════════════════════════════════ */}
          {step === 3 && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                AIが曲を生成しています。完成まで約8分かかります。このページを閉じずにお待ちください。
              </p>

              <ProgressBar label="音楽を生成しています…" />

              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-xs font-semibold leading-relaxed text-indigo-700">
                  {audioStage === "intro"   && "イントロ生成中... (1/4)"}
                  {audioStage === "verse"   && "Verse生成中... (2/4)"}
                  {audioStage === "chorus"  && "サビ生成中... (3/4)"}
                  {audioStage === "outro"   && "アウトロ生成中... (4/4)"}
                  {audioStage === "merging" && "仕上げ中..."}
                  {!audioStage && "ElevenLabsで生成中です。"}
                  <br />
                  完成すると自動的に次のステップに進みます。
                </p>
              </div>

              {infoMsg && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700">{infoMsg}</p>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════
              Step 4：完成
          ════════════════════════════════════════════════════ */}
          {step === 4 && audioUrl && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                曲が完成しました！再生・ダウンロードできます。
              </p>

              <div className="mt-5 rounded-[20px] border border-indigo-100 bg-indigo-50 p-4">
                {/* タイトル */}
                <p className="text-sm font-extrabold text-slate-900">{resultTitle}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">使用BP：10BP</p>

                {/* オーディオプレイヤー */}
                <audio controls src={audioUrl} className="mt-3 w-full" />

                {/* ボタン */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {downloadUrl && (
                    <button
                      onClick={() => downloadAudio(downloadUrl, resultTitle)}
                      className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      MP3をダウンロード
                    </button>
                  )}
                  <button
                    onClick={handleFullReset}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:opacity-90"
                  >
                    もう1曲作る
                  </button>
                </div>

                {/* リリース・売却申請ボタン */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/music-release-guide"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 text-center transition hover:bg-slate-50"
                  >
                    🎵 リリースガイドを見る
                  </Link>
                  <Link
                    href="/apply-sell"
                    className="flex-1 rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-xs font-semibold text-violet-700 text-center transition hover:bg-violet-50"
                  >
                    💰 売却申請
                  </Link>
                </div>

                {/* 歌詞表示（ロック） */}
                {resultLyrics && (
                  <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {/* ぼかした歌詞（背景として表示） */}
                    <div
                      className="px-4 pb-4 pt-3"
                      style={{ filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}
                    >
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                        {resultLyrics}
                      </p>
                    </div>
                    {/* ロックオーバーレイ */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 px-4 py-5">
                      <span className="text-3xl">🔒</span>
                      <p className="mt-2 text-sm font-bold" style={{ color: "#888888" }}>
                        歌詞機能は近日公開予定
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "#888888" }}>
                        LIFAIの目標達成時に解放されます
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}
