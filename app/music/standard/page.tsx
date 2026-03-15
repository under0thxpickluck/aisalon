"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../../lib/auth";

type GenStatus = "idle" | "generating" | "succeeded" | "failed";

const MOOD_TAGS = [
  "さわやか", "クール", "エモい", "明るい", "落ち着いた",
  "ロマンチック", "激しい", "切ない", "楽しい", "神秘的",
  "ジャズ", "ロック", "ポップ", "チル", "ダーク",
  "壮大", "かわいい", "夏っぽい", "夜っぽい", "前向き",
];

// ── 簡易選択肢（STANDARD版） ────────────────────────
const GENRES = [
  "ポップ", "ロック", "ジャズ", "クラシック", "EDM",
  "ヒップホップ", "R&B", "アニメ", "ローファイ", "シネマティック",
];

const BPM_OPTIONS = [
  { label: "スロー(60-80)", bpmText: "slow tempo 70 BPM" },
  { label: "ミディアム(90-110)", bpmText: "medium tempo 100 BPM" },
  { label: "アップテンポ(120-140)", bpmText: "uptempo 130 BPM" },
  { label: "激速(150+)", bpmText: "fast tempo 160 BPM" },
];

const GENRE_EN: Record<string, string> = {
  "ポップ": "pop music",
  "ロック": "rock music",
  "ジャズ": "jazz music",
  "クラシック": "classical orchestral music",
  "EDM": "EDM electronic dance music",
  "ヒップホップ": "hip hop music",
  "R&B": "R&B soul music",
  "アニメ": "anime style music J-pop",
  "ローファイ": "lo-fi hip hop chill beats",
  "シネマティック": "cinematic film score music",
};
// ─────────────────────────────────────────────────────

function musicError(code: "MUSIC-001" | "MUSIC-002" | "MUSIC-003"): string {
  return `エラーが発生しました（エラーコード: ${code}）\n公式LINEにお問い合わせください。`;
}

async function downloadAudio(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lifai_music_${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadLyrics(text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lifai_lyrics_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function MusicStandardPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  // 簡易選択状態
  const [genre, setGenre] = useState<string>("");
  const [bpmRange, setBpmRange] = useState<string>("");
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  const [status, setStatus] = useState<GenStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("生成中…");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/login");
    }
    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current as unknown as ReturnType<typeof setTimeout>);
        pollRef.current = null;
      }
    };
  }, [router]);

  function appendMood(mood: string) {
    setPrompt((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return mood;
      return trimmed + "、" + mood;
    });
  }

  function buildCombinedPrompt(): string {
    const parts: string[] = [];
    if (genre) parts.push(GENRE_EN[genre] || genre);
    const bpmOpt = BPM_OPTIONS.find((o) => o.label === bpmRange);
    if (bpmOpt) parts.push(bpmOpt.bpmText);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.filter(Boolean).join(", ");
  }

  async function handleGenerate() {
    const combinedPrompt = buildCombinedPrompt();
    if (!combinedPrompt || status === "generating") return;

    setStatus("generating");
    setProgress(5);
    setOutputUrl(null);
    setErrorMsg(null);
    setLyrics(null);
    setLyricsOpen(false);
    setReleaseModalOpen(false);

    let predictionId: string;

    try {
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: combinedPrompt, mode: "standard" }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrorMsg(musicError("MUSIC-001"));
        setStatus("failed");
        return;
      }
      predictionId = data.predictionId;
      // 歌詞が返ってきた場合は即セット
      if (data.lyrics) setLyrics(data.lyrics);
    } catch {
      setErrorMsg(musicError("MUSIC-003"));
      setStatus("failed");
      return;
    }

    setProgress(15);

    // ポーリング: 再帰 setTimeout（並行リクエスト防止）
    let ticks = 0;
    let consecutiveErrors = 0;
    const MAX_TICKS = 210; // 最大7分 (2秒×210)
    const MAX_ERRORS = 3;  // 連続エラー3回で停止

    const poll = async () => {
      // アンマウント済みなら停止
      if (!pollRef.current) return;

      ticks++;
      setProgress(Math.min(90, 15 + ticks * 0.625));

      try {
        const res = await fetch(`/api/music/status?id=${predictionId}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!data.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_ERRORS) {
            pollRef.current = null;
            setErrorMsg(musicError("MUSIC-003"));
            setStatus("failed");
            return;
          }
        } else {
          consecutiveErrors = 0;

          // サーバー提供の進捗・ステージを反映
          if (typeof data.progress === "number") {
            setProgress(Math.round(data.progress * 100));
          }
          if (data.stage) {
            setStageLabel(data.stage);
          }

          if (data.status === "succeeded") {
            pollRef.current = null;
            setProgress(100);
            setOutputUrl(data.outputUrl ?? null);
            // status からも歌詞が取れれば更新（キャッシュ経由）
            if (data.lyrics) setLyrics(data.lyrics);
            setStatus("succeeded");
            return;
          } else if (data.status === "failed" || data.status === "canceled") {
            pollRef.current = null;
            setErrorMsg(musicError("MUSIC-001"));
            setStatus("failed");
            return;
          }
          // starting / processing: 継続
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_ERRORS) {
          pollRef.current = null;
          setErrorMsg(musicError("MUSIC-003"));
          setStatus("failed");
          return;
        }
      }

      if (ticks >= MAX_TICKS) {
        pollRef.current = null;
        setErrorMsg("生成に時間がかかっています。もうしばらくお待ちください（最大7分）");
        setStatus("failed");
        return;
      }

      // 次のポーリングをスケジュール
      const timerId = setTimeout(poll, 2000) as unknown as ReturnType<typeof setInterval>;
      pollRef.current = timerId;
    };

    // 最初のポーリングを2秒後に開始
    const timerId = setTimeout(poll, 2000) as unknown as ReturnType<typeof setInterval>;
    pollRef.current = timerId;
  }

  function handleReset() {
    if (pollRef.current) {
      clearTimeout(pollRef.current as unknown as ReturnType<typeof setTimeout>);
      pollRef.current = null;
    }
    setStatus("idle");
    setProgress(0);
    setStageLabel("生成中…");
    setOutputUrl(null);
    setErrorMsg(null);
    setLyrics(null);
    setLyricsOpen(false);
    setReleaseModalOpen(false);
  }

  const canGenerate = !!buildCombinedPrompt() && status !== "generating";

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[720px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <div className="flex items-center gap-3">
            <Link
              href="/music"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← 戻る
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <span className="text-base">🎵</span>
              STANDARD
            </div>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
            BGM生成 — STANDARD
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            日本語でテーマやムードを入力してください。自動で英語に変換して生成します。
          </p>

          {/* ── ジャンル ── */}
          <div className="mt-6">
            <label className="block text-xs font-bold text-slate-700">ジャンル</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? "" : g)}
                  disabled={status === "generating"}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    genre === g
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  ].join(" ")}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── BPM ── */}
          <div className="mt-5">
            <label className="block text-xs font-bold text-slate-700">BPM</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BPM_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setBpmRange(bpmRange === opt.label ? "" : opt.label)}
                  disabled={status === "generating"}
                  className={[
                    "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                    bpmRange === opt.label
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── プロンプト（テーマ・ムード） ── */}
          <div className="mt-5">
            <label className="block text-xs font-bold text-slate-700">
              プロンプト（テーマ・ムード）
            </label>

            {/* ムードボタン */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MOOD_TAGS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => appendMood(mood)}
                  disabled={status === "generating"}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mood}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={status === "generating"}
              placeholder="例: さわやかな朝の音楽、集中できるジャズ、激しいロック…"
              rows={4}
              className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
            />
          </div>

          {/* プログレスバー */}
          {status === "generating" && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>{stageLabel}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* 生成開始アナウンス */}
              <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-xs font-semibold leading-relaxed text-indigo-700">
                  生成を開始しました。完成まで約3〜4分かかります。<br />
                  Verse → Chorus → Bridge の順に生成後、結合します。<br />
                  このページを閉じずにお待ちください。
                </p>
              </div>
            </div>
          )}

          {/* エラー */}
          {status === "failed" && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="whitespace-pre-line text-sm font-semibold text-rose-700">
                {errorMsg || musicError("MUSIC-001")}
              </p>
              <button
                onClick={handleReset}
                className="mt-3 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                もう一度試す
              </button>
            </div>
          )}

          {/* 完了後：再生 & ダウンロード & 歌詞 & この曲をどうする？ */}
          {status === "succeeded" && outputUrl && (
            <div className="mt-6 rounded-[20px] border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-bold text-indigo-700">約3分の楽曲が完成しました！</p>
              <audio controls src={outputUrl} className="mt-3 w-full" />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => downloadAudio(outputUrl)}
                  className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  WAVをダウンロード
                </button>
                {lyrics && (
                  <button
                    onClick={() => downloadLyrics(lyrics)}
                    className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    歌詞をダウンロード
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:opacity-90"
                >
                  もう一度生成する
                </button>
              </div>

              {/* 歌詞折りたたみ表示 */}
              {lyrics && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-indigo-200 bg-white">
                  <button
                    onClick={() => setLyricsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition"
                  >
                    <span>歌詞を見る</span>
                    <span className="text-[10px]">{lyricsOpen ? "▲ 閉じる" : "▼ 開く"}</span>
                  </button>
                  {lyricsOpen && (
                    <div className="border-t border-indigo-100 px-4 pb-4 pt-3">
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                        {lyrics}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* この曲をどうする？ */}
              <div className="mt-5 border-t border-indigo-200 pt-5">
                <p className="text-xs font-bold text-slate-700">この曲をどうする？</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Card 1: LIFAI マーケット */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                      🔧 準備中
                    </span>
                    <p className="mt-2 text-xs font-bold text-slate-800">LIFAIマーケットで売却</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      LIFAIの専用売買プラットフォームに出品できます。準備中のためもうしばらくお待ちください。
                    </p>
                    <button
                      disabled
                      className="mt-3 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400"
                    >
                      マーケットで売却
                    </button>
                  </div>

                  {/* Card 2: 自分でリリース */}
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✅ 利用可能
                    </span>
                    <p className="mt-2 text-xs font-bold text-slate-800">自分でリリース</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      TuneCore・NaraSuなど配信サービスを使って自分でリリースできます。
                    </p>
                    <button
                      onClick={() => setReleaseModalOpen(true)}
                      className="mt-3 w-full rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      リリース方法を見る
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 生成ボタン（succeeded時は非表示） */}
          {status !== "succeeded" && (
            <div className="mt-6">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(99,102,241,.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "generating" ? "生成中…" : "生成する"}
              </button>
              {!canGenerate && status === "idle" && (
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  ジャンル・BPM・プロンプトのいずれかを選択してください
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>

      {/* リリースモーダル */}
      {releaseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setReleaseModalOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[24px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-900">自分でリリースする方法</p>
              <button
                onClick={() => setReleaseModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-800">TuneCoreへの申請手順</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">準備中・近日公開予定</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-800">NaraSuへの申請手順</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">準備中・近日公開予定</p>
              </div>
              <p className="text-center text-[11px] text-slate-500">
                詳細はLIFAIコミュニティで案内します
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
