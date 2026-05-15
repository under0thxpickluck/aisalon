"use client";

/**
 * iOS/Android/Desktop 対応 音声保存/シェア
 * 1. プロキシ経由でファイルを取得・検証（0バイトや失敗は即エラー表示）
 * 2. Web Share API with File (iOS 15+ / Android Chrome 75+) → ネイティブシェアシート
 * 3. Fallback: Blob URL ダウンロード（同一オリジンのため download 属性が有効）
 */
export async function shareOrDownloadAudio(
  url: string,
  filename: string
): Promise<void> {
  const proxyUrl =
    `/api/music/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

  // ── Step 1: ファイル取得・検証 ──────────────────────────────────
  let blob: Blob | null = null;
  try {
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const b = await res.blob();
      if (b.size > 0) blob = b;
    }
  } catch {
    // ネットワークエラー → blob は null のまま
  }

  if (!blob) {
    alert("このファイルはダウンロードできません。\nURLが期限切れの可能性があります。新しく楽曲を生成してください。");
    return;
  }

  // ── Step 2: Web Share API（iOS / Android）──────────────────────
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const file = new File([blob], filename, { type: blob.type || "audio/wav" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file] } as any);
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // share 失敗 → Blob URL フォールバックへ
    }
  }

  // ── Step 3: Blob URL ダウンロード（Desktop / share非対応環境）──
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  const target = document.body ?? document.documentElement;
  target.appendChild(a);
  a.click();
  target.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/**
 * iOS/Android/Desktop 対応 歌詞テキスト保存/シェア
 * UTF-8 BOM を先頭に付与（Android テキストアプリの文字化け対策）
 * 1. Web Share API with File → ネイティブシェアシート
 * 2. Fallback: Blob URL ダウンロード
 */
export async function shareOrDownloadText(
  text: string,
  filename: string
): Promise<void> {
  const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" });

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const file = new File([blob], filename, { type: "text/plain" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file] } as any);
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  const target = document.body ?? document.documentElement;
  target.appendChild(a);
  a.click();
  target.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
