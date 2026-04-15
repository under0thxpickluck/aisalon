# BGM生成機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** music2ページにReplicateを使ったBGM生成タブを追加する（準備中・非クリック状態でリリース）

**Architecture:** 既存の`app/music2/page.tsx`のヘッダー直下に静的タブUIを追加（状態管理不要）。BGM生成APIは`app/api/bgm/generate`と`app/api/bgm/status`に分離し、旧`/api/music`のReplicate呼び出しロジックを流用する。

**Tech Stack:** Next.js 14 App Router, Replicate API (minimax music-01, version `671ac645...`), TypeScript, Tailwind CSS

---

## File Structure

```
app/
  music2/
    page.tsx                    ← MODIFY: ヘッダー直下にタブUI追加（約12行）
  api/
    bgm/
      generate/
        route.ts                ← CREATE: BGMプロンプト構築 + Replicate呼び出し
      status/
        route.ts                ← CREATE: Replicate単一予測ポーリング
```

---

### Task 1: BGM generateルート実装

**Files:**
- Create: `app/api/bgm/generate/route.ts`
- Test: `__tests__/bgmGenerateRoute.test.ts`

#### コンテキスト

既存の`app/api/music/generate/route.ts`の`createMinimaxPrediction`関数（163〜215行目）をそのまま流用する。違いはプロンプトに必ず`instrumental only, no vocals`を付けること。歌詞生成は不要。

Replicateモデル情報：
- version: `671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb`
- 環境変数: `REPLICATE_API_TOKEN`（既存）

---

- [ ] **Step 1: テストファイルを作成して失敗させる**

`__tests__/bgmGenerateRoute.test.ts` を作成：

```typescript
import { POST } from '@/app/api/bgm/generate/route'
import { NextRequest } from 'next/server'

// fetch をモック
global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.REPLICATE_API_TOKEN = 'test-token'
})

afterEach(() => {
  delete process.env.REPLICATE_API_TOKEN
})

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/bgm/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

test('REPLICATE_API_TOKEN未設定なら500', async () => {
  delete process.env.REPLICATE_API_TOKEN
  const res = await POST(makeRequest({ theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(500)
  const json = await res.json()
  expect(json.ok).toBe(false)
})

test('正常: predictionId を返す', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'pred-abc123', status: 'starting' }),
  })
  const res = await POST(makeRequest({ theme: '朝の森', genre: 'クラシック', mood: '落ち着いた', duration: 60 }))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.predictionId).toBe('pred-abc123')
})

test('Replicate APIエラーなら502', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 422,
    json: async () => ({ detail: 'invalid input' }),
  })
  const res = await POST(makeRequest({ theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(502)
  const json = await res.json()
  expect(json.ok).toBe(false)
})

test('プロンプトにinstrumental onlyが含まれる', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'pred-xyz', status: 'starting' }),
  })
  await POST(makeRequest({ theme: 'カフェ', genre: 'ジャズ', mood: 'クール', duration: 30, bpm: 90 }))
  const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
  expect(callBody.input.prompt).toContain('instrumental only')
  expect(callBody.input.prompt).toContain('no vocals')
})
```

- [ ] **Step 2: テストを実行して失敗することを確認**

```bash
cd C:/Users/unitu/aisalon
npx jest __tests__/bgmGenerateRoute.test.ts --no-coverage
```

Expected: `Cannot find module '@/app/api/bgm/generate/route'`

- [ ] **Step 3: `app/api/bgm/generate/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPLICATE_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MOOD_MAP: Record<string, string> = {
  さわやか: "refreshing, bright, uplifting",
  落ち着いた: "calm, composed, serene",
  激しい: "energetic, intense, driving",
  エモい: "emotional, touching, heartfelt",
  明るい: "bright, cheerful, positive",
  ロマンチック: "romantic, tender, loving",
  切ない: "bittersweet, nostalgic, longing",
  クール: "cool, stylish, sophisticated",
};

const GENRE_MAP: Record<string, string> = {
  ポップ: "pop",
  ロック: "rock",
  ジャズ: "jazz",
  クラシック: "classical, orchestral",
  EDM: "electronic dance music",
  ヒップホップ: "hip hop",
  "R&B": "R&B, soul",
  アニメ: "anime soundtrack",
  ローファイ: "lo-fi, chill",
  シネマティック: "cinematic, film score",
};

function buildBgmPrompt(params: {
  theme: string;
  genre: string;
  mood: string;
  bpm?: number;
}): string {
  const parts: string[] = [];
  if (params.genre) parts.push(GENRE_MAP[params.genre] ?? params.genre);
  if (params.mood)  parts.push(MOOD_MAP[params.mood] ?? params.mood);
  if (params.theme) parts.push(params.theme);
  if (params.bpm)   parts.push(`${params.bpm} BPM`);
  parts.push("instrumental only, no vocals, no singing, background music, BGM");
  parts.push("high quality, studio quality, clear mix");
  return parts.filter(Boolean).join(", ");
}

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "REPLICATE_API_TOKEN is missing" }, { status: 500 });
  }

  const body = await req.json() as {
    theme: string;
    genre: string;
    mood: string;
    duration?: number;
    bpm?: number;
  };

  const prompt = buildBgmPrompt({
    theme: body.theme ?? "",
    genre: body.genre ?? "",
    mood: body.mood ?? "",
    bpm: body.bpm,
  });

  const duration = Math.min(Math.max(Number(body.duration ?? 30), 30), 180);

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: REPLICATE_VERSION,
      input: {
        prompt,
        model_version: "stereo-large",
        duration,
        output_format: "mp3",
        normalization_strategy: "peak",
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[bgm/generate] Replicate error:", { status: res.status, body: JSON.stringify(data) });
    return NextResponse.json(
      { ok: false, error: data?.detail ?? data?.error ?? "replicate_error" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, predictionId: String(data.id) });
}
```

- [ ] **Step 4: テストを実行してパスすることを確認**

```bash
npx jest __tests__/bgmGenerateRoute.test.ts --no-coverage
```

Expected: `4 passed`

- [ ] **Step 5: コミット**

```bash
git add app/api/bgm/generate/route.ts __tests__/bgmGenerateRoute.test.ts
git commit -m "feat: add /api/bgm/generate route with Replicate minimax"
```

---

### Task 2: BGM statusルート実装

**Files:**
- Create: `app/api/bgm/status/route.ts`
- Test: `__tests__/bgmStatusRoute.test.ts`

#### コンテキスト

既存の`app/api/music/status/route.ts`の135〜184行目（単一予測ポーリング部分）を流用する。マルチセクションジョブやマージサーバーの処理は不要。

---

- [ ] **Step 1: テストファイルを作成して失敗させる**

`__tests__/bgmStatusRoute.test.ts` を作成：

```typescript
import { GET } from '@/app/api/bgm/status/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.REPLICATE_API_TOKEN = 'test-token'
})

afterEach(() => {
  delete process.env.REPLICATE_API_TOKEN
})

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/bgm/status?id=${id}`)
}

test('REPLICATE_API_TOKEN未設定なら500', async () => {
  delete process.env.REPLICATE_API_TOKEN
  const res = await GET(makeRequest('pred-abc'))
  expect(res.status).toBe(500)
})

test('id未指定なら400', async () => {
  const res = await GET(new NextRequest('http://localhost/api/bgm/status'))
  expect(res.status).toBe(400)
})

test('processing中はstatus:processingを返す', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: 'processing', output: null }),
  })
  const res = await GET(makeRequest('pred-abc'))
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.status).toBe('processing')
})

test('succeeded時はaudioUrlを返す', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: 'succeeded', output: 'https://example.com/audio.mp3' }),
  })
  const res = await GET(makeRequest('pred-abc'))
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.status).toBe('succeeded')
  expect(json.audioUrl).toBe('https://example.com/audio.mp3')
})

test('failed時はstatus:failedを返す', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: 'failed', output: null }),
  })
  const res = await GET(makeRequest('pred-abc'))
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.status).toBe('failed')
})
```

- [ ] **Step 2: テストを実行して失敗することを確認**

```bash
npx jest __tests__/bgmStatusRoute.test.ts --no-coverage
```

Expected: `Cannot find module '@/app/api/bgm/status/route'`

- [ ] **Step 3: `app/api/bgm/status/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "REPLICATE_API_TOKEN is missing" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data?.detail ?? "replicate_error" }, { status: 502 });
    }

    const status: string = data.status;

    if (status === "succeeded") {
      const raw = data.output;
      const audioUrl: string =
        typeof raw === "string" ? raw :
        Array.isArray(raw) && raw[0] ? String(raw[0]) : "";
      return NextResponse.json({ ok: true, status: "succeeded", audioUrl });
    }

    if (status === "failed" || status === "canceled") {
      return NextResponse.json({ ok: true, status: "failed" });
    }

    // starting / processing
    return NextResponse.json({ ok: true, status: "processing" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 502 });
  }
}
```

- [ ] **Step 4: テストを実行してパスすることを確認**

```bash
npx jest __tests__/bgmStatusRoute.test.ts --no-coverage
```

Expected: `5 passed`

- [ ] **Step 5: コミット**

```bash
git add app/api/bgm/status/route.ts __tests__/bgmStatusRoute.test.ts
git commit -m "feat: add /api/bgm/status route for Replicate polling"
```

---

### Task 3: music2ページにタブUIを追加

**Files:**
- Modify: `app/music2/page.tsx`

#### コンテキスト

`app/music2/page.tsx` の約670行目に以下の構造がある：

```tsx
          </div>  {/* ヘッダー div "flex items-center gap-3" の閉じタグ */}

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
```

この2要素の間にタブUIを挿入する。BGMタブは`pointer-events-none opacity-50`で完全に非クリック。stateの追加は不要。

---

- [ ] **Step 1: 挿入箇所を確認する**

```bash
grep -n "音楽生成 NEW" C:/Users/unitu/aisalon/app/music2/page.tsx
grep -n "mt-6 text-xl font-extrabold" C:/Users/unitu/aisalon/app/music2/page.tsx
```

Expected: どちらも行番号が返ってくる。`mt-6 text-xl`の行がタブ挿入位置の直後。

- [ ] **Step 2: タブUIを挿入する**

`app/music2/page.tsx` を編集。以下の文字列：

```tsx
          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
```

を以下に置換（h1はそのまま残す、タブを前に追加）：

```tsx
          {/* ── モード切替タブ ─────────────────────────────────────── */}
          <div className="mt-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <div className="flex-1 rounded-lg bg-white px-4 py-2 text-center text-xs font-bold text-slate-800 shadow-sm">
              ボーカル曲
            </div>
            <div className="relative flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-center text-xs font-bold text-slate-400 opacity-50 pointer-events-none select-none">
              BGM
              <span className="rounded-full bg-slate-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 leading-none">
                準備中
              </span>
            </div>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
```

- [ ] **Step 3: ビルドエラーがないことを確認**

```bash
cd C:/Users/unitu/aisalon
npx tsc --noEmit
```

Expected: エラーなし（型チェック通過）

- [ ] **Step 4: コミット**

```bash
git add app/music2/page.tsx
git commit -m "feat: add BGM tab to music2 page (disabled, 準備中)"
```

---

### Task 4: 動作確認とプッシュ

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テストを実行**

```bash
cd C:/Users/unitu/aisalon
npx jest --no-coverage 2>&1 | tail -20
```

Expected: 新規2スイート含め全テストがパス。失敗があれば修正してから次へ。

- [ ] **Step 2: ビルドを確認**

```bash
npx next build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` / エラーなし

- [ ] **Step 3: プッシュ**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ music2ページにタブ追加 → Task 3
- ✅ BGMタブは非クリック（pointer-events-none） → Task 3
- ✅ Replicateを使ったBGM generate API → Task 1
- ✅ ポーリング用status API → Task 2
- ✅ instrumental強制 → Task 1の`buildBgmPrompt`
- ✅ 既存ページ構造を壊さない → タブUIのみ追加、state変更なし

**Placeholder scan:** なし ✅

**Type consistency:**
- `predictionId` (generate response) ↔ `id` (status query param) → 異なる変数名だが意味的に一致 ✅
- `audioUrl` (status response) → Task 2で定義済み ✅
