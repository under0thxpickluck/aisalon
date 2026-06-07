# Ultra Music Mode 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** music2ページに「Ultra」モードを追加し、ユーザーが手書き歌詞とボーカルタイプ（男性/女性/混声）を正確に指定して高品質な楽曲を生成できるようにする。

**Architecture:** 既存の `/api/song/` パイプライン（ElevenLabs → postprocess → ASR → quality check）を Approach B で拡張。`/api/song/start` に `userLyrics`・`isUltra` パラメータを追加し、フロントで構成確認ステップ（Step 1）をスキップして直接生成開始する。ElevenLabsProvider の vocalStyle ハードコードバグを同時修正する。

**Tech Stack:** Next.js 14 App Router, ElevenLabs `music_v1` API, Google Apps Script (GAS), Cloudflare R2, TypeScript

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|----------|------|------|
| `app/lib/bp-config.ts` | 修正 | `music_ultra: 300` を BP_COSTS に追加 |
| `app/features/music/providers/elevenlabsProvider.ts` | 修正 | vocalStyle 対応ヘルパー追加、ハードコード女性ボーカルを削除 |
| `app/api/song/approve-structure/route.ts` | 修正 | `vocalStyle` と `vocalMode` を MusicGenerateInput に渡す |
| `app/api/song/start/route.ts` | 修正 | `userLyrics` / `isUltra` パラメータ追加、BP コスト分岐追加 |
| `app/music2/page.tsx` | 修正 | Ultra タブ・入力 UI・`handleUltraStart` 関数追加 |

---

## Task 1: BP_COSTS に `music_ultra` を追加

**Files:**
- Modify: `app/lib/bp-config.ts`

- [ ] **Step 1: `music_ultra: 300` を BP_COSTS に追加**

`app/lib/bp-config.ts` の `music_full_pro: 250,` の直後に1行追加する。

```typescript
// 変更前
  music_full_pro:  250,  // Pro設定使用時のフル生成

// 変更後
  music_full_pro:  250,  // Pro設定使用時のフル生成
  music_ultra:     300,  // Ultra モード（歌詞持込・ボーカル指定）
```

- [ ] **Step 2: 型エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add app/lib/bp-config.ts
git commit -m "feat(ultra): add music_ultra BP cost (300BP)"
```

---

## Task 2: ElevenLabsProvider の vocalStyle 対応

**Files:**
- Modify: `app/features/music/providers/elevenlabsProvider.ts`

vocalStyle を受け取るヘルパーを追加し、`buildElevenLabsPrompt` と `buildElevenLabsProPrompt` のハードコード女性ボーカル記述を置き換える。

- [ ] **Step 1: `MusicGenerateInput` に `vocalStyle` フィールドを追加**

`app/features/music/providers/elevenlabsProvider.ts` の `MusicGenerateInput` 型（7〜24行目）を以下に変更する。

```typescript
export type MusicGenerateInput = {
  prompt: string
  lyrics?: string
  lyricsMode: "auto" | "manual"
  language?: string
  durationTargetSec?: number
  vocalMode?: "vocal" | "instrumental"
  vocalStyle?: string            // 追加: "女性ボーカル" | "男性ボーカル" | "混声" | "ボーカルなし"
  structurePreset?: string
  moodTags?: string[]
  genre?: string
  mood?: string
  bpm?: number
  key?: string
  isPro?: boolean
  anchorWords?: string[]
  hookLines?: string[]
  maxChorusRepeats?: number
}
```

- [ ] **Step 2: `getVocalPromptPart` ヘルパー関数を追加**

`buildElevenLabsPrompt` 関数（38行目）の直前に以下を追加する。

```typescript
function getVocalPromptPart(vocalStyle?: string, language = "ja"): string {
  switch (vocalStyle) {
    case "男性ボーカル":
      return "male vocalist, warm baritone voice, clear male singing, masculine tone, expressive delivery"
    case "混声":
      return "mixed vocals, male and female duet, harmonized singing, call and response"
    case "ボーカルなし":
      return ""
    case "女性ボーカル":
    default:
      return language === "ja"
        ? "vocal song, Asian female vocal, warm and natural voice, melodic singing style"
        : "vocal song, human-like singing, warm and natural voice"
  }
}
```

- [ ] **Step 3: `buildElevenLabsPrompt` のボーカル部分を置き換える**

`buildElevenLabsPrompt` 内（現在45〜51行目）の以下のブロックを置き換える。

```typescript
// 変更前
  if (input.vocalMode === "vocal") {
    // 日本語: 言語名を直接書かず、アジア系ボーカルスタイルで指定
    const vocalStyle = input.language === "ja"
      ? "vocal song, Asian female vocal, warm and natural voice, melodic singing style"
      : "vocal song, human-like singing, warm and natural voice"
    parts.push(vocalStyle)
  } else {
    parts.push("instrumental, no vocals")
  }

// 変更後
  if (input.vocalMode === "vocal") {
    const vocalPart = getVocalPromptPart(input.vocalStyle, input.language)
    if (vocalPart) parts.push(vocalPart)
  } else {
    parts.push("instrumental, no vocals")
  }
```

- [ ] **Step 4: `buildElevenLabsProPrompt` のハードコードボーカル記述を置き換える**

`buildElevenLabsProPrompt` 内（現在129〜134行目）の以下のブロックを置き換える。

```typescript
// 変更前
  // ボーカル（詳細指定）
  parts.push(
    "professional Japanese female vocalist, clear and expressive singing, " +
    "warm timbre, precise intonation, emotional delivery with natural vibrato, " +
    "studio vocal recording quality"
  )

// 変更後
  // ボーカル（vocalStyle に応じて切り替え）
  if (input.vocalMode !== "instrumental") {
    const vocalPart = getVocalPromptPart(input.vocalStyle, input.language)
    if (vocalPart) {
      parts.push(vocalPart + ", clear and expressive singing, precise intonation, studio vocal recording quality")
    }
  }
```

- [ ] **Step 5: 型エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add app/features/music/providers/elevenlabsProvider.ts
git commit -m "fix(elevenlabs): respect vocalStyle param instead of hardcoding female vocals"
```

---

## Task 3: `approve-structure` に vocalStyle・vocalMode を渡す

**Files:**
- Modify: `app/api/song/approve-structure/route.ts:73-87`

`generateAudioAttempt` 関数内の `MusicGenerateInput` 構築部分に `vocalStyle` と `vocalMode` を追加する。

- [ ] **Step 1: `generateAudioAttempt` 内の `input` 構築を修正**

`app/api/song/approve-structure/route.ts` の `generateAudioAttempt` 関数内（70〜90行目付近）の `MusicGenerateInput` 構築を以下に変更する。

```typescript
// 変更前
  const input: MusicGenerateInput = {
    prompt:            prompt.theme ?? prompt.genre ?? "",
    genre:             prompt.genre,
    mood:              prompt.mood,
    bpm:               structureData?.bpm ?? 120,
    key:               structureData?.key ?? "C major",
    lyrics:            hasSingable ? singableLyrics : undefined,
    lyricsMode:        hasSingable ? "manual" : "auto",
    language:          prompt.language ?? "ja",
    durationTargetSec: isPro ? 180 : 150,
    vocalMode:         "vocal",
    structurePreset:   chooseStructurePreset(prompt.mood, isPro),
    moodTags:          prompt.moodTags ?? [],
    isPro,
    anchorWords:       anchorWords.length > 0 ? anchorWords : undefined,
    hookLines:         hookLines.length > 0   ? hookLines   : undefined,
    maxChorusRepeats,
  };

// 変更後
  const vocalStyle = prompt.vocalStyle;
  const vocalMode: "vocal" | "instrumental" =
    vocalStyle === "ボーカルなし" ? "instrumental" : "vocal";

  const input: MusicGenerateInput = {
    prompt:            prompt.theme ?? prompt.genre ?? "",
    genre:             prompt.genre,
    mood:              prompt.mood,
    bpm:               structureData?.bpm ?? 120,
    key:               structureData?.key ?? "C major",
    lyrics:            hasSingable ? singableLyrics : undefined,
    lyricsMode:        hasSingable ? "manual" : "auto",
    language:          prompt.language ?? "ja",
    durationTargetSec: isPro ? 180 : 150,
    vocalMode,
    vocalStyle,
    structurePreset:   chooseStructurePreset(prompt.mood, isPro),
    moodTags:          prompt.moodTags ?? [],
    isPro,
    anchorWords:       anchorWords.length > 0 ? anchorWords : undefined,
    hookLines:         hookLines.length > 0   ? hookLines   : undefined,
    maxChorusRepeats,
  };
```

- [ ] **Step 2: `generateMusic` の `force_instrumental` も vocalMode と連動することを確認**

`elevenlabsProvider.ts` の `generateMusic` メソッド内（226行目付近）は以下のままで正しく動作する（変更不要）。

```typescript
force_instrumental: input.vocalMode === "instrumental",
```

`vocalStyle === "ボーカルなし"` のとき `vocalMode = "instrumental"` → `force_instrumental: true` になる。

- [ ] **Step 3: 型エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```bash
git add app/api/song/approve-structure/route.ts
git commit -m "fix(song): pass vocalStyle and vocalMode to ElevenLabs generation"
```

---

## Task 4: `start` ルートに `userLyrics` と `isUltra` を追加

**Files:**
- Modify: `app/api/song/start/route.ts`

3か所を変更する：(1) デストラクチャリング、(2) BP コスト分岐、(3) userLyrics オーバーライド処理。

- [ ] **Step 1: デストラクチャリングに `userLyrics` と `isUltra` を追加**

141行目付近のデストラクチャリング行を以下に変更する。

```typescript
// 変更前
  const { id, code, theme, genre, mood, isPro, bpmHint, vocalStyle, vocalMood, language } = body ?? {};

// 変更後
  const { id, code, theme, genre, mood, isPro, bpmHint, vocalStyle, vocalMood, language, userLyrics, isUltra } = body ?? {};
```

- [ ] **Step 2: BP コスト分岐に Ultra 対応を追加**

166〜173行目のBPコスト判定ブロックを以下に置き換える。

```typescript
// 変更前
  // Pro設定が1つでも使われているか判定
  const isProSettingsUsed = !!isPro && !!(
    body.bpmHint ||
    body.vocalStyle ||
    body.vocalMood ||
    instruments.length > 0 ||
    duration
  );
  const bpCost = isProSettingsUsed ? BP_COSTS.music_full_pro : BP_COSTS.music_full;

// 変更後
  const isUltraMode = !!isUltra;
  // Pro設定が1つでも使われているか判定（Ultraは専用コストなので除外）
  const isProSettingsUsed = !isUltraMode && !!isPro && !!(
    body.bpmHint ||
    body.vocalStyle ||
    body.vocalMood ||
    instruments.length > 0 ||
    duration
  );
  const bpCost = isUltraMode
    ? BP_COSTS.music_ultra
    : isProSettingsUsed
    ? BP_COSTS.music_full_pro
    : BP_COSTS.music_full;
```

- [ ] **Step 3: `createJob` の `isPro` を Ultra モード時は強制 true にする**

`createJob` 呼び出し（186〜203行目付近）の `isPro` フィールドを変更する。

```typescript
// 変更前
      isPro:       !!isPro,

// 変更後
      isPro:       isUltraMode ? true : !!isPro,   // Ultra は常にPro品質プロンプトを使用
```

- [ ] **Step 4: `generateStructureAndLyrics` の後に `userLyrics` オーバーライド処理を追加**

`start/route.ts` の末尾付近（現在285行目前後の `updateJob` ブロックの直後、`completedJob` 取得の前）に以下を追加する。

具体的には、この既存コードのブロック：
```typescript
    await updateJob(jobId, {
      singableLyrics:       singable,
      displayLyrics:        displayLyricsValue,
      ...
    });
  }
```
の `}` の直後（singableLyrics ブロック全体の後）に挿入する。

```typescript
  // Ultraモード: userLyricsが提供された場合はAI生成歌詞を上書き
  const userLyricsStr = typeof userLyrics === "string" ? userLyrics.trim() : "";
  if (isUltraMode && userLyricsStr.length > 0) {
    await updateJob(jobId, {
      masterLyrics:         userLyricsStr,
      singableLyrics:       userLyricsStr,
      displayLyrics:        userLyricsStr,
      distributionLyrics:   userLyricsStr,
      lyricsSource:         "manual",
      lyricsReviewRequired: false,
      distributionReady:    true,
      anchorWordsJson:      null,
      hookLinesJson:        null,
    });
    console.log(`[Job ${jobId}][ultra] user lyrics applied: ${userLyricsStr.length} chars`);
  }
```

- [ ] **Step 5: 型エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add app/api/song/start/route.ts
git commit -m "feat(song): add userLyrics and isUltra params to start route"
```

---

## Task 5: music2 フロント — Ultra タブと入力 UI

**Files:**
- Modify: `app/music2/page.tsx`

4か所を変更する：(1) 型定義、(2) 状態変数追加、(3) タブ UI、(4) Ultra 入力セクション + BP表示 + ボタン。

- [ ] **Step 1: `GenerationMode` 型に `"ultra"` を追加**

70行目の型定義を変更する。

```typescript
// 変更前
type GenerationMode = "song" | "bgm";

// 変更後
type GenerationMode = "song" | "bgm" | "ultra";
```

- [ ] **Step 2: Ultra 用状態変数を追加**

`const isBgmMode = generationMode === "bgm";` の行（278行目付近）の直後に追加する。

```typescript
  const isBgmMode   = generationMode === "bgm";
  const isUltraMode = generationMode === "ultra";   // 追加
```

Ultra 用フォーム state を、`const [duration, setDuration] = useState<number | null>(null);` の直後（271行目付近）に追加する。

```typescript
  const [ultraLyrics,     setUltraLyrics]     = useState<string>("");
  const [ultraVocalStyle, setUltraVocalStyle] = useState<string>("女性ボーカル");
```

- [ ] **Step 3: `handleFullReset` に Ultra state のリセットを追加**

`handleFullReset` 関数内（712〜742行目）の末尾（`setDuration(null);` の直後）に追加する。

```typescript
    setUltraLyrics("");
    setUltraVocalStyle("女性ボーカル");
```

- [ ] **Step 4: モードタブを 2 列から 3 列に変更**

924〜956行目のタブセレクターを以下に置き換える。

```tsx
              <div className="mt-5 grid grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {([
                  { value: "song",  label: "曲生成",  sub: "歌詞・構成あり" },
                  { value: "bgm",   label: "BGM生成", sub: "ボーカルなし｜試験運転中" },
                  { value: "ultra", label: "Ultra ✨", sub: "歌詞持込・ボーカル指定" },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (item.value !== generationMode) {
                        setBpmHint(null);
                        setVocalStyle("");
                        setVocalMood("");
                        setInstruments([]);
                        setDuration(null);
                      }
                      setGenerationMode(item.value);
                      setErrorMsg(null);
                      setProgress(0);
                    }}
                    disabled={loading}
                    className={[
                      "rounded-xl px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                      generationMode === item.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-extrabold">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold">{item.sub}</span>
                  </button>
                ))}
              </div>
```

- [ ] **Step 5: タブ下の説明テキストに Ultra ケースを追加**

958〜962行目の `<p>` タグを以下に変更する。

```tsx
              <p className="mt-2 text-sm text-slate-600">
                {isBgmMode
                  ? "テーマ・ジャンル・雰囲気を選ぶと、ボーカルなしのBGMを生成します。"
                  : isUltraMode
                  ? "歌詞を自分で書き、ボーカルタイプを指定して高品質な楽曲を生成します。歌詞は省略可（省略時はAI自動生成）。"
                  : "テーマ・ジャンル・雰囲気を選ぶと、AIが構成を提案してから曲を生成します。"}
              </p>
```

- [ ] **Step 6: Ultra 入力セクションを追加**

既存の Pro 設定セクション（`{isPro && !isBgmMode && (` ブロック）の直前に、以下の Ultra 入力ブロックを追加する。

```tsx
              {/* Ultra 入力セクション */}
              {isUltraMode && (
                <div className="mt-5 rounded-[18px] border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm">✨</span>
                    <span className="text-[11px] font-black tracking-widest text-indigo-600">ULTRA SETTINGS</span>
                  </div>

                  {/* ボーカルタイプ */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-indigo-700 mb-1.5">
                      ボーカルタイプ
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {["女性ボーカル", "男性ボーカル", "混声", "ボーカルなし"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={loading}
                          onClick={() => setUltraVocalStyle(v)}
                          className={[
                            chipBase,
                            ultraVocalStyle === v ? chipActive : chipInactive,
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          ].join(" ")}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 歌詞テキストエリア（ボーカルなし以外） */}
                  {ultraVocalStyle !== "ボーカルなし" && (
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-700 mb-1">
                        歌詞
                        <span className="ml-2 text-[10px] font-normal text-indigo-400">任意 — 空欄の場合はAIが自動生成</span>
                      </label>
                      <p className="mb-2 text-[10px] text-indigo-400 leading-relaxed">
                        [Verse] [Chorus] [Bridge] の形式で書くと曲の構成に反映されやすくなります。AIが曲のテンポに合わせて微調整することがあります。
                      </p>
                      <textarea
                        value={ultraLyrics}
                        onChange={(e) => setUltraLyrics(e.target.value)}
                        disabled={loading}
                        placeholder={"[Verse]\n春の風が吹いて\n新しい朝が来る\n\n[Chorus]\n君と歩いた道\nずっと忘れない"}
                        rows={10}
                        className="w-full rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 font-mono"
                      />
                      <p className="mt-1 text-right text-[10px] text-indigo-400">
                        {ultraLyrics.length} 文字
                      </p>
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 7: BP 表示に Ultra ケースを追加**

1217〜1233行目の BP 表示ブロックを以下に置き換える。

```tsx
              {/* BP表示 */}
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <span className="text-xs font-bold text-indigo-700">必要BP</span>
                <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {isUltraMode ? "300 BP" : isBgmMode ? (isPro ? "150 BP" : "80 BP") : isProSettingsActive ? "250 BP" : "100 BP"}
                </span>
                {isUltraMode ? (
                  <span className="ml-auto text-[11px] text-indigo-500">✨ 歌詞持込・ボーカル指定・高品質生成</span>
                ) : isBgmMode ? (
                  <span className="ml-auto text-[11px] text-indigo-500">{isPro ? "🎛️ Pro BGM（時間指定）" : "2〜3分半のBGMをランダム生成"}</span>
                ) : isPro ? (
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

- [ ] **Step 8: ローディング中のラベルに Ultra ケースを追加**

1236行目の `{loading && <ProgressBar ...>}` を以下に変更する。

```tsx
              {loading && (
                <ProgressBar
                  label={
                    isUltraMode
                      ? (stageLabel ?? "楽曲を生成しています…")
                      : isBgmMode
                      ? "BGM生成を開始しています…"
                      : "楽曲構成を生成しています…"
                  }
                />
              )}
```

- [ ] **Step 9: ページタイトルに Ultra ケースを追加**

910〜915行目の `<h1>` を以下に変更する。

```tsx
          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
            {step === 0 && (isUltraMode ? "Ultra で曲を作る ✨" : isBgmMode ? "BGMを作る" : "新しい曲を作る")}
            {step === 1 && "構成案を確認"}
            {step === 2 && (isBgmMode ? "BGMを生成しています…" : "曲を生成しています…")}
            {step === 3 && (isBgmMode ? "BGMが完成しました！" : "曲が完成しました！")}
          </h1>
```

- [ ] **Step 10: 生成ボタンを Ultra 対応に変更**

1266〜1281行目の生成ボタンブロックを以下に置き換える。

```tsx
              {/* 生成ボタン */}
              <div className="mt-4">
                <button
                  onClick={isUltraMode ? handleUltraStart : handleStart}
                  disabled={!canStart}
                  className={btnPrimary}
                >
                  {loading
                    ? isUltraMode ? "生成を開始中…" : isBgmMode ? "BGM生成を開始中…" : "構成を生成中…"
                    : isUltraMode ? "✨ Ultra で生成する (300BP)" : isBgmMode ? "BGMを生成する" : "曲を作る"}
                </button>
                {!canStart && !loading && (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    テーマ・ジャンル・雰囲気をすべて選択してください
                  </p>
                )}
              </div>
```

- [ ] **Step 11: 型エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 12: コミット（handleUltraStart 実装前のUI骨格）**

```bash
git add app/music2/page.tsx
git commit -m "feat(music2): add Ultra tab UI, vocal selector, lyrics textarea"
```

---

## Task 6: music2 フロント — `handleUltraStart` 関数の実装

**Files:**
- Modify: `app/music2/page.tsx`

`handleStart` 関数の直前（514行目付近）に `handleUltraStart` を追加する。

- [ ] **Step 1: `handleUltraStart` 関数を追加**

`async function handleStart() {` の直前に以下を挿入する。

```typescript
  async function handleUltraStart() {
    const auth = getAuth();
    const code = getAuthSecret();
    const id   = (auth as any)?.id || (auth as any)?.loginId || "";
    if (!auth || !code || !id) { router.replace("/login"); return; }
    if (!theme.trim() || !genre || selectedMoods.length === 0) return;

    stopPoll();
    setLoading(true);
    setErrorMsg(null);
    setProgress(5);
    setStageLabel("楽曲を準備しています…");

    const moodStr = selectedMoods.join("・");

    try {
      // ── Phase 1: /api/song/start（構成 + 歌詞生成、10〜40秒） ──────────────
      const startRes = await fetch("/api/song/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          code,
          theme:      theme.trim(),
          genre,
          mood:       moodStr,
          isPro:      true,
          vocalStyle: ultraVocalStyle || "女性ボーカル",
          language:   "ja",
          userLyrics: ultraLyrics.trim() || undefined,
          isUltra:    true,
        }),
      });
      const startData = await startRes.json();

      if (!startData.ok) {
        const msg =
          startData.error === "insufficient_bp"
            ? `BPが不足しています（現在: ${startData.bp ?? "?"}BP、必要: 300BP）`
            : startData.error === "job_create_failed" || startData.error === "gas_job_create_failed"
            ? "サーバー設定のエラーが発生しました。管理者に連絡してください。"
            : `エラーが発生しました（${startData.error ?? "unknown"}）`;
        setErrorMsg(msg);
        setLoading(false);
        return;
      }

      const jid = startData.jobId;
      setJobId(jid);
      setProgress(20);
      setStageLabel("音楽を生成しています…");

      // ── Phase 2: Step 1 をスキップして即 approve-structure 呼び出し ─────────
      setStep(2);

      // approve-structure 実行中もプログレスを少しずつ進める
      let fakeP = 20;
      const fakeTimer = setInterval(() => {
        fakeP = Math.min(88, fakeP + 0.25);
        setProgress(fakeP);
      }, 2000);

      try {
        const approveRes = await fetch("/api/song/approve-structure", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: jid, approved: true }),
        });
        const approveData = await approveRes.json();

        if (!approveData.ok && !approveData.alreadyInProgress) {
          setErrorMsg(`エラー: ${approveData.error ?? "unknown"}${approveData.status ? ` (status: ${approveData.status})` : ""}`);
          setLoading(false);
          return;
        }
      } catch {
        // ネットワーク切断時もパイプラインは継続中のためポーリングで回復
        setInfoMsg("接続が一時的に途切れました。生成は継続中です…");
      } finally {
        clearInterval(fakeTimer);
      }

      // ── Phase 3: 完了までポーリング ──────────────────────────────────────────
      pollRef.current = setTimeout(() => {}, 0);
      pollUntilCompleted(jid);
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }
```

- [ ] **Step 2: 型エラーがないことを確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add app/music2/page.tsx
git commit -m "feat(music2): implement handleUltraStart — skip structure step, call approve-structure directly"
```

---

## Task 7: 動作確認

- [ ] **Step 1: 開発サーバーを起動**

```bash
npm run dev
```

`http://localhost:3000/music2` を開く。

- [ ] **Step 2: タブが3列になっていることを確認**

「曲生成」「BGM生成」「Ultra ✨」の3タブが表示されていること。

- [ ] **Step 3: Ultra タブをクリックして入力 UI を確認**

- ボーカルタイプ（女性/男性/混声/ボーカルなし）が表示されること
- 歌詞テキストエリアが表示されること
- 「ボーカルなし」を選択すると歌詞テキストエリアが非表示になること
- BP 表示が「300 BP」になっていること

- [ ] **Step 4: 既存の「曲生成」モードが壊れていないことを確認**

曲生成タブを選択 → テーマ・ジャンル・雰囲気を入力 → 「曲を作る」をクリック → Step 1（構成確認）が表示されること。

- [ ] **Step 5: Ultra モードで生成テストを実行**

- テーマ: 「夏の終わり」
- ジャンル: 「ポップ」
- 雰囲気: 「切ない」
- ボーカルタイプ: 「男性ボーカル」
- 歌詞: 空欄（AIに任せる）
- 「Ultra で生成する」をクリック
- Step 1 が表示されずに直接 Step 2（生成中）に遷移すること
- 生成完了後 Step 3（完成）が表示されること
- 音声が再生できること

- [ ] **Step 6: 歌詞付き Ultra モードで生成テストを実行**

- 歌詞テキストエリアに以下を入力:
  ```
  [Verse]
  夏の風が吹き抜けた
  君の笑顔が遠ざかる
  
  [Chorus]
  もう戻れない夏の日
  あの空に誓いを立てた
  ```
- 「Ultra で生成する」をクリック
- 生成完了後、歌詞パネルで入力した歌詞が表示されていること（AIが完全書き換えせず元の歌詞ベースになっていること）

---

## 付録: 変更の影響範囲チェック

| 既存機能 | 影響 | 確認方法 |
|----------|------|----------|
| 曲生成モード（song） | vocalStyle が従来どおり `undefined` → `buildElevenLabsPrompt` がデフォルト（女性ボーカル）を返す | Task 7 Step 4 |
| BGM生成モード | GenerationMode に `"ultra"` が追加されるが `isBgmMode` 判定は変わらない | 目視確認 |
| Pro 設定（song モード） | `isProSettingsUsed` 判定に `!isUltraMode` 条件を追加したため Song Pro の BP は従来どおり 250BP | BP 表示確認 |
| 既存 song ジョブのポーリング | `pollUntilCompleted` は `jobId` ベースで動作するため Ultra / Song 共通で使える | Task 7 Step 5 |
