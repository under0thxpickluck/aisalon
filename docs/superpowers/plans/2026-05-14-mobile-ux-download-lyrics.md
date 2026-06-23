# Music Download & Lyrics Edit — Mobile UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WAV・歌詞のダウンロードをiOS/Android両対応のシェア/保存に統一し、歌詞をインライン編集できるようにする。

**Architecture:** 新規APIプロキシ(`/api/music/download`)でCORSを回避しサーバー側でReplicateのURLからストリームする。クライアント側ユーティリティ(`app/lib/music-download.ts`)がWeb Share APIとプロキシフォールバックを管理する。各音楽生成ページに歌詞編集ステートを追加し、編集済み歌詞をダウンロードに反映する。

**Tech Stack:** Next.js 14 App Router (Route Handlers), Web Share API (navigator.share), TypeScript

---

## 変更しないもの

- GASコード・シート構造
- 認証フロー・APIルート（新規1本を除く）
- ページルーティング・データ形状
- `vercel.json`（既存の `"app/api/music/**"` グロブが新規ルートを自動カバー）

---

## File Map

| ファイル | 変更種別 | 役割 |
|---|---|---|
| `app/api/music/download/route.ts` | 新規作成 | Replicate オーディオURLをサーバー側でfetch → `Content-Disposition: attachment` 付きでストリーム返却。SSRF対策でホスト許可リスト検証 |
| `app/lib/music-download.ts` | 新規作成 | `shareOrDownloadAudio` / `shareOrDownloadText` を export。Web Share API → プロキシフォールバックのロジックを一元管理 |
| `app/music/standard/page.tsx` | 修正 | `downloadAudio`/`downloadLyrics`をユーティリティに差し替え。歌詞編集ステートと編集UIを追加 |
| `app/music/pro/page.tsx` | 修正 | standard と同様（goldカラー変数 C.* の使用あり） |
| `app/music2/page.tsx` | 修正 | iPhone/Android分割4ボタンを統合。歌詞編集ステート・編集UIを追加。履歴のdownloadAudioも差し替え |

---

## Task 1: 音声ダウンロード プロキシAPIルート

**Files:**
- Create: `app/api/music/download/route.ts`

- [ ] **Step 1: ファイル作成**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = ["replicate.delivery"];

function isAllowed(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl   = searchParams.get("url") ?? "";
  const filename = searchParams.get("filename") || "lifai_song.wav";

  if (!rawUrl)            return NextResponse.json({ error: "missing_url" },       { status: 400 });
  if (!isAllowed(rawUrl)) return NextResponse.json({ error: "disallowed_origin" }, { status: 403 });

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type":        upstream.headers.get("Content-Type") ?? "audio/wav",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
```

- [ ] **Step 2: 動作確認**

```bash
# devサーバー起動済みの状態で
curl -I "http://localhost:3000/api/music/download?url=https%3A%2F%2Fevil.com%2F"
# 期待: HTTP 403

curl -I "http://localhost:3000/api/music/download"
# 期待: HTTP 400
```

- [ ] **Step 3: コミット**

```bash
git add app/api/music/download/route.ts
git commit -m "feat(music): add server-side audio download proxy"
```

---

## Task 2: クライアント側ダウンロードユーティリティ

**Files:**
- Create: `app/lib/music-download.ts`

- [ ] **Step 1: ファイル作成**

```typescript
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 2: コミット**

```bash
git add app/lib/music-download.ts
git commit -m "feat(music): add shareOrDownloadAudio/Text utilities"
```

---

## Task 3: app/music/standard/page.tsx の更新

**Files:**
- Modify: `app/music/standard/page.tsx`

現在の状態（確認済み）:
- line 4: `useEffect`, `useRef`, `useState` 全てインポート済み
- lines 48-65: `downloadAudio` / `downloadLyrics` モジュール関数
- lines 81-82: `const [lyrics, setLyrics]` / `const [lyricsOpen, setLyricsOpen]`
- lines 85-96: 既存 useEffect（認証チェック）
- lines 405-454: 完了後のボタン群 + 歌詞折りたたみ

- [ ] **Step 1: import にユーティリティを追加**

`import Link from "next/link";` の直後の行に追加：
```typescript
import { shareOrDownloadAudio, shareOrDownloadText } from "@/app/lib/music-download";
```

- [ ] **Step 2: モジュールレベル関数を削除**

以下のブロック全体を削除：
```typescript
async function downloadAudio(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lifai_music_${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadLyrics(text: string, bom = false) {
  const blob = new Blob([bom ? "﻿" + text : text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lifai_lyrics_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 3: 歌詞編集ステートを追加**

`const [lyricsOpen, setLyricsOpen] = useState(false);` の直後に追加：
```typescript
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
```

- [ ] **Step 4: lyrics 同期 useEffect を追加**

既存 `useEffect(() => { const auth = getAuth(); ...` ブロックの直後（閉じ括弧 `}, [router]);` の後）に追加：
```typescript
  useEffect(() => {
    if (lyrics) setEditedLyrics(lyrics);
  }, [lyrics]);
```

- [ ] **Step 5: WAV・歌詞ボタンブロックを差し替え**

差し替え前（完全一致）:
```tsx
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => downloadAudio(outputUrl)}
                  className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  WAVをダウンロード
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:opacity-90"
                >
                  もう一度生成する
                </button>
              </div>
              {lyrics && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => downloadLyrics(lyrics, false)}
                    className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    歌詞をダウンロード（iPhone用）
                  </button>
                  <button
                    onClick={() => downloadLyrics(lyrics, true)}
                    className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    歌詞をダウンロード（Android用）
                  </button>
                </div>
              )}
```

差し替え後：
```tsx
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => shareOrDownloadAudio(outputUrl, "lifai_music.wav")}
                  className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition active:bg-indigo-100"
                >
                  📤 WAVを保存 / シェア
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition active:opacity-80"
                >
                  もう一度生成する
                </button>
              </div>
              {lyrics && (
                <div className="mt-2">
                  <button
                    onClick={() => shareOrDownloadText(editedLyrics, `lifai_lyrics_${Date.now()}.txt`)}
                    className="w-full rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition active:bg-indigo-100"
                  >
                    📄 歌詞を保存 / シェア
                  </button>
                </div>
              )}
```

- [ ] **Step 6: 歌詞折りたたみに編集UIを追加**

差し替え前（完全一致）:
```tsx
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
```

差し替え後：
```tsx
              {/* 歌詞折りたたみ + 編集 */}
              {lyrics && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-indigo-200 bg-white">
                  <button
                    onClick={() => { setLyricsOpen((v) => !v); setEditingLyrics(false); }}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-indigo-700 active:bg-indigo-50 transition"
                  >
                    <span>歌詞を見る / 編集</span>
                    <span className="text-[11px]">{lyricsOpen ? "▲ 閉じる" : "▼ 開く"}</span>
                  </button>
                  {lyricsOpen && (
                    <div className="border-t border-indigo-100 px-4 pb-4 pt-3">
                      {editingLyrics ? (
                        <>
                          <div className="mb-3 flex gap-2">
                            <button
                              onClick={() => setEditingLyrics(false)}
                              className="flex-1 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white active:opacity-80"
                            >
                              ✅ 保存
                            </button>
                            <button
                              onClick={() => { setEditedLyrics(lyrics ?? ""); setEditingLyrics(false); }}
                              className="flex-1 rounded-2xl border border-slate-300 py-3 text-sm font-semibold text-slate-600 active:bg-slate-100"
                            >
                              ✕ キャンセル
                            </button>
                          </div>
                          <textarea
                            value={editedLyrics}
                            onChange={(e) => {
                              setEditedLyrics(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            onFocus={(e) => {
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            className="w-full rounded-xl border border-indigo-200 p-3 leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            style={{ fontSize: "16px", minHeight: "180px", resize: "none" }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex justify-end">
                            <button
                              onClick={() => setEditingLyrics(true)}
                              className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 active:bg-indigo-50"
                            >
                              ✏️ 編集
                            </button>
                          </div>
                          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                            {editedLyrics}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 7: コミット**

```bash
git add app/music/standard/page.tsx
git commit -m "feat(music/standard): unified share button, lyrics inline edit"
```

---

## Task 4: app/music/pro/page.tsx の更新

**Files:**
- Modify: `app/music/pro/page.tsx`

現在の状態（確認済み）:
- line 4: `useEffect`, `useRef`, `useState` 全てインポート済み
- lines 211-218: `downloadAudio` / `downloadLyrics` モジュール関数
- lines 250-252: `const [lyrics, setLyrics]` / `const [lyricsOpen, setLyricsOpen]`
- lines 254-278: 既存 useEffect（認証チェック）
- lines 956-1013: 完了後のボタン群 + 歌詞折りたたみ
- スタイルは `C.*` 変数（gold テーマ）を使用

- [ ] **Step 1: import にユーティリティを追加**

`import Link from "next/link";` の直後に追加：
```typescript
import { shareOrDownloadAudio, shareOrDownloadText } from "@/app/lib/music-download";
```

- [ ] **Step 2: モジュールレベル関数を削除**

以下のブロック全体を削除：
```typescript
async function downloadAudio(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lifai_music_pro_${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadLyrics(text: string, bom = false) {
  const blob = new Blob([bom ? "﻿" + text : text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lifai_lyrics_pro_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 3: 歌詞編集ステートを追加**

`const [lyricsOpen, setLyricsOpen] = useState(false);` の直後に追加：
```typescript
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
```

- [ ] **Step 4: lyrics 同期 useEffect を追加**

既存 `useEffect(() => { const auth = getAuth(); ...` ブロックの直後に追加：
```typescript
  useEffect(() => {
    if (lyrics) setEditedLyrics(lyrics);
  }, [lyrics]);
```

- [ ] **Step 5: WAV・歌詞ボタンブロックを差し替え（goldテーマ）**

差し替え前（完全一致）:
```tsx
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => downloadAudio(outputUrl)}
                  className="flex-1 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition hover:opacity-80"
                  style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                >
                  WAVをダウンロード
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition hover:opacity-90"
                  style={{ background: `linear-gradient(to right, ${C.gold}, ${C.goldDark})`, color: "#000" }}
                >
                  もう一度生成する
                </button>
              </div>
              {lyrics && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => downloadLyrics(lyrics, false)}
                    className="flex-1 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition hover:opacity-80"
                    style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                  >
                    歌詞をダウンロード（iPhone用）
                  </button>
                  <button
                    onClick={() => downloadLyrics(lyrics, true)}
                    className="flex-1 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition hover:opacity-80"
                    style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                  >
                    歌詞をダウンロード（Android用）
                  </button>
                </div>
              )}
```

差し替え後：
```tsx
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => shareOrDownloadAudio(outputUrl, "lifai_music_pro.wav")}
                  className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:opacity-70"
                  style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                >
                  📤 WAVを保存 / シェア
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-extrabold transition active:opacity-80"
                  style={{ background: `linear-gradient(to right, ${C.gold}, ${C.goldDark})`, color: "#000" }}
                >
                  もう一度生成する
                </button>
              </div>
              {lyrics && (
                <div className="mt-2">
                  <button
                    onClick={() => shareOrDownloadText(editedLyrics, `lifai_lyrics_pro_${Date.now()}.txt`)}
                    className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition active:opacity-70"
                    style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                  >
                    📄 歌詞を保存 / シェア
                  </button>
                </div>
              )}
```

- [ ] **Step 6: 歌詞折りたたみに編集UIを追加（goldテーマ）**

差し替え前（完全一致）:
```tsx
              {/* 歌詞折りたたみ */}
              {lyrics && (
                <div
                  className="mt-3 overflow-hidden rounded-2xl border"
                  style={{ backgroundColor: C.inner, borderColor: C.border }}
                >
                  <button
                    onClick={() => setLyricsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold transition hover:opacity-80"
                    style={{ color: C.gold }}
                  >
                    <span>歌詞を見る</span>
                    <span className="text-[10px]">{lyricsOpen ? "▲ 閉じる" : "▼ 開く"}</span>
                  </button>
                  {lyricsOpen && (
                    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: C.border }}>
                      <p className="whitespace-pre-line text-xs leading-relaxed" style={{ color: C.textSecondary }}>
                        {lyrics}
                      </p>
                    </div>
                  )}
                </div>
              )}
```

差し替え後：
```tsx
              {/* 歌詞折りたたみ + 編集 */}
              {lyrics && (
                <div
                  className="mt-3 overflow-hidden rounded-2xl border"
                  style={{ backgroundColor: C.inner, borderColor: C.border }}
                >
                  <button
                    onClick={() => { setLyricsOpen((v) => !v); setEditingLyrics(false); }}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold transition active:opacity-70"
                    style={{ color: C.gold }}
                  >
                    <span>歌詞を見る / 編集</span>
                    <span className="text-[11px]">{lyricsOpen ? "▲ 閉じる" : "▼ 開く"}</span>
                  </button>
                  {lyricsOpen && (
                    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: C.border }}>
                      {editingLyrics ? (
                        <>
                          <div className="mb-3 flex gap-2">
                            <button
                              onClick={() => setEditingLyrics(false)}
                              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-black active:opacity-80"
                              style={{ background: `linear-gradient(to right, ${C.gold}, ${C.goldDark})` }}
                            >
                              ✅ 保存
                            </button>
                            <button
                              onClick={() => { setEditedLyrics(lyrics ?? ""); setEditingLyrics(false); }}
                              className="flex-1 rounded-2xl border py-3 text-sm font-semibold active:opacity-70"
                              style={{ borderColor: C.border, color: C.textSecondary, backgroundColor: C.section }}
                            >
                              ✕ キャンセル
                            </button>
                          </div>
                          <textarea
                            value={editedLyrics}
                            onChange={(e) => {
                              setEditedLyrics(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            onFocus={(e) => {
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            className="w-full rounded-xl border p-3 leading-relaxed outline-none"
                            style={{
                              fontSize: "16px",
                              minHeight: "180px",
                              resize: "none",
                              borderColor: C.gold,
                              backgroundColor: C.bg,
                              color: C.textPrimary,
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex justify-end">
                            <button
                              onClick={() => setEditingLyrics(true)}
                              className="rounded-xl border px-4 py-2 text-sm font-semibold active:opacity-70"
                              style={{ borderColor: C.gold, color: C.gold, backgroundColor: C.inner }}
                            >
                              ✏️ 編集
                            </button>
                          </div>
                          <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: C.textSecondary }}>
                            {editedLyrics}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 7: コミット**

```bash
git add app/music/pro/page.tsx
git commit -m "feat(music/pro): unified share button, lyrics inline edit"
```

---

## Task 5: app/music2/page.tsx の更新

**Files:**
- Modify: `app/music2/page.tsx`

現在の状態（確認済み）:
- lines 204-221: `async function downloadAudio(...)` モジュール関数
- lines 245-250: `downloadUrl`, `displayLyrics`, `distributionLyrics` ステート
- lines 271-272: `copiedJobId`, `userId` ステート
- lines 1469-1485: Step3 WAVボタン + もう1曲ボタン
- lines 1513-1599: iPhone/Android分割4ボタン（表示用2 + 配信用2）
- lines 1621-1625: 履歴の WAV/MP3 ボタン

- [ ] **Step 1: import にユーティリティを追加**

`"use client";` の直後の行に追加：
```typescript
import { shareOrDownloadAudio, shareOrDownloadText } from "@/app/lib/music-download";
```

- [ ] **Step 2: モジュールレベルの downloadAudio 関数を削除**

以下のブロック全体を削除：
```typescript
async function downloadAudio(url: string, title: string, ext: "wav" | "mp3" = "wav") {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "lifai_song"}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    // フェッチ失敗時はブラウザの直リンクにフォールバック
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "lifai_song"}_${Date.now()}.${ext}`;
    a.target = "_blank";
    a.click();
  }
}
```

- [ ] **Step 3: 歌詞編集ステートを追加**

`const [copiedJobId, setCopiedJobId] = useState<string | null>(null);` の直後に追加：
```typescript
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [editedDisplayLyrics, setEditedDisplayLyrics] = useState("");
  const [editedDistribLyrics, setEditedDistribLyrics] = useState("");
```

- [ ] **Step 4: 歌詞同期 useEffect を追加**

`const [userId, setUserId] = useState<string>("");` の直後に追加：
```typescript
  useEffect(() => { setEditedDisplayLyrics(displayLyrics); }, [displayLyrics]);
  useEffect(() => { setEditedDistribLyrics(distributionLyrics); }, [distributionLyrics]);
```

- [ ] **Step 5: Step3 WAVボタンを差し替え**

差し替え前（完全一致）:
```tsx
                {/* ボタン */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {downloadUrl && (
                    <button
                      onClick={() => downloadAudio(downloadUrl, resultTitle, "wav")}
                      className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      WAVをダウンロード
                    </button>
                  )}
                  <button
                    onClick={handleFullReset}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:opacity-90"
                  >
                    {isBgmMode ? "もう1つBGMを作る" : "もう1曲作る"}
                  </button>
                </div>
```

差し替え後：
```tsx
                {/* ボタン */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {downloadUrl && (
                    <button
                      onClick={() => shareOrDownloadAudio(
                        downloadUrl,
                        `${resultTitle || "lifai_song"}.wav`
                      )}
                      className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition active:bg-indigo-100"
                    >
                      📤 WAVを保存 / シェア
                    </button>
                  )}
                  <button
                    onClick={handleFullReset}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition active:opacity-80"
                  >
                    {isBgmMode ? "もう1つBGMを作る" : "もう1曲作る"}
                  </button>
                </div>
```

- [ ] **Step 6: 歌詞セクションを差し替え（編集UI + 統合ボタン）**

差し替え前（完全一致）— `{/* 歌詞ダウンロード */}` から `</div>` まで（lines 1513-1599）:
```tsx
                {/* 歌詞ダウンロード */}
                {displayLyrics && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex flex-col gap-1.5 sm:flex-row">
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
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        📄 歌詞ダウンロード 表示用（iPhone）
                      </button>
                      <button
                        onClick={() => {
                          const blob = new Blob(
                            ["﻿" + `${resultTitle}\n\n${displayLyrics}`],
                            { type: "text/plain;charset=utf-8" }
                          );
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `lyrics-display-${jobId || "song"}.txt`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        📄 歌詞ダウンロード 表示用（Android）
                      </button>
                    </div>
                    {distributionLyrics ? (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
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
                          className={`flex-1 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                            distributionReady
                              ? "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {distributionReady ? "✅ 配信用歌詞（iPhone）" : "📋 配信用歌詞（iPhone・要確認）"}
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob(
                              ["﻿" + `${resultTitle}\n\n${distributionLyrics}`],
                              { type: "text/plain;charset=utf-8" }
                            );
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `lyrics-distribution-${jobId || "song"}.txt`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }}
                          className={`flex-1 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                            distributionReady
                              ? "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {distributionReady ? "✅ 配信用歌詞（Android）" : "📋 配信用歌詞（Android・要確認）"}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-xs font-semibold text-red-600">
                        🚫 配信用歌詞：品質確認が必要なため提出前に手動確認が必要です
                      </div>
                    )}
                  </div>
                )}
```

差し替え後：
```tsx
                {/* 歌詞エディター + 保存 */}
                {displayLyrics && (
                  <div className="mt-3 flex flex-col gap-2">
                    {/* 表示用歌詞 インライン編集 */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-bold text-slate-600">歌詞（表示用）</span>
                        {editingLyrics ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingLyrics(false)}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white active:opacity-80"
                            >
                              ✅ 保存
                            </button>
                            <button
                              onClick={() => { setEditedDisplayLyrics(displayLyrics); setEditingLyrics(false); }}
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingLyrics(true)}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100"
                          >
                            ✏️ 編集
                          </button>
                        )}
                      </div>
                      <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                        {editingLyrics ? (
                          <textarea
                            value={editedDisplayLyrics}
                            onChange={(e) => {
                              setEditedDisplayLyrics(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            onFocus={(e) => {
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            className="w-full rounded-xl border border-indigo-200 p-3 leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            style={{ fontSize: "16px", minHeight: "180px", resize: "none" }}
                          />
                        ) : (
                          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                            {editedDisplayLyrics}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 表示用 保存/シェアボタン */}
                    <button
                      onClick={() => shareOrDownloadText(
                        `${resultTitle}\n\n${editedDisplayLyrics}`,
                        `lyrics-display-${jobId || "song"}.txt`
                      )}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition active:bg-slate-100"
                    >
                      📄 歌詞を保存 / シェア（表示用）
                    </button>

                    {/* 配信用 */}
                    {distributionLyrics ? (
                      <button
                        onClick={() => shareOrDownloadText(
                          `${resultTitle}\n\n${editedDistribLyrics}`,
                          `lyrics-distribution-${jobId || "song"}.txt`
                        )}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition active:opacity-70 ${
                          distributionReady
                            ? "border-violet-200 bg-white text-violet-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {distributionReady ? "✅ 配信用歌詞を保存 / シェア" : "📋 配信用歌詞を保存 / シェア（要確認）"}
                      </button>
                    ) : (
                      <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
                        🚫 配信用歌詞：品質確認が必要なため提出前に手動確認が必要です
                      </div>
                    )}
                  </div>
                )}
```

- [ ] **Step 7: 履歴の WAV/MP3 ボタンを差し替え**

差し替え前（完全一致）:
```tsx
                    <button
                      onClick={() => downloadAudio(entry.downloadUrl, entry.title, entry.downloadUrl?.includes(".mp3") ? "mp3" : "wav")}
                      className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      {entry.downloadUrl?.includes(".mp3") ? "MP3" : "WAV"}
                    </button>
```

差し替え後：
```tsx
                    <button
                      onClick={() => shareOrDownloadAudio(
                        entry.downloadUrl,
                        `${entry.title || "lifai_song"}.${entry.downloadUrl?.includes(".mp3") ? "mp3" : "wav"}`
                      )}
                      className="rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-indigo-600 active:bg-indigo-50 transition"
                    >
                      📤 {entry.downloadUrl?.includes(".mp3") ? "MP3" : "WAV"}
                    </button>
```

- [ ] **Step 8: コミット**

```bash
git add app/music2/page.tsx
git commit -m "feat(music2): unified share button, lyrics inline edit, history update"
```

---

## Task 6: ビルド確認・プッシュ

- [ ] **Step 1: ビルド確認**

```bash
npm run build
```

期待: エラーなし（型エラー含む）。`shareOrDownloadAudio` が `downloadAudio` に置き換えられたため未使用変数エラーが出ないこと。

- [ ] **Step 2: devサーバーで動作確認**

```bash
npm run dev
```

確認チェックリスト:
- [ ] `http://localhost:3000/music/standard` → 楽曲生成後「📤 WAVを保存 / シェア」が表示される
- [ ] 「歌詞を見る / 編集」アコーディオンを開くと「✏️ 編集」ボタンがある
- [ ] 「✏️ 編集」で textarea が出て入力できる（iOSズーム防止の font-size:16px）
- [ ] テキスト入力で textarea が自動拡張する
- [ ] 「✅ 保存」で編集内容が確定し表示モードに戻る
- [ ] 「📄 歌詞を保存 / シェア」が編集後の内容でシェート/DLされる
- [ ] `http://localhost:3000/music/pro` で同様に確認
- [ ] `http://localhost:3000/music2` で WAVボタン・歌詞エディター・配信用ボタン確認
- [ ] 履歴セクションの「📤 WAV」ボタンが動作する
- [ ] `/api/music/download?url=https%3A%2F%2Fevil.com` → 403 が返る

- [ ] **Step 3: プッシュ**

```bash
git push origin main
```
