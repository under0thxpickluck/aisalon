"use client";

import { useMemo, useState } from "react";
import {
  LINE_SPEC,
  validateTitle,
  validateDescription,
  type ValidationIssue,
} from "@/app/lib/sticker/line_spec";
import { buildExportFiles } from "@/app/lib/sticker/client/formatter";
import { buildZip, downloadBlob, safeFileName } from "@/app/lib/sticker/client/zip_builder";
import { selectedAssetUrl, type StickerExportMeta, type StickerItem } from "@/app/lib/sticker/types";
import type { TextStyle } from "@/app/lib/sticker/client/composer";

type Props = {
  items: StickerItem[];
  meta: StickerExportMeta;
  style: TextStyle;
  onMetaChange: (meta: StickerExportMeta) => void;
};

const CREATORS_MARKET_URL = "https://creator.line.me/ja/";

// STEP8: LINE提出用のZIPを書き出す。
// LINEへの自動申請はしない（ログイン情報を預からずに済むため）。
export default function StickerExportPanel({
  items,
  meta,
  style,
  onMetaChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const doneCount = useMemo(
    () => items.filter((it) => selectedAssetUrl(it)).length,
    [items]
  );

  const titleIssue = validateTitle(meta.title);
  const descIssue = validateDescription(meta.description);
  const allDone = doneCount === items.length && items.length > 0;
  const canExport = doneCount > 0 && !titleIssue && !descIssue && !busy;

  const set = (patch: Partial<StickerExportMeta>) =>
    onMetaChange({ ...meta, ...patch });

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("コピーできませんでした");
    }
  };

  const exportZip = async () => {
    setBusy(true);
    setError("");
    setIssues([]);
    setProgress(0);
    setTotal(doneCount + 2); // スタンプ + main + tab
    try {
      const files = await buildExportFiles(items, style, (d, t) => {
        setProgress(d);
        setTotal(t);
      });
      const result = await buildZip(files, meta);
      setIssues(result.issues);
      downloadBlob(result.blob, `${safeFileName(meta.title)}.zip`);
    } catch {
      setError("書き出しに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const checks: { label: string; ok: boolean; detail: string }[] = [
    {
      label: "スタンプ画像",
      ok: allDone,
      detail: `${doneCount} / ${items.length} 枚`,
    },
    {
      label: "画像の規格",
      ok: true,
      detail: `${LINE_SPEC.sticker.maxWidth}×${LINE_SPEC.sticker.maxHeight}px・PNG・背景透過`,
    },
    { label: "タイトル", ok: !titleIssue, detail: titleIssue?.message ?? "OK" },
    { label: "説明文", ok: !descIssue, detail: descIssue?.message ?? "OK" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            タイトル（{LINE_SPEC.titleMaxLength}文字以内）
          </label>
          <input
            value={meta.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="ポチの日常"
            className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">
            {meta.title.length} / {LINE_SPEC.titleMaxLength}
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            説明文（{LINE_SPEC.descriptionMaxLength}文字以内）
          </label>
          <textarea
            value={meta.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="ゆるい柴犬ポチの日常スタンプです。"
            rows={3}
            className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">
            {meta.description.length} / {LINE_SPEC.descriptionMaxLength}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              作者名
            </label>
            <input
              value={meta.creator}
              onChange={(e) => set({ creator: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              コピーライト
            </label>
            <input
              value={meta.copyright}
              onChange={(e) => set({ copyright: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 p-4">
        <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          提出前チェック
        </p>
        <ul className="flex flex-col gap-1.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-[11px]">
              <span className={c.ok ? "text-emerald-500" : "text-amber-500"}>
                {c.ok ? "✓" : "!"}
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {c.label}
              </span>
              <span className="text-slate-500 dark:text-slate-400">{c.detail}</span>
            </li>
          ))}
        </ul>
        {!allDone && doneCount > 0 && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
            未完成の枚を除いて書き出せますが、LINEは8/16/24/32/40個ちょうどでの提出を求めます。
          </p>
        )}
      </section>

      {issues.length > 0 && (
        <ul className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
          {issues.map((i) => (
            <li
              key={i.field}
              className="text-[11px] font-semibold text-amber-700 dark:text-amber-300"
            >
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canExport}
        onClick={exportZip}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-gray-700"
      >
        {busy
          ? `書き出し中… ${progress}/${total}`
          : "LINE提出用ZIPをダウンロード（無料）"}
      </button>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => copy("タイトル", meta.title)}
          className="flex-1 rounded-xl border border-slate-300 dark:border-gray-600 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-gray-800"
        >
          {copied === "タイトル" ? "コピーしました" : "タイトルをコピー"}
        </button>
        <button
          type="button"
          onClick={() => copy("説明文", meta.description)}
          className="flex-1 rounded-xl border border-slate-300 dark:border-gray-600 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-gray-800"
        >
          {copied === "説明文" ? "コピーしました" : "説明文をコピー"}
        </button>
        <a
          href={CREATORS_MARKET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl border border-slate-300 dark:border-gray-600 py-2 text-center text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-gray-800"
        >
          LINE Creators Marketを開く
        </a>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        LIFAIは提出用のファイルを用意するところまでを行います。申請と審査はLINE
        Creators Market上でご自身で行ってください。審査の可否はLINEの判断によります。
      </p>
    </div>
  );
}
