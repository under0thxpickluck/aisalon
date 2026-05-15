"use client";

/**
 * iOS/Android/Desktop 対応 音声保存/シェア
 * 1. 直接フェッチ（R2・Replicate は CORS 対応のため多くの場合成功）
 * 2. 直接失敗時はサーバープロキシ経由でフェッチ
 * 3. Web Share API with File (iOS 15+ / Android Chrome 75+) → ネイティブシェアシート
 * 4. Fallback: Blob URL ダウンロード
 */
export async function shareOrDownloadAudio(
  url: string,
  filename: string
): Promise<void> {
  const mimeType = filename.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
  const proxyUrl =
    `/api/music/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

  // ── Step 1: 直接フェッチ ──────────────────────────────────────
  let blob: Blob | null = null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 0) {
        blob = new Blob([buf], { type: mimeType });
      }
    }
  } catch {
    // CORS エラーなど → プロキシへ
  }

  // ── Step 2: プロキシ経由フェッチ ─────────────────────────────
  if (!blob) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) {
          blob = new Blob([buf], { type: mimeType });
        }
      }
    } catch {
      // ネットワークエラー
    }
  }

  if (!blob) {
    alert("このファイルはダウンロードできません。\nURLが期限切れの可能性があります。新しく楽曲を生成してください。");
    return;
  }

  // ── Step 3: Web Share API（iOS / Android）──────────────────────
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const file = new File([blob], filename, { type: mimeType });
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

  // ── Step 4: Blob URL ダウンロード（Desktop / share非対応環境）──
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
