"use client";

/**
 * iOS/Android/Desktop 対応 音声保存/シェア
 * 1. Web Share API with File (iOS 15+ / Android Chrome 75+) → ネイティブシェアシート
 * 2. Fallback: プロキシURL経由 Content-Disposition ダウンロード
 * AbortError（ユーザーキャンセル）は握り潰す。他のエラーはフォールバックへ。
 */
export async function shareOrDownloadAudio(
  url: string,
  filename: string
): Promise<void> {
  const proxyUrl =
    `/api/music/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], filename, { type: blob.type || "audio/wav" });
        // canShare は型定義が不完全なブラウザがあるため any キャスト
        const nav = navigator as any;
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await navigator.share({ files: [file] } as any);
          return;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // share/fetch 失敗 → フォールバックへ
    }
  }

  // フォールバック: プロキシ直リンク（Content-Disposition でブラウザがDL）
  const a = document.createElement("a");
  a.href = proxyUrl;
  a.download = filename;
  const target = document.body ?? document.documentElement;
  target.appendChild(a);
  a.click();
  target.removeChild(a);
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
