# displayLyrics ASR補正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `mergeLyricsForDisplay()` の `displayLyrics` / `lyricsSource` 決定をウィンドウ付き逐次マッチング方式に置き換え、ASR書き起こしをもとに表示歌詞を実歌唱寄りに補正する。

**Architecture:** 新規モジュール `lib/music/lyrics-display.ts` にマッチングロジック全体を集約し、既存の `lib/music/lyrics-merge.ts` から呼び出す形で差し替える。`approve-structure/route.ts` の変更は `jobId` を渡す1行追加のみ。

**Tech Stack:** TypeScript, Next.js 14 App Router (Node.js runtime)

---

## ファイル構成

| ファイル | 変更種別 | 担当 |
|----------|----------|------|
| `lib/music/lyrics-display.ts` | 新規作成 | ウィンドウマッチング・ノイズ判定・表示向け正規化・top-level `finalizeDisplayLyrics` |
| `lib/music/lyrics-merge.ts` | 修正 | `jobId?` 引数追加、`displayLyrics`/`lyricsSource` を `finalizeDisplayLyrics()` に委譲 |
| `app/api/song/approve-structure/route.ts` | 最小変更 | `mergeLyricsForDisplay()` 呼び出しに `jobId` を渡す1行追加 |

---

## Task 1: `lib/music/lyrics-display.ts` を新規作成する

**Files:**
- Create: `lib/music/lyrics-display.ts`

このタスクはユニットテストフレームワークがないため、ビルドチェックで型安全を確認する。

- [ ] **Step 1: ファイルを作成する**

`lib/music/lyrics-display.ts` を以下の内容で作成する。

```typescript
// lib/music/lyrics-display.ts
// singableLyrics と asrLyrics を行単位でマージして displayLyrics を確定する。
// 「比較用正規化」と「表示向け正規化」は明確に分離している。
// normalizeAsrLineForDisplay は表示向け軽整形のみで情報を削りすぎない。

const SIMILARITY_THRESHOLD_DEFAULT = 0.45;
const SIMILARITY_THRESHOLD_SHORT   = 0.65; // singable 行が 4 文字以内の場合
const SHORT_LINE_MAX_LEN           = 4;
const WINDOW_HALF                  = 2;
const DEDUP_MAX_CONSECUTIVE        = 2;

// ── バイグラム Jaccard（行レベル）────────────────────────────────────────────
// lyrics-compare.ts の関数と同ロジック。循環参照を避けるため独立実装。

function buildBigrams(str: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str[i] + str[i + 1];
    freq.set(bg, (freq.get(bg) ?? 0) + 1);
  }
  return freq;
}

export function bigramJaccardLine(a: string, b: string): number {
  if (a.length <= 1 || b.length <= 1) return 0;
  const freqA = buildBigrams(a);
  const freqB = buildBigrams(b);

  let intersection = 0;
  freqA.forEach((countA, bg) => {
    intersection += Math.min(countA, freqB.get(bg) ?? 0);
  });

  const totalA = Math.max(0, a.length - 1);
  const totalB = Math.max(0, b.length - 1);
  const union  = totalA + totalB - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

// ── ノイズ行判定 ──────────────────────────────────────────────────────────────

export function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3)        return true; // 極端に短い
  if (/^[\s\W]+$/.test(t)) return true; // 記号・空白のみ
  if (/^\[/.test(t))       return true; // セクションタグ
  return false;
}

// ── ASR 行の表示向け正規化 ────────────────────────────────────────────────────
// 目的: 表示向けに軽く整形するのみ。比較用に情報を削らない。
// normalizeLyricsForCompare() は呼ばない。

export function normalizeAsrLineForDisplay(line: string): string {
  let s = line.trim();
  s = s.replace(/\s+/g, " ");                 // 連続空白を1つに圧縮
  s = s.replace(/^[-・•]\s*/, "");            // 行頭の記号プレフィックスを除去
  return s;
}

// ── 同一行の過剰連続圧縮 ──────────────────────────────────────────────────────
// 3連続以上の同一行を DEDUP_MAX_CONSECUTIVE（2）行に圧縮する。

function dedupeSequentialLines(lines: string[]): string[] {
  const result: string[]  = [];
  let consecutiveCount    = 0;
  let lastLine            = "";

  for (const line of lines) {
    if (line === lastLine) {
      consecutiveCount++;
      if (consecutiveCount <= DEDUP_MAX_CONSECUTIVE) {
        result.push(line);
      }
    } else {
      result.push(line);
      consecutiveCount = 1;
      lastLine         = line;
    }
  }
  return result;
}

// ── ウィンドウ付き逐次マッチング ──────────────────────────────────────────────

export function mergeSingableWithAsr(
  singable: string,
  asr: string
): { displayLyrics: string; replacedCount: number; keptCount: number } {
  const singableLines = singable.split("\n");

  // ASR 行を表示向け正規化してノイズフィルタ
  const asrLines = asr
    .split("\n")
    .map(normalizeAsrLineForDisplay)
    .filter((l) => !isNoiseLine(l));

  const asrUsed     = new Set<number>();
  let   asrPtr      = 0;
  let   replacedCount = 0;
  let   keptCount     = 0;
  const result: string[] = [];

  for (const singableLine of singableLines) {
    const trimmed = singableLine.trim();

    // セクションタグはそのまま保持（比較対象にしない）
    if (/^\[.*\]$/.test(trimmed)) {
      result.push(singableLine);
      continue;
    }

    // 空行はそのまま保持
    if (trimmed.length === 0) {
      result.push(singableLine);
      continue;
    }

    // ウィンドウ内の候補を探す
    const windowStart = Math.max(0, asrPtr - WINDOW_HALF);
    const windowEnd   = Math.min(asrLines.length - 1, asrPtr + WINDOW_HALF);

    let bestIdx = -1;
    let bestSim = -1;

    for (let i = windowStart; i <= windowEnd; i++) {
      if (asrUsed.has(i)) continue;
      const sim = bigramJaccardLine(trimmed, asrLines[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    // 採用閾値: 短い行は厳しく
    const threshold = trimmed.length <= SHORT_LINE_MAX_LEN
      ? SIMILARITY_THRESHOLD_SHORT
      : SIMILARITY_THRESHOLD_DEFAULT;

    const shouldAdopt =
      bestIdx >= 0 &&
      bestSim >= threshold &&
      !isNoiseLine(asrLines[bestIdx]);

    if (shouldAdopt) {
      result.push(asrLines[bestIdx]);
      asrUsed.add(bestIdx);
      asrPtr = bestIdx + 1;
      replacedCount++;
    } else {
      result.push(singableLine);
      keptCount++;
    }
  }

  const dedupedLines = dedupeSequentialLines(result);
  return {
    displayLyrics: dedupedLines.join("\n"),
    replacedCount,
    keptCount,
  };
}

// ── top-level: displayLyrics 確定（フォールバック込み）────────────────────────

export function finalizeDisplayLyrics(
  singable: string,
  asr: string | null | undefined,
  jobId?: string
): { displayLyrics: string; lyricsSource: "singable" | "asr_merged"; removedNoise: number } {
  const tag = jobId ? `[merge][jobId=${jobId}]` : "[merge]";

  // フォールバック: ASR なし
  if (!asr || asr.trim().length === 0) {
    console.log(`${tag} fallback reason=asr_unavailable`);
    return { displayLyrics: singable, lyricsSource: "singable", removedNoise: 0 };
  }

  // ASR の行数確認（ノイズフィルタ前後）
  const rawLines      = asr.split("\n").map(normalizeAsrLineForDisplay);
  const filteredLines = rawLines.filter((l) => !isNoiseLine(l));
  const removedNoise  = rawLines.length - filteredLines.length;

  console.log(`${tag} asr available=true asrRawLength=${asr.length}`);

  if (filteredLines.length === 0) {
    console.log(`${tag} fallback reason=asr_empty_after_filter`);
    return { displayLyrics: singable, lyricsSource: "singable", removedNoise };
  }

  // singable のコンテンツ行数（セクションタグ・空行を除く）
  const singableContentLines = singable
    .split("\n")
    .filter((l) => l.trim().length > 0 && !/^\[.*\]$/.test(l.trim()));

  console.log(
    `${tag} singableLines=${singableContentLines.length} asrLines=${filteredLines.length} removedNoise=${removedNoise}`
  );

  // マージ実行
  try {
    const { displayLyrics, replacedCount, keptCount } = mergeSingableWithAsr(singable, asr);
    const lyricsSource: "singable" | "asr_merged" = replacedCount > 0 ? "asr_merged" : "singable";

    console.log(
      `${tag} replaced=${replacedCount} kept=${keptCount} finalDisplayLength=${displayLyrics.length} lyricsSource=${lyricsSource}`
    );

    return { displayLyrics, lyricsSource, removedNoise };
  } catch (e) {
    console.warn(`${tag} fallback reason=merge_exception`, e);
    return { displayLyrics: singable, lyricsSource: "singable", removedNoise };
  }
}
```

- [ ] **Step 2: ビルドチェック**

```bash
npm run build 2>&1 | grep -E "(error TS|✓ Compiled|Failed)" | head -20
```

期待: `✓ Compiled` が出てエラーなし。

- [ ] **Step 3: コミット**

```bash
git add lib/music/lyrics-display.ts
git commit -m "feat: lyrics-display.ts を追加 — ウィンドウ付き逐次マッチングで displayLyrics を確定"
```

---

## Task 2: `lib/music/lyrics-merge.ts` を修正する

**Files:**
- Modify: `lib/music/lyrics-merge.ts`

`mergeLyricsForDisplay()` の `displayLyrics` / `lyricsSource` を `finalizeDisplayLyrics()` に委譲する。

- [ ] **Step 1: ファイルを読んで現在の内容を確認する**

`lib/music/lyrics-merge.ts` を読み、`mergeLyricsForDisplay` の関数シグネチャと各 case の return 文を確認する。

- [ ] **Step 2: import を追加する**

ファイル先頭の `// lib/music/lyrics-merge.ts` の次の行の後に import を追加する。

**置き換え前:**
```typescript
// lib/music/lyrics-merge.ts

export type MergeResult = {
```

**置き換え後:**
```typescript
// lib/music/lyrics-merge.ts

import { finalizeDisplayLyrics } from "./lyrics-display";

export type MergeResult = {
```

- [ ] **Step 3: `mergeLyricsForDisplay` の params に `jobId?` を追加する**

**置き換え前:**
```typescript
export function mergeLyricsForDisplay(params: {
  singableLyrics: string;
  asrLyrics: string;
  score: number;
  repeatScore?: number;
  anchorWords?: string[];
  hookLines?: string[];
}): MergeResult {
  const { singableLyrics, asrLyrics, score, repeatScore = 0 } = params;
```

**置き換え後:**
```typescript
export function mergeLyricsForDisplay(params: {
  singableLyrics: string;
  asrLyrics: string;
  score: number;
  repeatScore?: number;
  anchorWords?: string[];
  hookLines?: string[];
  jobId?: string;
}): MergeResult {
  const { singableLyrics, asrLyrics, score, repeatScore = 0, jobId } = params;
```

- [ ] **Step 4: `buildMergedLyrics` 呼び出しの直後に `finalizeDisplayLyrics` 呼び出しを追加する**

**置き換え前:**
```typescript
  // merged の生成: singable と asr を行単位でブレンド
  const mergedLyrics = buildMergedLyrics(singableLyrics, asrLyrics, score);

  // Case A: 高品質
  if (score >= 90 && repeatScore < 15) {
```

**置き換え後:**
```typescript
  // merged の生成: singable と asr を行単位でブレンド
  const mergedLyrics = buildMergedLyrics(singableLyrics, asrLyrics, score);

  // displayLyrics / lyricsSource は新ロジックで一意に決定する
  const { displayLyrics, lyricsSource } = finalizeDisplayLyrics(singableLyrics, asrLyrics, jobId);

  // Case A: 高品質
  if (score >= 90 && repeatScore < 15) {
```

- [ ] **Step 5: Case A の return を修正する**

**置き換え前:**
```typescript
  // Case A: 高品質
  if (score >= 90 && repeatScore < 15) {
    return {
      displayLyrics:    singableLyrics,
      distributionLyrics: singableLyrics,
      mergedLyrics,
      reviewRequired:   false,
      distributionReady: true,
      lyricsSource:     "singable",
      lyricsGateResult: "pass",
    };
  }
```

**置き換え後:**
```typescript
  // Case A: 高品質
  if (score >= 90 && repeatScore < 15) {
    return {
      displayLyrics,
      distributionLyrics: singableLyrics,
      mergedLyrics,
      reviewRequired:    false,
      distributionReady: true,
      lyricsSource,
      lyricsGateResult:  "pass",
    };
  }
```

- [ ] **Step 6: Case B の return を修正する**

**置き換え前:**
```typescript
  // Case B: 軽微ずれ
  if (score >= 80) {
    return {
      displayLyrics:    mergedLyrics,
      distributionLyrics: mergedLyrics,
      mergedLyrics,
      reviewRequired:   false,
      distributionReady: true,
      lyricsSource:     "asr_merged",
      lyricsGateResult: "review",
    };
  }
```

**置き換え後:**
```typescript
  // Case B: 軽微ずれ
  if (score >= 80) {
    return {
      displayLyrics,
      distributionLyrics: mergedLyrics,
      mergedLyrics,
      reviewRequired:    false,
      distributionReady: true,
      lyricsSource,
      lyricsGateResult:  "review",
    };
  }
```

- [ ] **Step 7: Case C の return を修正する**

**置き換え前:**
```typescript
  // Case C: 中程度ずれ
  if (score >= 65 && repeatScore < 35) {
    return {
      displayLyrics:    mergedLyrics,
      distributionLyrics: "",
      mergedLyrics,
      reviewRequired:   true,
      distributionReady: false,
      lyricsSource:     "asr_merged",
      lyricsGateResult: "review",
    };
  }
```

**置き換え後:**
```typescript
  // Case C: 中程度ずれ
  if (score >= 65 && repeatScore < 35) {
    return {
      displayLyrics,
      distributionLyrics: "",
      mergedLyrics,
      reviewRequired:    true,
      distributionReady: false,
      lyricsSource,
      lyricsGateResult:  "review",
    };
  }
```

- [ ] **Step 8: Case D の return を修正する**

**置き換え前:**
```typescript
  // Case D: 重度ずれ / 強反復
  return {
    displayLyrics:    singableLyrics,
    distributionLyrics: "",
    mergedLyrics,
    reviewRequired:   true,
    distributionReady: false,
    lyricsSource:     "singable",
    lyricsGateResult: "reject",
  };
```

**置き換え後:**
```typescript
  // Case D: 重度ずれ / 強反復
  return {
    displayLyrics,
    distributionLyrics: "",
    mergedLyrics,
    reviewRequired:    true,
    distributionReady: false,
    lyricsSource,
    lyricsGateResult:  "reject",
  };
```

- [ ] **Step 9: ビルドチェック**

```bash
npm run build 2>&1 | grep -E "(error TS|✓ Compiled|Failed)" | head -20
```

期待: エラーなし。

- [ ] **Step 10: コミット**

```bash
git add lib/music/lyrics-merge.ts
git commit -m "feat: mergeLyricsForDisplay の displayLyrics/lyricsSource を finalizeDisplayLyrics に委譲"
```

---

## Task 3: `approve-structure/route.ts` に jobId を渡す

**Files:**
- Modify: `app/api/song/approve-structure/route.ts`

`runAsrAndQuality()` 内の `mergeLyricsForDisplay()` 呼び出しに `jobId` を追加する1行変更のみ。

- [ ] **Step 1: 呼び出し箇所を確認して jobId を追加する**

`runAsrAndQuality()` 関数内の `mergeLyricsForDisplay()` 呼び出しを修正する。

**置き換え前:**
```typescript
    const mergeResult   = mergeLyricsForDisplay({
      singableLyrics: singable,
      asrLyrics:      asrResult.text,
      score:          compareResult.score,
      repeatScore:    repeatResult.repeatScore,
      anchorWords,
      hookLines,
    });
```

**置き換え後:**
```typescript
    const mergeResult   = mergeLyricsForDisplay({
      singableLyrics: singable,
      asrLyrics:      asrResult.text,
      score:          compareResult.score,
      repeatScore:    repeatResult.repeatScore,
      anchorWords,
      hookLines,
      jobId,
    });
```

(`jobId` は `runAsrAndQuality()` の第1引数 `job` から取得済み: `const { jobId } = job;`)

- [ ] **Step 2: ビルドチェック**

```bash
npm run build 2>&1 | grep -E "(error TS|✓ Compiled|Failed)" | head -20
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add app/api/song/approve-structure/route.ts
git commit -m "feat: mergeLyricsForDisplay に jobId を渡してマージログに jobId を含める"
```

---

## 最終確認

- [ ] **全コミット確認**

```bash
git log --oneline -5
```

期待:
```
feat: mergeLyricsForDisplay に jobId を渡してマージログに jobId を含める
feat: mergeLyricsForDisplay の displayLyrics/lyricsSource を finalizeDisplayLyrics に委譲
feat: lyrics-display.ts を追加 — ウィンドウ付き逐次マッチングで displayLyrics を確定
```

- [ ] **最終ビルド確認**

```bash
npm run build 2>&1 | tail -10
```

期待: `✓ Generating static pages` が出てエラーなし。

---

## テスト観点

実装後、以下シナリオで動作確認すること。

| # | シナリオ | 確認方法 | 期待動作 |
|---|----------|----------|----------|
| 1 | ASR = null/空 | ログ確認 | `fallback reason=asr_unavailable`, `displayLyrics=singable` |
| 2 | ASR がノイズのみ（記号・短い断片） | ログ確認 | `fallback reason=asr_empty_after_filter` |
| 3 | `mergeSingableWithAsr` が例外 | ログ確認 | `fallback reason=merge_exception`, singable フォールバック |
| 4 | singable と ASR が同内容（高類似） | result API で `lyricsSource` 確認 | `lyricsSource="asr_merged"`, `replaced >= 1` |
| 5 | singable と ASR が全く別内容（低類似） | result API で `lyricsSource` 確認 | `lyricsSource="singable"`, `replaced=0` |
| 6 | ASR に3連続同一行がある | result API の `displayLyrics` を確認 | 2行に圧縮されている |
| 7 | 4文字以内の短い singable 行、ASR 類似度 0.5 | ログの `replaced` カウント確認 | 不採用（閾値 0.65 未満）, singable 維持 |
| 8 | `[Chorus]` などセクションタグ行が含まれる | result API の `displayLyrics` 確認 | タグ行がそのまま含まれる |
| 9 | ASR 行数が singable より少ない場合 | ログの `kept` カウント確認 | ウィンドウ外の singable 行は維持 |
| 10 | 実際の approve-structure 呼び出し | サーバーログ | `[merge][jobId=song_...]` でログが出る |
