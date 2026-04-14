# music2 Pro設定強化 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** music2のPro設定セクションに楽器・曲の長さを追加し、ダーク＋パープルグローUIに刷新。Pro設定使用時は250BP、未使用時は100BPを課金する。

**Architecture:** bp-config.tsにコスト定数を追加 → APIルートで使用有無を判定してBP分岐 → フロントエンドでUI刷新・リアルタイムBP表示・新パラメータ送信の順で実装する。

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `app/lib/bp-config.ts` のコスト定数パターン

---

### Task 1: bp-config.ts に `music_full_pro` を追加

**Files:**
- Modify: `app/lib/bp-config.ts`

- [ ] **Step 1: `music_full_pro: 250` を追加**

`app/lib/bp-config.ts` の `BP_COSTS` オブジェクトに以下を追加：

```ts
music_full_pro: 250,  // Pro設定使用時のフル生成
```

`music_full: 100` の直後に追加する。

- [ ] **Step 2: ビルドエラーがないか確認**

```bash
npm run build 2>&1 | head -30
```

Expected: エラーなし（型 `BpCostKey` は `keyof typeof BP_COSTS` で自動更新される）

- [ ] **Step 3: コミット**

```bash
git add app/lib/bp-config.ts
git commit -m "feat: add music_full_pro BP cost (250BP)"
```

---

### Task 2: `/api/song/start` でPro設定使用判定とBP分岐

**Files:**
- Modify: `app/api/song/start/route.ts`

- [ ] **Step 1: リクエストから `instruments` と `duration` を受け取る**

`route.ts` 内でbodyをパースしている箇所（`bpmHint`, `vocalStyle`, `vocalMood` を読んでいる周辺）を確認し、以下を追加：

```ts
const instruments = Array.isArray(body.instruments) ? (body.instruments as string[]) : [];
const duration    = body.duration ? Number(body.duration) : undefined;
```

- [ ] **Step 2: Pro設定使用判定とBPコスト分岐を追加**

`BP_COSTS.music_full` を参照しているコードの直前に判定を追加：

```ts
// Pro設定が1つでも使われているか判定
const isProSettingsUsed = !!(
  body.bpmHint ||
  body.vocalStyle ||
  body.vocalMood ||
  instruments.length > 0 ||
  duration
);
const bpCost = isProSettingsUsed ? BP_COSTS.music_full_pro : BP_COSTS.music_full;
```

- [ ] **Step 3: BP残高チェックと消費箇所を `bpCost` 変数に差し替え**

`BP_COSTS.music_full` を直接参照している箇所を `bpCost` に置き換え：

```ts
// 残高チェック
if (bp < bpCost) {
  return NextResponse.json({ ok: false, error: "insufficient_bp", bp }, { status: 400 });
}

// BP消費（deduct_bp アクション呼び出し箇所）
body: JSON.stringify({
  action:   "deduct_bp",
  adminKey: gasAdminKey,
  loginId:  String(id),
  amount:   bpCost,
}),
```

- [ ] **Step 4: `createJob` 呼び出しに `instruments` と `duration` を渡す**

`createJob` を呼んでいる箇所のメタデータに追加：

```ts
instruments: instruments.length > 0 ? instruments : undefined,
duration:    duration ?? undefined,
```

- [ ] **Step 5: コミット**

```bash
git add app/api/song/start/route.ts
git commit -m "feat: charge 250BP when pro settings used in song start"
```

---

### Task 3: `music2/page.tsx` — 定数・state・送信パラメータ追加

**Files:**
- Modify: `app/music2/page.tsx`

- [ ] **Step 1: 定数を追加**

ファイル冒頭の定数群（`GENRES`, `MOODS`, `BPM_OPTIONS` などが並んでいる箇所）に追記：

```ts
const INSTRUMENTS = [
  { label: "🎹 ピアノ",      value: "ピアノ" },
  { label: "🎸 ギター",      value: "ギター" },
  { label: "🎻 ストリングス", value: "ストリングス" },
  { label: "🎺 ブラス",      value: "ブラス" },
  { label: "🎷 サックス",    value: "サックス" },
];

const DURATION_OPTIONS = [
  { label: "30秒", value: 30 },
  { label: "1分",  value: 60 },
  { label: "2分",  value: 120 },
  { label: "3分",  value: 180 },
];
```

- [ ] **Step 2: state を追加**

`bpmHint`, `vocalStyle`, `vocalMood` の state宣言の近くに追記：

```ts
const [instruments, setInstruments] = useState<string[]>([]);
const [duration,    setDuration]    = useState<number | null>(null);
```

- [ ] **Step 3: `isProSettingsActive` 算出を追加**

`isPro` の定義の下に追記：

```ts
const isProSettingsActive =
  isPro && (!!bpmHint || !!vocalStyle || !!vocalMood || instruments.length > 0 || !!duration);
```

- [ ] **Step 4: `handleFullReset` にクリアを追加**

`handleFullReset` 関数内の `setBpmHint(null)` / `setVocalStyle("")` の近くに追記：

```ts
setInstruments([]);
setDuration(null);
```

- [ ] **Step 5: `handleStart` 送信bodyに追加**

`fetch("/api/song/start", ...)` のbody内に追加：

```ts
instruments: isPro && instruments.length > 0 ? instruments : undefined,
duration:    isPro && duration               ? duration    : undefined,
```

- [ ] **Step 6: コミット**

```bash
git add app/music2/page.tsx
git commit -m "feat: add instruments/duration state and send to song start API"
```

---

### Task 4: `music2/page.tsx` — ProセクションUI刷新

**Files:**
- Modify: `app/music2/page.tsx`

- [ ] **Step 1: チップスタイル変数を定義**

Proセクションのブロック内（`{isPro && (` の直後あたり）にスタイル定数を追加：

```ts
const proChipBase     = "rounded-full border px-3 py-1 text-xs font-semibold transition";
const proChipActive   = "border-violet-500 bg-violet-600 text-white";
const proChipInactive = "border-[#3730a3] bg-[#1e1b4b] text-indigo-300 hover:border-violet-500 hover:text-violet-300";
```

- [ ] **Step 2: Proセクションの外ラッパーをダークデザインに変更**

現在の `{isPro && (...)}` ブロック内の最外 `<div>` を変更：

```tsx
{isPro && (
  <div className="mt-5 rounded-[18px] border border-violet-500/30 bg-[#0d0d1a] p-4 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
    {/* ヘッダー */}
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm">🎛️</span>
      <span className="text-[11px] font-black text-violet-400 tracking-widest">PRO SETTINGS</span>
      <span className="ml-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 px-2.5 py-0.5 text-[9px] font-bold text-white">
        PRO
      </span>
    </div>
```

- [ ] **Step 3: 既存3項目（BPM・ボーカルスタイル・ボーカルムード）のチップを新スタイルに差し替え**

各項目のラベル色を `text-violet-400` に、チップを `proChipBase + (選択中 ? proChipActive : proChipInactive)` に変更。

BPMの例：
```tsx
<div className="mb-4">
  <label className="block text-[11px] font-bold text-violet-400 mb-1.5">BPM目安</label>
  <div className="flex flex-wrap gap-1.5">
    {BPM_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        disabled={loading}
        onClick={() => setBpmHint(bpmHint === opt.value ? null : opt.value)}
        className={[proChipBase, bpmHint === opt.value ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

ボーカルスタイル・ボーカルムードも同様のパターンで差し替え。

- [ ] **Step 4: 楽器セクションを追加**

ボーカルムードの下に追加：

```tsx
{/* 楽器（NEW） */}
<div className="mb-4">
  <div className="flex items-center gap-2 mb-1.5">
    <label className="text-[11px] font-bold text-violet-400">楽器</label>
    <span className="rounded bg-[#312e81] px-1.5 py-0.5 text-[8px] font-bold text-[#a5b4fc]">NEW</span>
    <span className="text-[10px] text-violet-400/50">複数選択可</span>
  </div>
  <div className="flex flex-wrap gap-1.5">
    {INSTRUMENTS.map((inst) => (
      <button
        key={inst.value}
        type="button"
        disabled={loading}
        onClick={() =>
          setInstruments((prev) =>
            prev.includes(inst.value)
              ? prev.filter((i) => i !== inst.value)
              : [...prev, inst.value]
          )
        }
        className={[proChipBase, instruments.includes(inst.value) ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
      >
        {inst.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 5: 曲の長さセクションを追加**

楽器セクションの下に追加：

```tsx
{/* 曲の長さ（NEW） */}
<div>
  <div className="flex items-center gap-2 mb-1.5">
    <label className="text-[11px] font-bold text-violet-400">曲の長さ</label>
    <span className="rounded bg-[#312e81] px-1.5 py-0.5 text-[8px] font-bold text-[#a5b4fc]">NEW</span>
  </div>
  <div className="flex flex-wrap gap-1.5">
    {DURATION_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        disabled={loading}
        onClick={() => setDuration(duration === opt.value ? null : opt.value)}
        className={[proChipBase, duration === opt.value ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 6: コミット**

```bash
git add app/music2/page.tsx
git commit -m "feat: redesign Pro section with dark theme, add instruments/duration UI"
```

---

### Task 5: BP表示のリアルタイム更新

**Files:**
- Modify: `app/music2/page.tsx`

- [ ] **Step 1: BP表示欄を `isProSettingsActive` で切り替え**

現在のBP表示欄（`必要BP` / `100 BP` バッジが並んでいる `<div>`）を変更：

```tsx
<div className="mt-5 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
  <span className="text-xs font-bold text-indigo-700">必要BP</span>
  <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
    {isProSettingsActive ? "250 BP" : "100 BP"}
  </span>
  {isPro ? (
    isProSettingsActive ? (
      <span className="ml-auto text-[11px] text-violet-600 font-semibold">🎛️ Pro設定使用中（250BP）</span>
    ) : (
      <span className="ml-auto text-[11px] text-violet-500">Pro設定を使うと250BP</span>
    )
  ) : (
    <span className="ml-auto text-[11px] text-indigo-500">構成生成→音楽生成の2ステップ</span>
  )}
</div>
```

- [ ] **Step 2: insufficient_bp エラーメッセージを動的BPに更新**

`handleStart` 内のエラーメッセージ：

```ts
const msg =
  data.error === "insufficient_bp"
    ? `BPが不足しています（現在: ${data.bp ?? "?"}BP、必要: ${isProSettingsActive ? 250 : 100}BP）`
    : `エラーが発生しました（${data.error ?? "unknown"}）`;
```

- [ ] **Step 3: ブラウザで動作確認**

```bash
npm run dev
```

1. `/music2` を開く
2. Proプランユーザーでログイン
3. Pro設定セクションがダーク＋パープルグローで表示されることを確認
4. 何も選ばない状態: BP表示が `100 BP` であることを確認
5. BPMや楽器を1つ選択: BP表示が `250 BP` に切り替わることを確認
6. 選択を解除: `100 BP` に戻ることを確認

- [ ] **Step 4: コミット**

```bash
git add app/music2/page.tsx
git commit -m "feat: show 100/250BP dynamically based on pro settings usage"
```

---

## 自己レビュー

**スペックカバレッジ:**
- ✅ `music_full_pro: 250` → Task 1
- ✅ API側のBP判定・分岐 → Task 2
- ✅ 楽器・曲の長さ定数・state・送信 → Task 3
- ✅ ダーク＋パープルグローデザイン → Task 4
- ✅ リアルタイムBP表示 → Task 5
- ✅ insufficient_bpエラーメッセージ更新 → Task 5
- ✅ handleFullResetのクリア → Task 3

**プレースホルダー:** なし

**型整合性:** `instruments: string[]`, `duration: number | null` — Task 3で定義してTask 2/5で参照、一貫している。`isProSettingsActive` は Task 3で定義してTask 5で参照。
