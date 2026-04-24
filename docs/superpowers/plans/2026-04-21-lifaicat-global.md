# LifaiCat グローバル表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全ページの右下にりふぁねこ相談ボットを表示し、loginId を正しく渡す

**Architecture:** `LifaiCatGlobal` という薄いクライアントコンポーネントを新たに作り、localStorage から auth を読んで `<LifaiCat loginId={id} />` を描画する。これを `layout.tsx` に追加することで全ページをカバーする。`top/page.tsx` では `<LifaiCat>` の描画のみ削除し、`useLifaiCat()` と他のロジックは一切変更しない。

**Tech Stack:** Next.js 14 App Router, React, TypeScript, localStorage (`addval_auth_v1` キー)

---

## ファイル構成

| 操作 | ファイル | 変更内容 |
|------|----------|----------|
| 新規作成 | `components/LifaiCatGlobal.tsx` | auth読み取り＋ `<LifaiCat>` 描画のラッパー |
| 修正 | `app/layout.tsx` | `<LifaiCatGlobal />` を追加 |
| 修正 | `app/top/page.tsx` | `<LifaiCat>` の描画と import 削除（useLifaiCat等は保持） |

---

## Task 1: `LifaiCatGlobal` コンポーネントを作成する

**Files:**
- Create: `components/LifaiCatGlobal.tsx`

- [ ] **Step 1: ファイルを新規作成する**

`components/LifaiCatGlobal.tsx` を以下の内容で作成する:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getAuth } from '@/app/lib/auth';
import LifaiCat from '@/components/LifaiCat';

export default function LifaiCatGlobal() {
  const [loginId, setLoginId] = useState<string>('');

  useEffect(() => {
    const auth = getAuth();
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      '';
    setLoginId(id);
  }, []);

  return <LifaiCat loginId={loginId} />;
}
```

**ポイント:**
- `useEffect` 内で読むことで SSR エラーを防ぐ（`getAuth` は `window` 依存）
- `loginId` が空文字のままでも `<LifaiCat>` は正常動作する（未ログイン扱い）
- `'use client'` 必須

- [ ] **Step 2: TypeScript エラーがないことを確認**

```bash
npx tsc --noEmit
```

エラーなしで完了すること。

- [ ] **Step 3: コミット**

```bash
git add components/LifaiCatGlobal.tsx
git commit -m "feat(lifaicat): LifaiCatGlobal コンポーネント追加"
```

---

## Task 2: `layout.tsx` に `<LifaiCatGlobal />` を追加する

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: import を追加する**

`app/layout.tsx` の既存 import 群の末尾に追加:

```tsx
import LifaiCatGlobal from "@/components/LifaiCatGlobal";
```

- [ ] **Step 2: `<LifaiCatGlobal />` を `<LifaiCatProvider>` 内に追加する**

変更前:
```tsx
<LifaiCatProvider>
  <ToastHost />
  {children}
</LifaiCatProvider>
```

変更後:
```tsx
<LifaiCatProvider>
  <ToastHost />
  {children}
  <LifaiCatGlobal />
</LifaiCatProvider>
```

**ポイント:**
- `{children}` の後に置くことで、ページコンテンツより前面に描画される
- `LifaiCatProvider` の内側に置く必要がある（`useLifaiCat` を内部で使用するため）

- [ ] **Step 3: TypeScript エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで以下を確認:
- `/top` → 右下にりふぁねこが**2個重なっていない**こと（まだ top から削除していないので2個になる）
- `/music` or `/rumble` → 右下にりふぁねこが**1個表示される**こと

- [ ] **Step 5: コミット**

```bash
git add app/layout.tsx
git commit -m "feat(lifaicat): layout に LifaiCatGlobal を追加し全ページ表示"
```

---

## Task 3: `top/page.tsx` から `<LifaiCat>` の描画を削除する

**Files:**
- Modify: `app/top/page.tsx`

- [ ] **Step 1: `<LifaiCat>` の描画部分を削除する**

`app/top/page.tsx` の末尾付近（728〜731行目）の以下を削除:

```tsx
    <LifaiCat
      loginId={loginId}
      currentPage="top"
    />
```

削除後の周辺コードは以下になる:

```tsx
        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
    </>  {/* ← これは残す */}
  );
}
```

- [ ] **Step 2: `LifaiCat` のデフォルト export の import を削除する**

`app/top/page.tsx` の以下の行を削除:

```tsx
import LifaiCat from "@/components/LifaiCat";
```

**注意:** `useLifaiCat` の import は別行にあるので残すこと:

```tsx
import { useLifaiCat } from "@/components/LifaiCat";  // ← これは残す
```

- [ ] **Step 3: TypeScript エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 開発サーバーで最終動作確認**

```bash
npm run dev
```

ブラウザで以下を全て確認:

| ページ | 確認内容 |
|--------|----------|
| `/top` | りふぁねこが右下に **1個だけ** 表示される |
| `/music` | りふぁねこが右下に表示される |
| `/rumble` | りふぁねこが右下に表示される |
| `/market` | りふぁねこが右下に表示される |
| ログイン後 | クリックするとパネルが開き、チャット機能が動作する |
| 未ログイン | アイコンは表示され、チャットも動作する（loginIdは空） |

- [ ] **Step 5: コミット**

```bash
git add app/top/page.tsx
git commit -m "feat(lifaicat): top から個別 LifaiCat 描画を削除（layout 側で統合）"
```

---

## 注意事項・壊さないためのポイント

- `top/page.tsx` の `useLifaiCat()` (`trackEvent`) は**削除しない**
- `top/page.tsx` の `loginId` 変数は他のコンポーネント（GachaModal, StakingModal, MissionCard, RadioCard）に渡しているため**削除しない**
- market系3ページは `useLifaiCat()` のみ使用で `<LifaiCat>` 描画なし → 変更不要
- `LifaiCatProvider` は layout にすでにあるので追加不要
