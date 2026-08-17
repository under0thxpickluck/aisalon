"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import StickerSetupForm, {
  type SetupValues,
} from "@/components/sticker/StickerSetupForm";
import StickerCharacterLock from "@/components/sticker/StickerCharacterLock";
import StickerManifestEditor from "@/components/sticker/StickerManifestEditor";
import StickerGrid from "@/components/sticker/StickerGrid";
import StickerExportPanel from "@/components/sticker/StickerExportPanel";
import StickerLoadingOverlay, {
  type OverlayKind,
} from "@/components/sticker/StickerLoadingOverlay";
import StickerBatchProgress from "@/components/sticker/StickerBatchProgress";
import {
  DEFAULT_TEXT_STYLE,
  TEXT_PRESETS,
  type TextStyle,
} from "@/app/lib/sticker/client/composer";
import {
  DEFAULT_EFFECT,
  EFFECT_COLORS,
  EFFECT_LABELS,
  type EffectId,
  type EffectStyle,
} from "@/app/lib/sticker/client/effects";
import { toStickerItems, normalizeProfile } from "@/app/lib/sticker/manifest";
import { STICKER_BP } from "@/app/lib/sticker/cost";
import { appendAsset } from "@/app/lib/sticker/types";
import type {
  ManifestEntry,
  StickerCount,
  StickerProject,
  StickerTheme,
} from "@/app/lib/sticker/types";

// 同時に走らせる生成本数。
// gpt-image-1 は1枚30〜60秒かかる。3本だとレート制限や
// タイムアウトで失敗が目立ったため2本に落としている。
const CONCURRENCY = 2;

// 1枚あたりの再試行回数。
// 生成に失敗したときサーバー側でクレジットが返却されるため、
// 自動で作り直しても二重課金にはならない。
const RENDER_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 通信自体が落ちることがあるので、JSONが取れるまで数回試す。
async function postJson(
  url: string,
  body: unknown,
  retries = 1
): Promise<any> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (data) return data;
      throw new Error("invalid_response");
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(1200 * (attempt + 1));
    }
  }
  throw lastError ?? new Error("request_failed");
}

type Step = "setup" | "character" | "grid" | "export";

function newProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sticker_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export default function StickerPage() {
  const router = useRouter();
  const [authId, setAuthId] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [balance, setBalance] = useState(0);
  const [booting, setBooting] = useState(true);

  const [step, setStep] = useState<Step>("setup");
  const [project, setProject] = useState<StickerProject | null>(null);
  const [style, setStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  // 背景エフェクトはCanvasで描くだけなのでBPを消費しない。いつでも切り替えられる。
  const [effect, setEffect] = useState<EffectStyle>(DEFAULT_EFFECT);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // 画面全体を覆う「作成中」表示。数十秒なにも起きない待ちにだけ使う。
  const [overlay, setOverlay] = useState<OverlayKind | null>(null);
  // 一括生成の進捗バー用。残り時間を実測から出すために開始時点を持つ。
  const [batch, setBatch] = useState<{ startedAt: number; doneAtStart: number } | null>(
    null
  );

  // 並列生成中でも常に最新のプロジェクトを参照するための実体
  const projectRef = useRef<StickerProject | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  // 「新しく作る」を押したときに、走っている一括生成を確実に止めるための世代番号
  const runIdRef = useRef(0);
  const aliveRef = useRef(true);

  const commit = useCallback(
    (updater: (prev: StickerProject) => StickerProject) => {
      const prev = projectRef.current;
      if (!prev) return;
      const next = { ...updater(prev), updatedAt: new Date().toISOString() };
      projectRef.current = next;
      setProject(next);
    },
    []
  );

  const refreshBalance = useCallback(async (id: string) => {
    try {
      const r = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (d?.ok) setBalance(Number(d.bp ?? 0));
    } catch {
      /* 残高表示だけの問題なので握りつぶす */
    }
  }, []);

  // 保存は常に1本だけ走らせ、走っている間の変更はまとめて次の1回に集約する
  const flushSave = useCallback(async () => {
    if (savingRef.current) {
      dirtyRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      do {
        dirtyRef.current = false;
        const p = projectRef.current;
        if (!p) break;
        await fetch("/api/sticker/project", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: authId,
            code: authCode,
            projectId: p.projectId,
            name: p.name,
            status: p.status,
            project: p,
          }),
        });
      } while (dirtyRef.current);
    } catch {
      /* 保存失敗はUIを止めない。次の保存で回復する */
    } finally {
      savingRef.current = false;
    }
  }, [authId, authCode]);

  useEffect(() => {
    const a = getAuth();
    if (!a) {
      router.replace("/login");
      return;
    }
    const id = (a as any)?.id || (a as any)?.loginId || (a as any)?.login_id || "";
    const code = getAuthSecret() || (a as any)?.token || "";
    if (!id || !code) {
      router.replace("/login");
      return;
    }
    setAuthId(id);
    setAuthCode(code);
    refreshBalance(id);

    // 前回の続きがあれば復元する（途中離脱してもクレジットは残っている）
    (async () => {
      try {
        const r = await fetch("/api/sticker/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, code }),
        });
        const d = await r.json();
        const latest = Array.isArray(d?.projects) ? d.projects[0] : null;
        if (latest?.project_json) {
          const parsed = JSON.parse(latest.project_json) as StickerProject;
          // 保存形式が想定外なら復元しない（新規作成に倒す）
          if (!parsed?.character || !Array.isArray(parsed.items)) return;

          const restored: StickerProject = {
            ...parsed,
            credits: Number(latest.credits ?? 0),
            // ブラウザを閉じた時点で生成中だったコマは、保存上も rendering のまま残る。
            // そのままだと永久に「生成中…」の表示で固まるので待機中に戻す。
            items: parsed.items.map((i) =>
              i.status === "rendering"
                ? { ...i, status: i.assets.length ? ("done" as const) : ("pending" as const) }
                : i
            ),
          };

          projectRef.current = restored;
          setProject(restored);
          setStep(
            restored.status === "ready"
              ? "export"
              : restored.character.locked
                ? "grid"
                : "character"
          );
          setNotice("前回の続きから再開できます。");
        }
      } catch {
        /* 復元できなくても新規作成はできる */
      } finally {
        setBooting(false);
      }
    })();
  }, [router, refreshBalance]);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ── STEP1: キャラクター生成 ────────────────────────────────
  const handleSetup = async (v: SetupValues) => {
    setBusy(true);
    setOverlay(v.sourceImage ? "upload" : "character");
    setError("");
    setNotice("");
    try {
      // 画像から作る場合は、先にR2へ上げてURLにしておく
      let sourceImageUrl = "";
      if (v.sourceImage) {
        const fd = new FormData();
        fd.append("id", authId);
        fd.append("code", authCode);
        fd.append("file", v.sourceImage);
        const up = await fetch("/api/sticker/upload", { method: "POST", body: fd })
          .then((r) => r.json())
          .catch(() => null);
        if (!up?.ok) {
          setError(
            up?.error === "too_large"
              ? "画像が大きすぎます。8MB以下にしてください。"
              : "画像のアップロードに失敗しました。もう一度お試しください。"
          );
          return;
        }
        sourceImageUrl = up.url as string;
        setOverlay("character");
      }

      const planRes = await postJson("/api/sticker/plan", {
        id: authId,
        code: authCode,
        sourcePrompt: v.sourcePrompt,
        sourceImageUrl,
        theme: v.theme,
        themeCustom: v.themeCustom,
        count: v.count,
      });

      if (!planRes?.ok) {
        setError("企画の作成に失敗しました。もう一度お試しください。");
        return;
      }

      const charRes = await postJson("/api/sticker/character", {
        id: authId,
        code: authCode,
        sourcePrompt: v.sourcePrompt,
        sourceImageUrl,
        profile: planRes.profile,
      });

      if (!charRes?.ok) {
        setError(
          charRes?.error === "insufficient_bp"
            ? `BPが足りません（${STICKER_BP.character}BP必要）`
            : "キャラクターの生成に失敗しました。BPは消費されていません。"
        );
        return;
      }

      const profile = normalizeProfile(planRes.profile);
      const now = new Date().toISOString();
      const next: StickerProject = {
        version: 1,
        projectId: newProjectId(),
        name: profile.name || "LINEスタンプ",
        count: v.count,
        theme: v.theme,
        themeCustom: v.themeCustom,
        character: {
          sourcePrompt: v.sourcePrompt,
          sourceImageUrl,
          profile,
          masterUrl: charRes.masterUrl,
          variantUrls: charRes.variantUrls ?? [],
          locked: false,
        },
        items: toStickerItems(planRes.manifest as ManifestEntry[]),
        credits: 0,
        meta: {
          title: profile.name ? `${profile.name}の日常` : "",
          description: "",
          creator: "",
          copyright: `© ${new Date().getFullYear()}`,
        },
        status: "character",
        createdAt: now,
        updatedAt: now,
      };

      projectRef.current = next;
      setProject(next);
      setStep("character");
      await refreshBalance(authId);
      flushSave();
    } catch {
      setError("通信に失敗しました。時間をおいてお試しください。");
    } finally {
      setBusy(false);
      setOverlay(null);
    }
  };

  // ── STEP2: キャラクターの作り直し ──────────────────────────
  const handleRetryCharacter = async () => {
    const p = projectRef.current;
    if (!p) return;
    setBusy(true);
    setOverlay("retry");
    setError("");
    try {
      const res = await postJson("/api/sticker/character", {
        id: authId,
        code: authCode,
        sourcePrompt: p.character.sourcePrompt,
        sourceImageUrl: p.character.sourceImageUrl ?? "",
        profile: p.character.profile,
      });

      if (!res?.ok) {
        setError(
          res?.error === "insufficient_bp"
            ? `BPが足りません（${STICKER_BP.character}BP必要）`
            : "生成に失敗しました。BPは消費されていません。"
        );
        return;
      }

      commit((prev) => ({
        ...prev,
        character: {
          ...prev.character,
          masterUrl: res.masterUrl,
          variantUrls: res.variantUrls ?? [],
        },
      }));
      await refreshBalance(authId);
      flushSave();
    } finally {
      setBusy(false);
      setOverlay(null);
    }
  };

  // ── 1枚生成 ────────────────────────────────────────────────
  const renderItem = useCallback(
    async (index: number) => {
      const p = projectRef.current;
      if (!p) return;
      const item = p.items.find((i) => i.index === index);
      if (!item) return;

      commit((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.index === index ? { ...i, status: "rendering" } : i
        ),
      }));

      // 生成失敗時はサーバーがクレジットを返すため、そのまま作り直してよい。
      // クレジット切れ(no_credits)だけは何度試しても無駄なので即座に諦める。
      let res: any = null;
      for (let attempt = 1; attempt <= RENDER_ATTEMPTS; attempt++) {
        try {
          res = await postJson("/api/sticker/render", {
            id: authId,
            code: authCode,
            projectId: p.projectId,
            masterUrl: p.character.masterUrl,
            profile: p.character.profile,
            item: {
              emotion: item.emotion,
              pose: item.pose,
              expression: item.expression,
            },
          });
        } catch {
          res = null;
        }

        if (res?.ok) break;
        if (res?.error === "no_credits") break;
        if (attempt < RENDER_ATTEMPTS) await sleep(2000 * attempt);
      }

      commit((prev) => ({
        ...prev,
        credits: Number(res?.credits ?? prev.credits),
        items: prev.items.map((i) => {
          if (i.index !== index) return i;
          if (!res?.ok) return { ...i, status: "failed" as const };
          return appendAsset(i, res.imageUrl as string);
        }),
      }));
      flushSave();
    },
    [authId, authCode, commit, flushSave]
  );

  // ── STEP4: 一括生成 ────────────────────────────────────────
  const runBatch = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return;

    const queue = p.items
      .filter((i) => i.status !== "done")
      .map((i) => i.index);
    let cursor = 0;
    const myRun = runIdRef.current;

    setBatch({
      startedAt: Date.now(),
      doneAtStart: p.items.length - queue.length,
    });

    const worker = async () => {
      while (aliveRef.current && runIdRef.current === myRun) {
        const at = cursor++;
        if (at >= queue.length) break;
        await renderItem(queue[at]);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setBatch(null);
    if (runIdRef.current !== myRun) return;

    commit((prev) => ({
      ...prev,
      status: prev.items.every((i) => i.status === "done") ? "ready" : "rendering",
    }));
    flushSave();
  }, [renderItem, commit, flushSave]);

  // ── STEP3: Character LOCK ＋ 先払い ────────────────────────
  const handleLock = async () => {
    const p = projectRef.current;
    if (!p) return;
    setBusy(true);
    setOverlay("start");
    setError("");
    try {
      const res = await fetch("/api/sticker/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: authId,
          code: authCode,
          projectId: p.projectId,
          count: p.count,
        }),
      }).then((r) => r.json());

      if (!res?.ok) {
        setError(
          res?.error === "insufficient_bp"
            ? "BPが足りません。"
            : "生成の開始に失敗しました。BPは消費されていません。"
        );
        return;
      }

      commit((prev) => ({
        ...prev,
        character: { ...prev.character, locked: true },
        credits: Number(res.credits ?? prev.count),
        status: "rendering",
      }));
      setStep("grid");
      await refreshBalance(authId);
      await flushSave();
      runBatch();
    } finally {
      setBusy(false);
      setOverlay(null);
    }
  };

  // ── 個別再生成（15BP） ─────────────────────────────────────
  const handleRegenerate = async (index: number) => {
    const p = projectRef.current;
    if (!p) return;
    const item = p.items.find((i) => i.index === index);
    if (!item) return;

    if (balance < STICKER_BP.regenerate) {
      setError(`BPが足りません（${STICKER_BP.regenerate}BP必要）`);
      return;
    }

    commit((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.index === index ? { ...i, status: "rendering" } : i
      ),
    }));

    try {
      const res = await fetch("/api/sticker/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: authId,
          code: authCode,
          masterUrl: p.character.masterUrl,
          profile: p.character.profile,
          item: {
            emotion: item.emotion,
            pose: item.pose,
            expression: item.expression,
          },
        }),
      }).then((r) => r.json());

      commit((prev) => ({
        ...prev,
        items: prev.items.map((i) => {
          if (i.index !== index) return i;
          if (!res?.ok) {
            // 元の画像が残っていれば done に戻す
            return { ...i, status: i.assets.length ? "done" : "failed" };
          }
          return appendAsset(i, res.imageUrl as string);
        }),
      }));

      if (!res?.ok) setError("作り直しに失敗しました。BPは消費されていません。");
      await refreshBalance(authId);
      flushSave();
    } catch {
      setError("通信に失敗しました。");
    }
  };

  const handleTextChange = (index: number, text: string) => {
    commit((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.index === index ? { ...i, text } : i)),
    }));
    flushSave();
  };

  const handleSelectVersion = (index: number, version: number) => {
    commit((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.index === index ? { ...i, selectedVersion: version } : i
      ),
    }));
    flushSave();
  };

  const startOver = () => {
    // 世代を進めることで、走っている worker が次のループで抜ける
    runIdRef.current += 1;
    projectRef.current = null;
    setProject(null);
    setBatch(null);
    setStep("setup");
    setNotice("");
    setError("");
  };

  if (booting) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-gray-950 px-4 py-16">
        <p className="text-center text-sm text-slate-400">読み込み中…</p>
      </main>
    );
  }

  const doneCount = project?.items.filter((i) => i.status === "done").length ?? 0;
  const totalCount = project?.items.length ?? 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/top"
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:underline"
            >
              ← ホームに戻る
            </Link>
            <h1 className="mt-1 text-xl font-extrabold text-slate-800 dark:text-slate-100">
              LINE Sticker Studio
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              キャラクターを固定したまま、LINEスタンプを一括で作ります
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-extrabold text-white">
              {balance} BP
            </span>
            {project && project.credits > 0 && (
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                残り生成 {project.credits} 回
              </span>
            )}
          </div>
        </header>

        {notice && (
          <p className="mb-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="rounded-[20px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
          {step === "setup" && (
            <StickerSetupForm balance={balance} busy={busy} onSubmit={handleSetup} />
          )}

          {step === "character" && project && (
            <StickerCharacterLock
              character={project.character}
              count={project.count}
              balance={balance}
              busy={busy}
              onLock={handleLock}
              onRetry={handleRetryCharacter}
            >
              <StickerManifestEditor
                items={project.items}
                onChange={handleTextChange}
              />
            </StickerCharacterLock>
          )}

          {(step === "grid" || step === "export") && project && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {project.name}
                    <span className="ml-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      キャラクター確定済み 🔒
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {doneCount} / {totalCount} 枚 完成
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(step === "grid" ? "export" : "grid")}
                    className="rounded-xl border border-slate-300 dark:border-gray-600 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-gray-800"
                  >
                    {step === "grid" ? "書き出しへ" : "一覧に戻る"}
                  </button>
                  <button
                    type="button"
                    onClick={startOver}
                    className="rounded-xl border border-slate-300 dark:border-gray-600 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-gray-800"
                  >
                    新しく作る
                  </button>
                </div>
              </div>

              {step === "grid" && (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 px-3 py-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      文字の色
                    </span>
                    {TEXT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setStyle({ ...DEFAULT_TEXT_STYLE, ...p.style })}
                        className={[
                          "rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                          style.color === (p.style.color ?? DEFAULT_TEXT_STYLE.color)
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 dark:border-gray-600 text-slate-600 dark:text-slate-300",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-slate-400">
                      文字の変更は無料です
                    </span>
                  </div>

                  {/* 背景エフェクト（Canvasで描くだけなのでBPは不要） */}
                  <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        背景エフェクト
                      </span>
                      {(Object.keys(EFFECT_LABELS) as EffectId[]).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setEffect((e) => ({ ...e, id }))}
                          className={[
                            "rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                            effect.id === id
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 dark:border-gray-600 text-slate-600 dark:text-slate-300",
                          ].join(" ")}
                        >
                          {EFFECT_LABELS[id]}
                        </button>
                      ))}
                    </div>

                    {effect.id !== "none" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          色
                        </span>
                        {EFFECT_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEffect((e) => ({ ...e, color: c.value }))}
                            aria-label={c.label}
                            className={[
                              "h-6 w-6 rounded-full border-2 transition",
                              effect.color === c.value
                                ? "border-indigo-600 scale-110"
                                : "border-transparent",
                            ].join(" ")}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                        <span className="ml-auto text-[10px] text-slate-400">
                          エフェクトの変更も無料です
                        </span>
                      </div>
                    )}
                  </div>

                  <StickerGrid
                    items={project.items}
                    style={style}
                    effect={effect}
                    onRegenerate={handleRegenerate}
                    onTextChange={handleTextChange}
                    onSelectVersion={handleSelectVersion}
                  />

                  {batch && (
                    <StickerBatchProgress
                      done={doneCount}
                      total={totalCount}
                      startedAt={batch.startedAt}
                      doneAtStart={batch.doneAtStart}
                    />
                  )}

                  {!batch && !allDone && project.credits > 0 && (
                    <button
                      type="button"
                      onClick={runBatch}
                      className="w-full rounded-xl border border-indigo-500 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      残りの生成を続ける（残り {project.credits} 回・追加BPなし）
                    </button>
                  )}
                </>
              )}

              {step === "export" && (
                <StickerExportPanel
                  items={project.items}
                  meta={project.meta}
                  style={style}
                  effect={effect}
                  onMetaChange={(meta) => {
                    commit((prev) => ({ ...prev, meta }));
                    flushSave();
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {overlay && <StickerLoadingOverlay kind={overlay} />}
    </main>
  );
}
