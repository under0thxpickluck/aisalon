"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../lib/auth";
import { AppSidebar } from "@/components/AppSidebar";

// ── 定数 ────────────────────────────────────────────────────────────────────

const GENRES = [
  "ポップ", "ロック", "ジャズ", "クラシック", "EDM",
  "ヒップホップ", "R&B", "アニメ", "ローファイ", "シネマティック",
];

const MOODS = [
  "さわやか", "クール", "エモい", "明るい", "落ち着いた",
  "ロマンチック", "激しい", "切ない",
];

const PRO_PLANS = ["500", "1000"];

const BPM_OPTIONS = [
  { label: "スロー (60-80)",      value: 70  },
  { label: "ミディアム (90-110)", value: 100 },
  { label: "アップテンポ (120-140)", value: 130 },
  { label: "激速 (150+)",         value: 160 },
];

const VOCAL_STYLES = ["女性ボーカル", "男性ボーカル", "混声", "ボーカルなし"];
const VOCAL_MOODS  = ["甘い", "クール", "パワフル", "ウィスパー", "エモーショナル"];

type Step = 0 | 1 | 2 | 3;

type StructureData = {
  bpm: number;
  key: string;
  sections: string[];
  hookSummary: string;
  title: string;
};

// ── チュートリアル ────────────────────────────────────────────────────────────

const TUTORIAL_KEY = "lifai_music2_tutorial_v1";

const TUTORIAL_SLIDES = [
  {
    icon: "✏️",
    title: "テーマ・ジャンル・雰囲気を入力",
    body: "作りたい曲のイメージをテーマに書いてください。ジャンルと雰囲気（複数可）も選ぶと、AIがより好みに合った曲を作ります。",
  },
  {
    icon: "📋",
    title: "AIが構成案を提案します",
    body: "BPM・キー・セクション構成・サビのポイントをAIが考えます。気に入らなければ「作り直す」で再提案できます。",
  },
  {
    icon: "⏳",
    title: "曲の生成が始まります",
    body: "生成には2〜3分かかります。ページを開いたままお待ちください。進捗バーで状況を確認できます。",
  },
  {
    icon: "🎵",
    title: "完成！聴いて・ダウンロードしよう",
    body: "再生プレイヤーで試聴し、MP3ダウンロードもできます。表示用歌詞・配信用歌詞もここから確認できます。",
  },
];

// ── 履歴 ─────────────────────────────────────────────────────────────────────

const HISTORY_KEY = "lifai_music2_history_v1";
const HISTORY_MAX = 5;

type MusicHistoryEntry = {
  jobId: string;
  title: string;
  audioUrl: string;
  downloadUrl: string;
  lyrics: string;
  createdAt: string; // ISO string
};

function loadHistory(): MusicHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(entry: MusicHistoryEntry): MusicHistoryEntry[] {
  const prev = loadHistory().filter((e) => e.jobId !== entry.jobId);
  const next = [entry, ...prev].slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

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

  // 構成
  const [structureData, setStructureData] = useState<StructureData | null>(null);

  // 完成
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const [resultLyrics, setResultLyrics] = useState("");
  const [displayLyrics, setDisplayLyrics] = useState("");
  const [distributionLyrics, setDistributionLyrics] = useState("");
  const [distributionReady, setDistributionReady] = useState(false);
  const [lyricsGateResult, setLyricsGateResult] = useState<"pass" | "review" | "reject" | null>(null);
  const [lyricsReviewRequired, setLyricsReviewRequired] = useState(false);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [audioStage, setAudioStage] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState<string | null>(null);

  // プラン
  const [plan, setPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // 履歴
  const [history, setHistory] = useState<MusicHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // チュートリアル (null=非表示, 0〜3=スライド番号)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  // Pro 追加入力
  const [bpmHint, setBpmHint] = useState<number | null>(null);
  const [vocalStyle, setVocalStyle] = useState<string>("");
  const [vocalMood, setVocalMood] = useState<string>("");

  const isPro = plan !== null && PRO_PLANS.includes(plan);

  // ── 認証チェック & プラン取得 ───────────────────────────────────────────

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }
    setHistory(loadHistory());

    // チュートリアル: 未表示なら自動表示
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      setTutorialStep(0);
    }

    const id   = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";

    const cachedPlan = String((auth as any)?.plan ?? "");
    if (cachedPlan) setPlan(cachedPlan);

    if (!id || !code) {
      setPlanLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, code, group: (auth as any)?.group || "" }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (data?.ok && data?.me?.plan) {
          setPlan(String(data.me.plan));
        } else {
          setPlan(cachedPlan || "");
        }
      } catch {
        setPlan(cachedPlan || "");
      } finally {
        setPlanLoading(false);
      }
    })();

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

  // ── ステータスポーリング（completed まで） ────────────────────────────────

  const pollUntilCompleted = useCallback((jid: string) => {
    let ticks = 0;
    const INFO_TICKS = 100;
    const MAX_TICKS  = 200;

    const poll = async () => {
      if (!pollRef.current) return;
      ticks++;
      setProgress(Math.min(90, 5 + ticks * 0.425));

      try {
        const res  = await fetch(`/api/song/status?jobId=${jid}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.ok) {
          if (ticks >= MAX_TICKS) {
            stopPoll();
            setErrorMsg("生成に失敗しました。もう一度お試しください。");
          } else {
            pollRef.current = setTimeout(poll, 3000);
          }
          return;
        }

        if (data.stage)                      setAudioStage(data.stage);
        if (data.stageLabel)                 setStageLabel(data.stageLabel);
        if (typeof data.progress === "number") setProgress(data.progress);

        if (data.status === "completed" || data.status === "review_required") {
          const rRes  = await fetch(`/api/song/result?jobId=${jid}`, { cache: "no-store" });
          const rData = await rRes.json();
          stopPoll();
          setProgress(100);
          if (rData.ok) {
            setResultTitle(rData.title ?? "");
            setAudioUrl(rData.audioUrl ?? null);
            setDownloadUrl(rData.downloadUrl ?? null);
            setResultLyrics(rData.lyrics ?? "");
            setDisplayLyrics(rData.displayLyrics ?? rData.lyrics ?? "");
            setDistributionLyrics(rData.distributionLyrics ?? "");
            setDistributionReady(!!rData.distributionReady);
            setLyricsGateResult(rData.lyricsGateResult ?? null);
            setLyricsReviewRequired(!!rData.lyricsReviewRequired);
            setInfoMsg(null);
            setStep(3);
            if (rData.audioUrl) {
              const updated = saveToHistory({
                jobId:       jid,
                title:       rData.title || "無題",
                audioUrl:    rData.audioUrl,
                downloadUrl: rData.downloadUrl ?? rData.audioUrl,
                lyrics:      rData.displayLyrics ?? rData.lyrics ?? "",
                createdAt:   new Date().toISOString(),
              });
              setHistory(updated);
            }
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

      pollRef.current = setTimeout(poll, 3000);
    };

    pollRef.current = setTimeout(poll, 3000);
  }, []);

  // ── Step 0: 曲を作る（構成生成まで一気に） ──────────────────────────────

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
    setProgress(10);

    const moodStr = selectedMoods.join("・");

    try {
      // start API が同期的に structure_ready まで実行して返す
      setProgress(30);
      const res  = await fetch("/api/song/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          id: (auth as any).id, code, theme: theme.trim(), genre, mood: moodStr, isPro,
          bpmHint:    isPro && bpmHint    ? bpmHint    : undefined,
          vocalStyle: isPro && vocalStyle ? vocalStyle : undefined,
          vocalMood:  isPro && vocalMood  ? vocalMood  : undefined,
          language:   "ja",
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        const msg =
          data.error === "insufficient_bp"
            ? `BPが不足しています（現在: ${data.bp ?? "?"}BP、必要: 100BP）`
            : `エラーが発生しました（${data.error ?? "unknown"}）`;
        setErrorMsg(msg);
        setLoading(false);
        return;
      }

      setJobId(data.jobId);
      setProgress(100);

      // structure データを取得して Step 1 へ
      if (data.structureData) {
        setStructureData({
          bpm:         data.structureData.bpm  ?? 120,
          key:         data.structureData.key  ?? "C major",
          sections:    data.structureData.sections ?? [],
          hookSummary: data.structureData.hookSummary ?? "",
          title:       data.structureData.title ?? "",
        });
        setLoading(false);
        setStep(1);
      } else {
        // フォールバック: structure API で取得
        const sRes  = await fetch(`/api/song/structure?jobId=${data.jobId}`, { cache: "no-store" });
        const sData = await sRes.json();
        if (sData.ok) {
          setStructureData({
            bpm:         sData.bpm  ?? 120,
            key:         sData.key  ?? "C major",
            sections:    sData.sections ?? [],
            hookSummary: sData.hookSummary ?? "",
            title:       sData.title ?? "",
          });
          setLoading(false);
          setStep(1);
        } else {
          setErrorMsg("構成の取得に失敗しました。");
          setLoading(false);
        }
      }
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }

  // ── Step 1: 構成を作り直す ────────────────────────────────────────────────

  function handleRedoStructure() {
    stopPoll();
    setLoading(false);
    setProgress(0);
    setErrorMsg(null);
    setStructureData(null);
    setJobId(null);
    setStep(0);
  }

  // ── Step 1: キャンセル ────────────────────────────────────────────────────

  async function handleCancelFromStep1() {
    if (jobId) {
      await fetch("/api/song/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    handleFullReset();
  }

  // ── Step 1: 構成承認して音楽生成へ ────────────────────────────────────────

  async function handleApproveStructure() {
    if (!jobId) return;
    setLoading(true);
    setErrorMsg(null);
    setProgress(5);

    try {
      const res  = await fetch("/api/song/approve-structure", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jobId, approved: true }),
      });
      const data = await res.json();

      if (!data.ok) {
        setErrorMsg(`エラー: ${data.error ?? "unknown"}${data.status ? ` (status: ${data.status})` : ""}`);
        setLoading(false);
        return;
      }

      // すでにパイプライン進行中（二重クリック等）→ そのままポーリングへ
      setStep(2);
      pollRef.current = setTimeout(() => {}, 0);
      pollUntilCompleted(jobId);
    } catch {
      // ネットワークエラーが発生してもサーバー側でパイプラインが継続している可能性があるため、
      // jobId があればポーリングを継続して完了を検知する（履歴への保存を確実にする）
      setInfoMsg("接続が一時的に途切れました。生成は継続中です...");
      setStep(2);
      pollRef.current = setTimeout(() => {}, 0);
      pollUntilCompleted(jobId);
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
    setStructureData(null);
    setAudioUrl(null);
    setDownloadUrl(null);
    setResultTitle("");
    setResultLyrics("");
    setDisplayLyrics("");
    setDistributionLyrics("");
    setDistributionReady(false);
    setLoading(false);
    setProgress(0);
    setErrorMsg(null);
    setInfoMsg(null);
    setAudioStage(null);
    setStageLabel(null);
    setBpmHint(null);
    setVocalStyle("");
    setVocalMood("");
  }

  // ── ムード切り替え ────────────────────────────────────────────────────────

  function toggleMood(mood: string) {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  }

  const canStart = theme.trim().length > 0 && genre !== "" && selectedMoods.length > 0 && !loading && !planLoading;

  // ── 共通スタイル ──────────────────────────────────────────────────────────

  const chipBase    = "rounded-full border px-3 py-1 text-xs font-semibold transition";
  const chipActive  = "border-indigo-500 bg-indigo-600 text-white";
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

  // ── 履歴サイドバー ────────────────────────────────────────────────────────


  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[1100px] px-4 py-10 lg:flex lg:gap-5 lg:items-start">
        {/* 左サイドバー（共通） */}
        <div className="hidden lg:block">
          <AppSidebar musicHistory={history} activePage="/music2" />
        </div>
        {/* モバイル用折りたたみ履歴ボタン */}
        <div className="lg:hidden mb-3">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span>🎵 最近の曲 ({history.length})</span>
            <span>{historyOpen ? "▲" : "▼"}</span>
          </button>
          {historyOpen && (
            <div className="mt-2">
              <AppSidebar musicHistory={history} activePage="/music2" />
            </div>
          )}
        </div>

        {/* メインカード */}
        <div className="flex-1 min-w-0">
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
            {/* Pro バッジ */}
            {!planLoading && isPro && (
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                PRO
              </span>
            )}
            {/* ステップインジケーター */}
            {step > 0 && (
              <div className="flex items-center gap-1">
                {([1, 2, 3] as const).map((s) => (
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
            {/* チュートリアルボタン */}
            <button
              type="button"
              onClick={() => setTutorialStep(0)}
              title="使い方を見る"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition"
            >
              ?
            </button>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
            {step === 0 && "新しい曲を作る"}
            {step === 1 && "構成案を確認"}
            {step === 2 && "曲を生成しています…"}
            {step === 3 && "曲が完成しました！"}
          </h1>

          <ErrorBox />

          {/* ════════════════════════════════════════════════════
              Step 0：入力フォーム
          ════════════════════════════════════════════════════ */}
          {step === 0 && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                テーマ・ジャンル・雰囲気を選ぶと、AIが構成を提案してから曲を生成します。
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

              {/* Pro追加設定（isPro === true の場合のみ表示） */}
              {isPro && (
                <div className="mt-5 rounded-[18px] border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-bold text-violet-700 mb-3">🎛️ Pro設定（任意）</p>

                  {/* BPMヒント */}
                  <div className="mb-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">BPM目安</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BPM_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={loading}
                          onClick={() => setBpmHint(bpmHint === opt.value ? null : opt.value)}
                          className={[chipBase, bpmHint === opt.value ? "border-violet-500 bg-violet-600 text-white" : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ボーカルスタイル */}
                  <div className="mb-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">ボーカルスタイル</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VOCAL_STYLES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={loading}
                          onClick={() => setVocalStyle(vocalStyle === v ? "" : v)}
                          className={[chipBase, vocalStyle === v ? "border-violet-500 bg-violet-600 text-white" : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ボーカルムード */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">ボーカルムード</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VOCAL_MOODS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={loading}
                          onClick={() => setVocalMood(vocalMood === v ? "" : v)}
                          className={[chipBase, vocalMood === v ? "border-violet-500 bg-violet-600 text-white" : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* BP表示 */}
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <span className="text-xs font-bold text-indigo-700">必要BP</span>
                <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">100 BP</span>
                {isPro ? (
                  <span className="ml-auto text-[11px] text-violet-600 font-semibold">🎛️ Proモード：高品質プロンプトで生成</span>
                ) : (
                  <span className="ml-auto text-[11px] text-indigo-500">構成生成→音楽生成の2ステップ</span>
                )}
              </div>

              {/* ローディング中のプログレス */}
              {loading && <ProgressBar label="楽曲構成を生成しています…" />}

              {/* 生成ボタン */}
              <div className="mt-6">
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className={btnPrimary}
                >
                  {loading ? "構成を生成中…" : "曲を作る"}
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
              Step 1：構成確認
          ════════════════════════════════════════════════════ */}
          {step === 1 && !loading && structureData && (
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
                <button onClick={handleApproveStructure} disabled={loading} className={btnPrimary}>
                  これで曲を作る →
                </button>
                <p className="text-xs text-orange-400 text-center mt-2">
                  ⚠️ Beta版のため、現在は2分〜3分の生成となります
                </p>
                <div className="flex gap-2">
                  <button onClick={handleRedoStructure} className={`flex-1 ${btnSecondary}`}>
                    作り直す
                  </button>
                  <button onClick={handleCancelFromStep1} className={`flex-1 ${btnDanger}`}>
                    キャンセル
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 1 && loading && (
            <ProgressBar label="音楽生成を開始しています…" />
          )}

          {/* ════════════════════════════════════════════════════
              Step 2：曲生成中
          ════════════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                AIが曲を生成しています。完成まで約8分かかります。このページを閉じずにお待ちください。
              </p>

              <ProgressBar label={stageLabel ?? "音楽を生成しています…"} />

              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-xs font-semibold leading-relaxed text-indigo-700">
                  {stageLabel
                    ? stageLabel
                    : audioStage === "intro"   ? "イントロ生成中... (1/4)"
                    : audioStage === "verse"   ? "Verse生成中... (2/4)"
                    : audioStage === "chorus"  ? "サビ生成中... (3/4)"
                    : audioStage === "outro"   ? "アウトロ生成中... (4/4)"
                    : audioStage === "merging" ? "仕上げ中..."
                    : "りふぁねこが一生懸命作曲中です🎵"
                  }
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
              Step 3：完成
          ════════════════════════════════════════════════════ */}
          {step === 3 && audioUrl && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                曲が完成しました！再生・ダウンロードできます。
              </p>

              <div className="mt-5 rounded-[20px] border border-indigo-100 bg-indigo-50 p-4">
                {/* タイトル + 品質バッジ */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-extrabold text-slate-900">{resultTitle}</p>
                  {lyricsGateResult === "pass" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✓ 品質 良好
                    </span>
                  )}
                  {lyricsGateResult === "review" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      ⚠ 要確認
                    </span>
                  )}
                  {lyricsGateResult === "reject" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      ✕ 品質不足
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">使用BP：100BP</p>

                {/* 品質警告 */}
                {(lyricsReviewRequired || !distributionReady) && audioUrl && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-amber-800">
                      ⚠ この曲は歌詞一致または反復に問題があるため、配信提出前に確認してください。
                    </p>
                  </div>
                )}

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

                {/* 歌詞ダウンロード */}
                {displayLyrics && (
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob(
                          [`${resultTitle}\n\n${displayLyrics}`],
                          { type: "text/plain;charset=utf-8" }
                        );
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `lyrics-display-${jobId || "song"}.txt`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      📄 歌詞をダウンロード（表示用）
                    </button>
                    {distributionLyrics ? (
                      <button
                        onClick={() => {
                          const blob = new Blob(
                            [`${resultTitle}\n\n${distributionLyrics}`],
                            { type: "text/plain;charset=utf-8" }
                          );
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `lyrics-distribution-${jobId || "song"}.txt`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                        className={`w-full rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                          distributionReady
                            ? "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {distributionReady ? "✅ 配信用歌詞をダウンロード" : "📋 配信用歌詞をダウンロード（要確認）"}
                      </button>
                    ) : (
                      <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-xs font-semibold text-red-600">
                        🚫 配信用歌詞：品質確認が必要なため提出前に手動確認が必要です
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </div>

    {/* ── チュートリアルオーバーレイ ─────────────────────────────────────── */}
    {tutorialStep !== null && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={() => {
          localStorage.setItem(TUTORIAL_KEY, "1");
          setTutorialStep(null);
        }}
      >
        <div
          className="relative w-full max-w-sm rounded-[24px] bg-white p-7 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* スライドインジケーター */}
          <div className="flex justify-center gap-1.5 mb-5">
            {TUTORIAL_SLIDES.map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === tutorialStep ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-200",
                ].join(" ")}
              />
            ))}
          </div>

          {/* コンテンツ */}
          <div className="text-center">
            <div className="text-4xl mb-3">{TUTORIAL_SLIDES[tutorialStep].icon}</div>
            <h2 className="text-base font-extrabold text-slate-900 mb-2">
              {TUTORIAL_SLIDES[tutorialStep].title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {TUTORIAL_SLIDES[tutorialStep].body}
            </p>
          </div>

          {/* ナビゲーション */}
          <div className="mt-7 flex items-center gap-2">
            {tutorialStep > 0 && (
              <button
                type="button"
                onClick={() => setTutorialStep(tutorialStep - 1)}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                ← 戻る
              </button>
            )}
            {tutorialStep < TUTORIAL_SLIDES.length - 1 ? (
              <button
                type="button"
                onClick={() => setTutorialStep(tutorialStep + 1)}
                className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
              >
                次へ →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(TUTORIAL_KEY, "1");
                  setTutorialStep(null);
                }}
                className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
              >
                はじめる
              </button>
            )}
          </div>

          {/* スキップ */}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(TUTORIAL_KEY, "1");
              setTutorialStep(null);
            }}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600 transition"
          >
            スキップ
          </button>
        </div>
      </div>
    )}
    </main>
  );
}
