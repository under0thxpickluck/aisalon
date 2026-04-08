# narasu代理申請フォーム 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LIFAIトップから遷移できるnarasu向け代理申請フォームを実装する（パスワードゲート→規約同意→フォーム入力→確認→GAS保存→完了）

**Architecture:** Next.js App Router のページ群（`app/narasu-agency/`）+ Next.js API route（`app/api/narasu-agency/submit/`）+ GAS新アクション（`narasu_agency_submit`）。フォームデータはlocalStorageで画面間を引き回し、本申請時にGASへ保存。決済は未実装（料金未確定・Stripe未導入のため完了画面にLINE問い合わせ導線を置く）。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Google Apps Script (GAS), localStorage

---

## ファイル構成

| 種別 | パス | 責務 |
|------|------|------|
| 新規 | `lib/narasu-agency/constants.ts` | パスワード・料金・規約バージョン定数 |
| 新規 | `lib/narasu-agency/types.ts` | 型定義 |
| 新規 | `lib/narasu-agency/validation.ts` | バリデーション関数 |
| 新規 | `lib/narasu-agency/storage.ts` | localStorage 下書き保存/読み込み |
| 新規 | `app/narasu-agency/page.tsx` | パスワードゲート画面 |
| 新規 | `app/narasu-agency/terms/page.tsx` | 規約確認画面 |
| 新規 | `app/narasu-agency/form/page.tsx` | 申請フォーム入力画面 |
| 新規 | `app/narasu-agency/confirm/page.tsx` | 確認画面 |
| 新規 | `app/narasu-agency/complete/page.tsx` | 完了画面 |
| 新規 | `app/api/narasu-agency/submit/route.ts` | 本申請API（GASへPOST） |
| 修正 | `app/top/page.tsx` | appsリストに「代理申請フォーム」追加 |
| 修正 | `gas/Code.gs` | `narasu_agency_submit` アクション追加 |

---

## Task 1: 型・定数・バリデーション・ストレージ

**Files:**
- Create: `lib/narasu-agency/constants.ts`
- Create: `lib/narasu-agency/types.ts`
- Create: `lib/narasu-agency/validation.ts`
- Create: `lib/narasu-agency/storage.ts`

- [ ] **Step 1: constants.ts を作成する**

```ts
// lib/narasu-agency/constants.ts
export const NARASU_GATE_PASSWORD = "nagoya01@";
export const NARASU_TERMS_VERSION = "v0.1-draft";
export const NARASU_STORAGE_KEY = "lifai_narasu_agency_draft_v1";
export const NARASU_GATE_KEY = "lifai_narasu_gate_v1";
```

- [ ] **Step 2: types.ts を作成する**

```ts
// lib/narasu-agency/types.ts
export type NarasuAgencyStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "completed"
  | "rejected";

export type AudioUrlEntry = {
  id: string;
  url: string;
};

export type NarasuAgencyDraft = {
  narasuLoginId: string;
  narasuPassword: string;
  audioUrls: AudioUrlEntry[];
  lyricsText: string;
  jacketImageUrl: string;
  jacketNote: string;
  artistName: string;
  note: string;
  agreedTermsVersion: string;
  agreedAt: string;
};
```

- [ ] **Step 3: validation.ts を作成する**

```ts
// lib/narasu-agency/validation.ts
import type { NarasuAgencyDraft } from "./types";

function isValidUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

export type ValidationErrors = Partial<Record<keyof NarasuAgencyDraft | "audioUrls_items", string>>;

export function validateDraft(draft: NarasuAgencyDraft): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!draft.narasuLoginId.trim()) {
    errors.narasuLoginId = "narasuアカウントID（メールアドレス）を入力してください";
  }
  if (!draft.narasuPassword.trim()) {
    errors.narasuPassword = "narasuパスワードを入力してください";
  }

  const filledUrls = draft.audioUrls.filter((e) => e.url.trim());
  if (filledUrls.length === 0) {
    errors.audioUrls = "音源URLを1件以上入力してください";
  } else {
    const invalidUrl = filledUrls.find((e) => !isValidUrl(e.url.trim()));
    if (invalidUrl) {
      errors.audioUrls_items = "URL形式が正しくありません: " + invalidUrl.url;
    }
  }

  if (draft.jacketImageUrl.trim() && !isValidUrl(draft.jacketImageUrl.trim())) {
    errors.jacketImageUrl = "ジャケット画像URLの形式が正しくありません";
  }

  return errors;
}
```

- [ ] **Step 4: storage.ts を作成する**

```ts
// lib/narasu-agency/storage.ts
import { NARASU_STORAGE_KEY, NARASU_GATE_KEY } from "./constants";
import type { NarasuAgencyDraft } from "./types";

export function saveDraft(draft: NarasuAgencyDraft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NARASU_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): NarasuAgencyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NARASU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NARASU_STORAGE_KEY);
}

export function setGatePassed(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NARASU_GATE_KEY, "1");
}

export function isGatePassed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(NARASU_GATE_KEY) === "1";
}
```

- [ ] **Step 5: コミット**

```bash
git add lib/narasu-agency/
git commit -m "feat(narasu-agency): add types, constants, validation, storage"
```

---

## Task 2: パスワードゲート画面

**Files:**
- Create: `app/narasu-agency/page.tsx`

- [ ] **Step 1: パスワードゲートページを作成する**

```tsx
// app/narasu-agency/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NARASU_GATE_PASSWORD } from "@/lib/narasu-agency/constants";
import { setGatePassed } from "@/lib/narasu-agency/storage";

export default function NarasuGatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === NARASU_GATE_PASSWORD) {
      setGatePassed();
      router.push("/narasu-agency/terms");
    } else {
      setError("パスワードが違います");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">代理申請フォーム（テスト公開）</h1>
          <p className="mt-2 text-sm text-slate-600">現在は限定公開中です。パスワードを入力してください。</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="パスワードを入力"
                autoComplete="off"
              />
              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              確認する
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/narasu-agency/page.tsx
git commit -m "feat(narasu-agency): add password gate page"
```

---

## Task 3: 規約確認画面

**Files:**
- Create: `app/narasu-agency/terms/page.tsx`

- [ ] **Step 1: 規約確認ページを作成する**

```tsx
// app/narasu-agency/terms/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed } from "@/lib/narasu-agency/storage";
import { NARASU_TERMS_VERSION } from "@/lib/narasu-agency/constants";
import { saveDraft, loadDraft } from "@/lib/narasu-agency/storage";

const TERMS_TEXT = `
narasu代理申請サービス 確認事項（${NARASU_TERMS_VERSION}）

■ サービス概要
本フォームは、LIFAI運営がnarasuへの楽曲配信申請を代理で行うサービスです。

■ ご提供いただく情報
・narasuアカウントのログインIDおよびパスワード
・配信を希望する楽曲の音源URL
・その他、配信に必要な付帯情報

■ 情報の取り扱いについて
ご提供いただいたアカウント情報は、代理申請業務のみに使用します。
業務完了後は速やかに削除いたします。
第三者への提供は行いません。

■ 免責事項
・申請内容に誤りがあった場合の責任は申請者にあります。
・narasu側の審査結果についてLIFAI運営は保証しません。
・配信開始時期はnarasu側の都合により変動する場合があります。

■ 代行費用について
代行費用は別途ご案内します。申請完了後、運営よりご連絡いたします。

※本規約は法務レビュー前のドラフトです。正式版は後日更新されます。
`.trim();

export default function NarasuTermsPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isGatePassed()) {
      router.replace("/narasu-agency");
    }
  }, [router]);

  function handleAgree() {
    // 同意情報をdraftに保存
    const existing = loadDraft();
    const base = existing ?? {
      narasuLoginId: "",
      narasuPassword: "",
      audioUrls: [{ id: crypto.randomUUID(), url: "" }],
      lyricsText: "",
      jacketImageUrl: "",
      jacketNote: "",
      artistName: "",
      note: "",
      agreedTermsVersion: "",
      agreedAt: "",
    };
    saveDraft({
      ...base,
      agreedTermsVersion: NARASU_TERMS_VERSION,
      agreedAt: new Date().toISOString(),
    });
    router.push("/narasu-agency/form");
  }

  function handleDisagree() {
    router.push("/top");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">代理申請に関する確認事項</h1>
          <p className="mt-1 text-xs text-slate-400">お申し込み前に必ずご確認ください</p>

          <div className="mt-6 h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{TERMS_TEXT}</pre>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            <span className="text-sm text-slate-700">上記内容を確認し、同意します</span>
          </label>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleAgree}
              disabled={!agreed}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              同意する →
            </button>
            <button
              onClick={handleDisagree}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              同意しない（トップへ戻る）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/narasu-agency/terms/page.tsx
git commit -m "feat(narasu-agency): add terms agreement page"
```

---

## Task 4: 申請フォーム入力画面

**Files:**
- Create: `app/narasu-agency/form/page.tsx`

- [ ] **Step 1: フォームページを作成する**

```tsx
// app/narasu-agency/form/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, loadDraft, saveDraft } from "@/lib/narasu-agency/storage";
import { validateDraft, type ValidationErrors } from "@/lib/narasu-agency/validation";
import type { NarasuAgencyDraft, AudioUrlEntry } from "@/lib/narasu-agency/types";
import { NARASU_TERMS_VERSION } from "@/lib/narasu-agency/constants";

function newAudioEntry(): AudioUrlEntry {
  return { id: crypto.randomUUID(), url: "" };
}

function emptyDraft(): NarasuAgencyDraft {
  return {
    narasuLoginId: "",
    narasuPassword: "",
    audioUrls: [newAudioEntry()],
    lyricsText: "",
    jacketImageUrl: "",
    jacketNote: "",
    artistName: "",
    note: "",
    agreedTermsVersion: NARASU_TERMS_VERSION,
    agreedAt: new Date().toISOString(),
  };
}

export default function NarasuFormPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<NarasuAgencyDraft>(emptyDraft);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (!isGatePassed()) { router.replace("/narasu-agency"); return; }
    const saved = loadDraft();
    if (saved) setDraft(saved);
  }, [router]);

  function update(key: keyof NarasuAgencyDraft, value: unknown) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next);
      return next;
    });
  }

  function updateAudioUrl(id: string, url: string) {
    setDraft((prev) => {
      const next = { ...prev, audioUrls: prev.audioUrls.map((e) => e.id === id ? { ...e, url } : e) };
      saveDraft(next);
      return next;
    });
  }

  function addAudioUrl() {
    setDraft((prev) => {
      const next = { ...prev, audioUrls: [...prev.audioUrls, newAudioEntry()] };
      saveDraft(next);
      return next;
    });
  }

  function removeAudioUrl(id: string) {
    setDraft((prev) => {
      if (prev.audioUrls.length <= 1) return prev;
      const next = { ...prev, audioUrls: prev.audioUrls.filter((e) => e.id !== id) };
      saveDraft(next);
      return next;
    });
  }

  function handleNext() {
    const errs = validateDraft(draft);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    saveDraft(draft);
    router.push("/narasu-agency/confirm");
  }

  const inputCls = "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200";
  const labelCls = "block text-xs font-bold text-slate-700";
  const errorCls = "mt-1 text-xs text-rose-600";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">narasu代理申請フォーム</h1>
          <p className="mt-1 text-sm text-slate-600">必要事項を入力してください。音源URLは複数追加できます。</p>

          <div className="mt-6 space-y-5">
            {/* narasuアカウント情報 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500 mb-3">narasuアカウント情報（必須）</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>ログインID（メールアドレス）<span className="text-rose-500"> *</span></label>
                  <input
                    type="text"
                    value={draft.narasuLoginId}
                    onChange={(e) => update("narasuLoginId", e.target.value)}
                    className={inputCls}
                    placeholder="例: yourname@example.com"
                    autoComplete="off"
                  />
                  {errors.narasuLoginId && <p className={errorCls}>{errors.narasuLoginId}</p>}
                </div>
                <div>
                  <label className={labelCls}>パスワード<span className="text-rose-500"> *</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={draft.narasuPassword}
                      onChange={(e) => update("narasuPassword", e.target.value)}
                      className={inputCls + " pr-12"}
                      placeholder="narasuのパスワード"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? "隠す" : "表示"}
                    </button>
                  </div>
                  {errors.narasuPassword && <p className={errorCls}>{errors.narasuPassword}</p>}
                </div>
              </div>
            </div>

            {/* 音源URL */}
            <div>
              <label className={labelCls}>音源URL<span className="text-rose-500"> *</span></label>
              <p className="mt-0.5 text-[11px] text-slate-400">複数追加できます</p>
              <div className="mt-2 space-y-2">
                {draft.audioUrls.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-2 items-center">
                    <input
                      type="url"
                      value={entry.url}
                      onChange={(e) => updateAudioUrl(entry.id, e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder={`音源URL ${idx + 1}`}
                    />
                    {draft.audioUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAudioUrl(entry.id)}
                        className="flex-shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        －
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAudioUrl}
                  className="w-full rounded-2xl border border-dashed border-indigo-300 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  ＋ 音源URLを追加
                </button>
              </div>
              {errors.audioUrls && <p className={errorCls}>{errors.audioUrls}</p>}
              {errors.audioUrls_items && <p className={errorCls}>{errors.audioUrls_items}</p>}
            </div>

            {/* 歌詞 */}
            <div>
              <label className={labelCls}>歌詞データ <span className="text-slate-400 font-normal">（任意）</span></label>
              <textarea
                value={draft.lyricsText}
                onChange={(e) => update("lyricsText", e.target.value)}
                className={inputCls + " h-32 resize-none"}
                placeholder="歌詞がない場合は空欄のままで構いません"
              />
            </div>

            {/* ジャケット情報 */}
            <div className="space-y-3">
              <div>
                <label className={labelCls}>ジャケット画像URL <span className="text-slate-400 font-normal">（任意）</span></label>
                <input
                  type="url"
                  value={draft.jacketImageUrl}
                  onChange={(e) => update("jacketImageUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://..."
                />
                {errors.jacketImageUrl && <p className={errorCls}>{errors.jacketImageUrl}</p>}
              </div>
              <div>
                <label className={labelCls}>ジャケット補足メモ <span className="text-slate-400 font-normal">（任意）</span></label>
                <input
                  type="text"
                  value={draft.jacketNote}
                  onChange={(e) => update("jacketNote", e.target.value)}
                  className={inputCls}
                  placeholder="例: 白背景でシンプルなデザインにしてほしい"
                />
              </div>
            </div>

            {/* アーティスト名 */}
            <div>
              <label className={labelCls}>アーティスト名 <span className="text-slate-400 font-normal">（任意）</span></label>
              <input
                type="text"
                value={draft.artistName}
                onChange={(e) => update("artistName", e.target.value)}
                className={inputCls}
                placeholder="例: LIFAI Studio"
              />
            </div>

            {/* 補足事項 */}
            <div>
              <label className={labelCls}>補足事項 <span className="text-slate-400 font-normal">（任意）</span></label>
              <textarea
                value={draft.note}
                onChange={(e) => update("note", e.target.value)}
                className={inputCls + " h-24 resize-none"}
                placeholder="申請時の注意や希望があればご記入ください"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleNext}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              確認画面へ進む →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/narasu-agency/form/page.tsx
git commit -m "feat(narasu-agency): add form input page with dynamic audio URL fields"
```

---

## Task 5: 確認画面

**Files:**
- Create: `app/narasu-agency/confirm/page.tsx`

- [ ] **Step 1: 確認ページを作成する**

```tsx
// app/narasu-agency/confirm/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, loadDraft, clearDraft } from "@/lib/narasu-agency/storage";
import type { NarasuAgencyDraft } from "@/lib/narasu-agency/types";

export default function NarasuConfirmPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<NarasuAgencyDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isGatePassed()) { router.replace("/narasu-agency"); return; }
    const saved = loadDraft();
    if (!saved) { router.replace("/narasu-agency/form"); return; }
    setDraft(saved);
  }, [router]);

  async function handleSubmit() {
    if (!draft) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/narasu-agency/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "送信失敗");
      clearDraft();
      router.push("/narasu-agency/complete");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setSubmitting(false);
    }
  }

  if (!draft) return null;

  const filledUrls = draft.audioUrls.filter((e) => e.url.trim());

  const rowCls = "flex flex-col gap-0.5";
  const labelCls = "text-[10px] font-bold text-slate-400";
  const valueCls = "text-sm text-slate-800 break-all";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">入力内容の確認</h1>
          <p className="mt-1 text-sm text-slate-600">内容を確認してから「本申請へ進む」を押してください。</p>

          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className={rowCls}>
              <p className={labelCls}>narasuログインID</p>
              <p className={valueCls}>{draft.narasuLoginId}</p>
            </div>
            <div className={rowCls}>
              <p className={labelCls}>narasuパスワード</p>
              <p className={valueCls}>{"*".repeat(8)}</p>
            </div>
            <div className={rowCls}>
              <p className={labelCls}>音源URL（{filledUrls.length}件）</p>
              {filledUrls.map((e, i) => (
                <p key={e.id} className={valueCls}>{i + 1}. {e.url}</p>
              ))}
            </div>
            {draft.lyricsText && (
              <div className={rowCls}>
                <p className={labelCls}>歌詞データ</p>
                <p className={valueCls + " whitespace-pre-wrap text-xs"}>{draft.lyricsText}</p>
              </div>
            )}
            {draft.jacketImageUrl && (
              <div className={rowCls}>
                <p className={labelCls}>ジャケット画像URL</p>
                <p className={valueCls}>{draft.jacketImageUrl}</p>
              </div>
            )}
            {draft.jacketNote && (
              <div className={rowCls}>
                <p className={labelCls}>ジャケット補足メモ</p>
                <p className={valueCls}>{draft.jacketNote}</p>
              </div>
            )}
            {draft.artistName && (
              <div className={rowCls}>
                <p className={labelCls}>アーティスト名</p>
                <p className={valueCls}>{draft.artistName}</p>
              </div>
            )}
            {draft.note && (
              <div className={rowCls}>
                <p className={labelCls}>補足事項</p>
                <p className={valueCls}>{draft.note}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "送信中…" : "本申請へ進む →"}
            </button>
            <button
              onClick={() => router.push("/narasu-agency/form")}
              disabled={submitting}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              修正する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/narasu-agency/confirm/page.tsx
git commit -m "feat(narasu-agency): add confirmation page"
```

---

## Task 6: API route + GAS アクション

**Files:**
- Create: `app/api/narasu-agency/submit/route.ts`
- Modify: `gas/Code.gs`

- [ ] **Step 1: Next.js API route を作成する**

```ts
// app/api/narasu-agency/submit/route.ts
import { NextResponse } from "next/server";

async function callGas(gasUrl: string, gasKey: string, payload: object) {
  const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: "bad_gas_json" }; }
}

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const {
      narasuLoginId,
      narasuPassword,
      audioUrls,
      lyricsText,
      jacketImageUrl,
      jacketNote,
      artistName,
      note,
      agreedTermsVersion,
      agreedAt,
    } = body ?? {};

    if (!narasuLoginId || !narasuPassword) {
      return NextResponse.json({ ok: false, error: "missing_account_info" }, { status: 400 });
    }
    const filledUrls: string[] = (audioUrls ?? [])
      .filter((e: { url: string }) => e.url?.trim())
      .map((e: { url: string }) => e.url.trim());
    if (filledUrls.length === 0) {
      return NextResponse.json({ ok: false, error: "missing_audio_urls" }, { status: 400 });
    }

    const gas = await callGas(gasUrl, gasKey, {
      action: "narasu_agency_submit",
      narasu_login_id: narasuLoginId,
      narasu_password: narasuPassword,
      audio_urls: filledUrls.join("\n"),
      lyrics_text: lyricsText ?? "",
      jacket_image_url: jacketImageUrl ?? "",
      jacket_note: jacketNote ?? "",
      artist_name: artistName ?? "",
      note: note ?? "",
      agreed_terms_version: agreedTermsVersion ?? "",
      agreed_at: agreedAt ?? "",
    });

    return NextResponse.json(gas, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: GAS に `narasu_agency_submit` アクションを追加する**

`gas/Code.gs` のアクション分岐部分（他の `if (action === "...")` ブロックが並んでいる箇所）の末尾近くに以下を追加する。追加位置は `return json_({ ok: false, error: "unknown_action" });` の直前。

```js
  // =========================================================
  // narasu代理申請 submit
  // =========================================================
  if (action === "narasu_agency_submit") {
    try {
      var narasuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("narasu_agency");
      if (!narasuSheet) {
        narasuSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("narasu_agency");
        narasuSheet.appendRow([
          "request_id", "created_at", "status",
          "narasu_login_id", "narasu_password",
          "audio_urls", "lyrics_text",
          "jacket_image_url", "jacket_note",
          "artist_name", "note",
          "agreed_terms_version", "agreed_at",
          "admin_memo"
        ]);
      }
      var requestId = "NA-" + Date.now();
      var now = new Date().toISOString();
      narasuSheet.appendRow([
        requestId,
        now,
        "submitted",
        str_(body.narasu_login_id),
        str_(body.narasu_password),
        str_(body.audio_urls),
        str_(body.lyrics_text),
        str_(body.jacket_image_url),
        str_(body.jacket_note),
        str_(body.artist_name),
        str_(body.note),
        str_(body.agreed_terms_version),
        str_(body.agreed_at),
        ""
      ]);
      Logger.log("[narasu_agency_submit] saved: " + requestId);
      return json_({ ok: true, requestId: requestId });
    } catch (e) {
      Logger.log("[narasu_agency_submit] error: " + String(e));
      return json_({ ok: false, error: String(e) });
    }
  }
```

- [ ] **Step 3: コミット**

```bash
git add app/api/narasu-agency/submit/route.ts gas/Code.gs
git commit -m "feat(narasu-agency): add submit API route and GAS action"
```

---

## Task 7: 完了画面

**Files:**
- Create: `app/narasu-agency/complete/page.tsx`

- [ ] **Step 1: 完了ページを作成する**

```tsx
// app/narasu-agency/complete/page.tsx
"use client";

import Link from "next/link";

export default function NarasuCompletePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-extrabold text-slate-900">受付完了</h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            代理申請の受付が完了しました。<br />
            内容確認後、順次対応いたします。
          </p>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              代行費用については、運営より別途LINEにてご連絡いたします。<br />
              お問い合わせは公式LINEまでお気軽にどうぞ。
            </p>
            <a
              href="https://lin.ee/VPo2xOn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-600"
            >
              公式LINEで問い合わせ
            </a>
          </div>
          <Link
            href="/top"
            className="mt-4 block text-xs text-slate-400 hover:text-slate-600"
          >
            ← トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/narasu-agency/complete/page.tsx
git commit -m "feat(narasu-agency): add complete page"
```

---

## Task 8: トップページにボタンを追加

**Files:**
- Modify: `app/top/page.tsx:491-506`（apps 配列）

- [ ] **Step 1: apps 配列に代理申請フォームを追加する**

`app/top/page.tsx` の `apps` 配列（`gift` エントリーの直後）に以下を追加する：

```ts
{ id: "narasu-agency", label: "代理申請フォーム", icon: "📋", color: "from-teal-500 to-cyan-600", href: "/narasu-agency", desc: "narasu楽曲配信の代理申請サービス", badge: "New" },
```

追加後の `apps` 末尾はこうなる：

```ts
      { id: "gift",           label: "GiftEP",         icon: "🎁", color: "from-emerald-400 to-teal-500",  href: "/gift",           desc: "EP贈与 · LIFAI内限定ギフトクレジット" },
      { id: "narasu-agency",  label: "代理申請フォーム", icon: "📋", color: "from-teal-500 to-cyan-600",    href: "/narasu-agency",  desc: "narasu楽曲配信の代理申請サービス", badge: "New" },
```

- [ ] **Step 2: コミット**

```bash
git add app/top/page.tsx
git commit -m "feat(top): add narasu-agency button to app list"
```

---

## Task 9: 動作確認

- [ ] **Step 1: 開発サーバーを起動して動作確認**

```bash
npm run dev
```

確認項目：
1. `/top` → 「代理申請フォーム」ボタンが表示される
2. `/narasu-agency` → パスワードゲート画面が表示される
3. `nagoya01@` を入力 → `/narasu-agency/terms` へ遷移
4. チェックボックスON → 「同意する」ボタンが押せる
5. 同意 → `/narasu-agency/form` へ遷移
6. フォームに必要事項を入力 → 「確認画面へ進む」
7. `/narasu-agency/confirm` → 入力内容が表示される（パスワードは `********`）
8. 「本申請へ進む」 → GASへPOST → `/narasu-agency/complete` へ遷移
9. 完了画面が表示される

- [ ] **Step 2: ページ直接アクセス時のガード確認**

`/narasu-agency/form` に直接アクセス → `/narasu-agency`（ゲート）にリダイレクトされることを確認

- [ ] **Step 3: 最終コミット & プッシュ**

```bash
git push
```
