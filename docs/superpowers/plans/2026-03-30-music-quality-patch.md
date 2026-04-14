# Music Generation Quality Patch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存のAPIルート構成を壊さず、最小パッチで音楽生成の品質安定化バグを修正する。

**Architecture:** 対象は `start/route.ts`・`approve-structure/route.ts`・`approve-lyrics/route.ts` の3ファイル。各ファイルに対してピンポイントな Edit を行い、ロジック変更以外の全面リファクタは行わない。`result/route.ts` は現状の歌詞優先順位（displayLyrics → singableLyrics → masterLyrics）が既に正しいため変更不要。

**Tech Stack:** Next.js 14 App Router (Node.js runtime), TypeScript, GAS jobStore, ElevenLabs, OpenAI, R2

---

## Files

| ファイル | 変更内容 |
|----------|----------|
| `app/api/song/start/route.ts` | `displayLyrics` 初期値を `singableLyrics` に修正・ログ追加 |
| `app/api/song/approve-structure/route.ts` | ASR不能時の `qualityUnavailable` フラグ・再生成ガード・attempt2ログ・R2ガード・空catch修正 |
| `app/api/song/approve-lyrics/route.ts` | 未使用ルートコメント追加・`hook` → `hookSummary` 統一 |

---

## Task 1: `start/route.ts` — displayLyrics 初期値を singableLyrics に修正

**Files:**
- Modify: `app/api/song/start/route.ts:229-258`

テストはビルドチェックのみ（Next.js route はユニットテストなし）。

- [ ] **Step 1: `displayLyrics` の初期値を singableLyrics に変更し、ログを追加する**

`app/api/song/start/route.ts` の `updateJob` 呼び出し部分（行 248〜258 付近）を以下に置き換える。

```typescript
    // singableLyrics が空のときのみ masterLyrics にフォールバック
    const displayLyricsSource = (singable && singable.trim().length > 0) ? "singable" : "master";
    const displayLyricsValue  = displayLyricsSource === "singable" ? singable : generated.masterLyrics;

    console.log(`[Job ${jobId}][start] masterLyrics=${generated.masterLyrics.length}chars singableLyrics=${singable?.length ?? 0}chars displaySource=${displayLyricsSource}`);

    await updateJob(jobId, {
      singableLyrics:       singable,
      displayLyrics:        displayLyricsValue,
      distributionLyrics:   generated.masterLyrics,  // 配信用は master を初期値に（ASR後に上書き）
      lyricsSource:         displayLyricsSource,
      lyricsReviewRequired: true,        // ASR完了まで要確認
      distributionReady:    false,       // ASR未実施なのでfalse
      anchorWordsJson:      JSON.stringify(anchorWords),
      hookLinesJson:        JSON.stringify(hookLines),
      generationAttempt:    1,
    });
```

具体的には `start/route.ts` の以下の行を置き換える。

**置き換え前（L248〜258）:**
```typescript
    await updateJob(jobId, {
      singableLyrics:       singable,
      displayLyrics:        generated.masterLyrics,  // 表示用は自然な日本語（master）
      distributionLyrics:   generated.masterLyrics,  // 配信用も master を初期値に（ASR後に上書き）
      lyricsSource:         "master",
      lyricsReviewRequired: true,        // ASR完了まで要確認
      distributionReady:    false,       // ASR未実施なのでfalse
      anchorWordsJson:      JSON.stringify(anchorWords),
      hookLinesJson:        JSON.stringify(hookLines),
      generationAttempt:    1,
    });
```

**置き換え後:**
```typescript
    // singableLyrics が空のときのみ masterLyrics にフォールバック
    const displayLyricsSource = (singable && singable.trim().length > 0) ? "singable" : "master";
    const displayLyricsValue  = displayLyricsSource === "singable" ? singable : generated.masterLyrics;

    console.log(`[Job ${jobId}][start] masterLyrics=${generated.masterLyrics.length}chars singableLyrics=${singable?.length ?? 0}chars displaySource=${displayLyricsSource}`);

    await updateJob(jobId, {
      singableLyrics:       singable,
      displayLyrics:        displayLyricsValue,
      distributionLyrics:   generated.masterLyrics,  // 配信用は master を初期値に（ASR後に上書き）
      lyricsSource:         displayLyricsSource,
      lyricsReviewRequired: true,        // ASR完了まで要確認
      distributionReady:    false,       // ASR未実施なのでfalse
      anchorWordsJson:      JSON.stringify(anchorWords),
      hookLinesJson:        JSON.stringify(hookLines),
      generationAttempt:    1,
    });
```

- [ ] **Step 2: ビルドチェック**

```bash
npm run build 2>&1 | tail -30
```

期待: エラーなし（型エラーが出ないこと）

- [ ] **Step 3: コミット**

```bash
git add app/api/song/start/route.ts
git commit -m "fix: displayLyrics を singableLyrics 優先で初期化"
```

---

## Task 2: `approve-lyrics/route.ts` — 未使用コメント追加・hook → hookSummary 統一

**Files:**
- Modify: `app/api/song/approve-lyrics/route.ts:1-2` (コメント追加)
- Modify: `app/api/song/approve-lyrics/route.ts:67` (hook → hookSummary)

- [ ] **Step 1: ファイル先頭に未使用ルートのコメントを追加する**

`app/api/song/approve-lyrics/route.ts` の1行目を以下に置き換える。

**置き換え前:**
```typescript
// app/api/song/approve-lyrics/route.ts
import { NextResponse } from "next/server";
```

**置き換え後:**
```typescript
// app/api/song/approve-lyrics/route.ts
// NOTE: 現行フロー（/start → /approve-structure）では未使用ルート。
// start が直接 structure_ready まで生成するため、このルートへは到達しない。
// 将来の「手動歌詞承認」導線として残置。削除は将来のフロー再設計時に行うこと。
import { NextResponse } from "next/server";
```

- [ ] **Step 2: `hook` を `hookSummary` に統一する**

`generateStructureBackground` 内の `updateJob` 呼び出し部分を修正する。

**置き換え前（L58〜68）:**
```typescript
    await updateJob(jobId, {
      status: "structure_ready",
      structureData: {
        bpm:      Number(parsed.bpm ?? 120),
        key:      String(parsed.key ?? "C major"),
        sections: Array.isArray(parsed.sections)
          ? parsed.sections.map(String)
          : ["Intro", "Verse", "Chorus", "Outro"],
        hook: String(parsed.hookSummary ?? ""),
      },
    });
```

**置き換え後:**
```typescript
    await updateJob(jobId, {
      status: "structure_ready",
      structureData: {
        bpm:         Number(parsed.bpm ?? 120),
        key:         String(parsed.key ?? "C major"),
        sections:    Array.isArray(parsed.sections)
          ? parsed.sections.map(String)
          : ["Intro", "Verse", "Chorus", "Outro"],
        hookSummary: String(parsed.hookSummary ?? ""),
      },
    });
```

- [ ] **Step 3: ビルドチェック**

```bash
npm run build 2>&1 | tail -30
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add app/api/song/approve-lyrics/route.ts
git commit -m "fix: approve-lyrics を未使用ルートとしてコメント化・hook を hookSummary に統一"
```

---

## Task 3: `approve-structure/route.ts` — 空 catch にログを追加

**Files:**
- Modify: `app/api/song/approve-structure/route.ts:62-63`

- [ ] **Step 1: anchorWords / hookLines の空 catch にログを追加する**

`generateAudioAttempt` 内の anchorWords / hookLines パース箇所を修正する。

**置き換え前（L62-63）:**
```typescript
  try { anchorWords = job.anchorWordsJson ? JSON.parse(job.anchorWordsJson) : []; } catch {}
  try { hookLines   = job.hookLinesJson   ? JSON.parse(job.hookLinesJson)   : []; } catch {}
```

**置き換え後:**
```typescript
  try { anchorWords = job.anchorWordsJson ? JSON.parse(job.anchorWordsJson) : []; } catch (e) {
    console.warn(`[Job ${jobId}][attempt${attemptNum}] failed to parse anchorWordsJson`, e);
  }
  try { hookLines   = job.hookLinesJson   ? JSON.parse(job.hookLinesJson)   : []; } catch (e) {
    console.warn(`[Job ${jobId}][attempt${attemptNum}] failed to parse hookLinesJson`, e);
  }
```

同様に、`runAsrAndQuality` 内にある anchorWords / hookLines パースも修正する。

**置き換え前（runAsrAndQuality 内 L190-191）:**
```typescript
  try { anchorWords = job.anchorWordsJson ? JSON.parse(job.anchorWordsJson) : []; } catch {}
  try { hookLines   = job.hookLinesJson   ? JSON.parse(job.hookLinesJson)   : []; } catch {}
```

**置き換え後:**
```typescript
  try { anchorWords = job.anchorWordsJson ? JSON.parse(job.anchorWordsJson) : []; } catch (e) {
    console.warn(`[Job ${jobId}][asr] failed to parse anchorWordsJson`, e);
  }
  try { hookLines   = job.hookLinesJson   ? JSON.parse(job.hookLinesJson)   : []; } catch (e) {
    console.warn(`[Job ${jobId}][asr] failed to parse hookLinesJson`, e);
  }
```

- [ ] **Step 2: ビルドチェック**

```bash
npm run build 2>&1 | tail -30
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/api/song/approve-structure/route.ts
git commit -m "fix: 空 catch を warn ログ付き catch に置換"
```

---

## Task 4: `approve-structure/route.ts` — ASR不能時 qualityUnavailable フラグ追加・再生成暴走防止

**Files:**
- Modify: `app/api/song/approve-structure/route.ts:176-291` (QualityCheckResult型・runAsrAndQuality・runAudioPipeline)

- [ ] **Step 1: `QualityCheckResult` 型に `qualityUnavailable` フィールドを追加する**

**置き換え前（L176-180）:**
```typescript
type QualityCheckResult = {
  gate:               "pass" | "review" | "reject" | null;
  lyricsQualityScore: number;
  repeatScore:        number;
};
```

**置き換え後:**
```typescript
type QualityCheckResult = {
  gate:               "pass" | "review" | "reject" | null;
  lyricsQualityScore: number;
  repeatScore:        number;
  qualityUnavailable: boolean;  // ASR未実施等で品質スコアが信頼できない場合 true
};
```

- [ ] **Step 2: `runAsrAndQuality` の catch ブロックを修正して `qualityUnavailable: true` を返す**

`runAsrAndQuality` の catch ブロック（L277〜290）を置き換える。

**置き換え前（L277-290）:**
```typescript
  } catch (asrErr: any) {
    const msg = String(asrErr?.message ?? asrErr);
    console.warn(`[Job ${jobId}] ASR failed (fallback to singable): ${msg}`);
    await updateJob(jobId, {
      asrStatus:            "failed",
      asrError:             msg,
      asrCompletedAt:       new Date().toISOString(),
      lyricsSource:         "singable",
      distributionReady:    false,
      lyricsReviewRequired: true,
      lyricsGateResult:     "reject",
    });
    return { gate: "reject", lyricsQualityScore: 0, repeatScore: 0 };
  }
```

**置き換え後:**
```typescript
  } catch (asrErr: any) {
    const msg = String(asrErr?.message ?? asrErr);
    console.warn(`[Job ${jobId}] ASR failed — qualityUnavailable=true (reason: ${msg})`);
    await updateJob(jobId, {
      asrStatus:            "failed",
      asrError:             msg,
      asrCompletedAt:       new Date().toISOString(),
      lyricsSource:         "singable",
      distributionReady:    false,
      lyricsReviewRequired: true,
      lyricsGateResult:     null,   // スコア不明なので reject と断定しない
    });
    return { gate: null, lyricsQualityScore: 0, repeatScore: 0, qualityUnavailable: true };
  }
```

- [ ] **Step 3: `runAudioPipeline` の `quality1` 初期化と「音源URLなし」分岐を修正する**

`runAudioPipeline` 内の以下のブロックを置き換える。

**置き換え前（L305-319）:**
```typescript
  const audioForAsr1 = attempt1.finalUrl ?? attempt1.rawUrl ?? null;
  let quality1: QualityCheckResult = { gate: null, lyricsQualityScore: 0, repeatScore: 0 };

  if (audioForAsr1) {
    quality1 = await runAsrAndQuality(job, apiKey, audioForAsr1);
  } else {
    await updateJob(jobId, {
      asrStatus:            "failed",
      asrError:             "no_audio_url",
      lyricsSource:         "singable",
      distributionReady:    false,
      lyricsReviewRequired: true,
      lyricsGateResult:     "reject",
    });
    quality1 = { gate: "reject", lyricsQualityScore: 0, repeatScore: 0 };
  }
```

**置き換え後:**
```typescript
  const audioForAsr1 = attempt1.finalUrl ?? attempt1.rawUrl ?? null;
  let quality1: QualityCheckResult = { gate: null, lyricsQualityScore: 0, repeatScore: 0, qualityUnavailable: true };

  if (audioForAsr1) {
    quality1 = await runAsrAndQuality(job, apiKey, audioForAsr1);
  } else {
    console.warn(`[Job ${jobId}] ASR skipped — no audio URL available (qualityUnavailable=true)`);
    await updateJob(jobId, {
      asrStatus:            "failed",
      asrError:             "no_audio_url",
      lyricsSource:         "singable",
      distributionReady:    false,
      lyricsReviewRequired: true,
      lyricsGateResult:     null,  // スコア不明なので reject と断定しない
    });
    // qualityUnavailable=true のまま（デフォルト値を使用）
  }
```

- [ ] **Step 4: `runAsrAndQuality` の成功 return に `qualityUnavailable: false` を追加する**

`runAsrAndQuality` の成功パス return（L271-275 付近）を修正する。このフィールドを追加しないと TypeScript の型エラーになる。

**置き換え前:**
```typescript
    return {
      gate:               gateResult.gate,
      lyricsQualityScore: qualityResult.lyricsQualityScore,
      repeatScore:        repeatResult.repeatScore,
    };
```

**置き換え後:**
```typescript
    return {
      gate:               gateResult.gate,
      lyricsQualityScore: qualityResult.lyricsQualityScore,
      repeatScore:        repeatResult.repeatScore,
      qualityUnavailable: false,
    };
```

- [ ] **Step 5: `shouldRegenerate` 条件に `qualityUnavailable` ガードを追加する**

**置き換え前（L322-326）:**
```typescript
  const currentJob1       = await getJob(jobId);
  const generationAttempt = currentJob1?.generationAttempt ?? 1;
  const shouldRegenerate  =
    generationAttempt === 1 &&
    (quality1.lyricsQualityScore < 65 || quality1.repeatScore >= 60);
```

**置き換え後:**
```typescript
  const currentJob1       = await getJob(jobId);
  const generationAttempt = currentJob1?.generationAttempt ?? 1;
  // qualityUnavailable の場合は品質スコアが信頼できないため再生成しない
  const shouldRegenerate  =
    generationAttempt === 1 &&
    !quality1.qualityUnavailable &&
    (quality1.lyricsQualityScore < 65 || quality1.repeatScore >= 60);

  if (quality1.qualityUnavailable) {
    console.log(`[Job ${jobId}] Skipping auto-regeneration — quality unavailable (ASR not executed)`);
  }
```

- [ ] **Step 6: ビルドチェック**

```bash
npm run build 2>&1 | tail -30
```

期待: エラーなし

- [ ] **Step 7: コミット**

```bash
git add app/api/song/approve-structure/route.ts
git commit -m "fix: ASR不能時に qualityUnavailable=true を設定し再生成暴走を防止"
```

---

## Task 5: `approve-structure/route.ts` — attempt2 失敗時の明示ログ追加

**Files:**
- Modify: `app/api/song/approve-structure/route.ts:334-358`

- [ ] **Step 1: attempt2 の開始・成功・失敗・採用結果のログを追加する**

`shouldRegenerate` ブロック全体（L334〜358）を以下に置き換える。

**置き換え前（L334-358）:**
```typescript
  if (shouldRegenerate) {
    const regenReason = `qualityScore=${quality1.lyricsQualityScore} repeatScore=${quality1.repeatScore}`;
    console.log(`[Job ${jobId}] Auto-regenerating: ${regenReason}`);

    await updateJob(jobId, {
      status:             "regenerating_audio",
      generationAttempt:  2,
      regenerationReason: regenReason,
    });

    // ── Attempt 2: 強化された拘束プロンプトで再生成 ─────────────────────────
    const attempt2 = await generateAudioAttempt(job, apiKey, { attemptNum: 2, maxChorusRepeats: 1 });

    if (attempt2.audioAvailable) {
      const audioForAsr2 = attempt2.finalUrl ?? attempt2.rawUrl ?? null;
      if (audioForAsr2) {
        const quality2 = await runAsrAndQuality(job, apiKey, audioForAsr2);
        finalGate         = quality2.gate;
        usedFinalUrl      = attempt2.finalUrl;
        usedRawUrl        = attempt2.rawUrl;
        usedPostprocessOk = attempt2.postprocessOk;
        usedPreset        = (attempt2.preset as PostprocessPreset) || "natural";
      }
    }
    // attempt2 が失敗しても attempt1 の結果を使って続行
  }
```

**置き換え後:**
```typescript
  if (shouldRegenerate) {
    const regenReason = `qualityScore=${quality1.lyricsQualityScore} repeatScore=${quality1.repeatScore}`;
    console.log(`[Job ${jobId}] Auto-regenerating — reason: ${regenReason}`);

    await updateJob(jobId, {
      status:             "regenerating_audio",
      generationAttempt:  2,
      regenerationReason: regenReason,
    });

    // ── Attempt 2: 強化された拘束プロンプトで再生成 ─────────────────────────
    console.log(`[Job ${jobId}] attempt2 started`);
    const attempt2 = await generateAudioAttempt(job, apiKey, { attemptNum: 2, maxChorusRepeats: 1 });

    if (!attempt2.audioAvailable) {
      console.warn(`[Job ${jobId}] attempt2 generation failed — falling back to attempt1 results`);
      // attempt1 の usedFinalUrl / usedRawUrl はそのまま維持
    } else {
      const audioForAsr2 = attempt2.finalUrl ?? attempt2.rawUrl ?? null;
      if (audioForAsr2) {
        console.log(`[Job ${jobId}] attempt2 audio available — running ASR quality check`);
        const quality2 = await runAsrAndQuality(job, apiKey, audioForAsr2);
        if (!quality2.qualityUnavailable) {
          console.log(`[Job ${jobId}] attempt2 quality: score=${quality2.lyricsQualityScore} repeat=${quality2.repeatScore} gate=${quality2.gate} — adopting attempt2`);
          finalGate         = quality2.gate;
          usedFinalUrl      = attempt2.finalUrl;
          usedRawUrl        = attempt2.rawUrl;
          usedPostprocessOk = attempt2.postprocessOk;
          usedPreset        = (attempt2.preset as PostprocessPreset) || "natural";
        } else {
          console.warn(`[Job ${jobId}] attempt2 ASR unavailable — falling back to attempt1 results`);
        }
      } else {
        console.warn(`[Job ${jobId}] attempt2 no audio URL for ASR — falling back to attempt1 results`);
      }
    }

    const selectedAttempt = (usedFinalUrl === attempt2.finalUrl || usedRawUrl === attempt2.rawUrl) ? 2 : 1;
    console.log(`[Job ${jobId}] final selected attempt=${selectedAttempt} finalGate=${finalGate}`);
  }
```

- [ ] **Step 2: ビルドチェック**

```bash
npm run build 2>&1 | tail -30
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/api/song/approve-structure/route.ts
git commit -m "fix: attempt2 失敗時の明示ログ追加・採用 attempt 番号を記録"
```

---

## Task 6: `approve-structure/route.ts` — R2 未保存時 completed 禁止

**Files:**
- Modify: `app/api/song/approve-structure/route.ts:361-401`

- [ ] **Step 1: R2 upload が両方 null のとき `finalStatus` を強制的に `review_required` にする**

`runAudioPipeline` の最終ステータス決定ブロックを修正する。

**置き換え前（L361-367）:**
```typescript
  // ── Phase 6: completed / review_required 決定 ────────────────────────────
  const currentJob = await getJob(jobId);
  const rawAudioUrl = currentJob?.rawAudioUrl ?? usedRawUrl ?? undefined;

  const finalStatus = (finalGate === "pass" || finalGate === "review")
    ? "completed"
    : "review_required";
```

**置き換え後:**
```typescript
  // ── Phase 6: completed / review_required 決定 ────────────────────────────
  const currentJob = await getJob(jobId);
  const rawAudioUrl = currentJob?.rawAudioUrl ?? usedRawUrl ?? undefined;

  const hasAudioUrl = !!(usedFinalUrl ?? usedRawUrl ?? rawAudioUrl);

  // 音源URLが存在しない場合は completed にしない
  if (!hasAudioUrl) {
    console.error(`[Job ${jobId}] No audio URL available — forcing review_required instead of completed`);
  }

  const finalStatus = hasAudioUrl && (finalGate === "pass" || finalGate === "review")
    ? "completed"
    : "review_required";

  console.log(`[Job ${jobId}] finalStatus=${finalStatus} hasAudioUrl=${hasAudioUrl} gate=${finalGate}`);
```

- [ ] **Step 2: ビルドチェック**

```bash
npm run build 2>&1 | tail -30
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/api/song/approve-structure/route.ts
git commit -m "fix: R2 upload が両方 null のとき completed を禁止し review_required に落とす"
```

---

## 最終確認

- [ ] **全ビルドが通ることを確認**

```bash
npm run build 2>&1 | tail -50
```

期待: `✓ Compiled` が出てエラーなし

- [ ] **変更ファイル一覧確認**

```bash
git log --oneline -6
```

期待: Task 1〜6 の6コミットが並ぶこと

---

## テスト観点

実装後、以下のシナリオで動作確認すること。

| # | シナリオ | 期待動作 |
|---|----------|----------|
| 1 | ASR URL なし（ElevenLabs は成功、R2 URL なし） | `qualityUnavailable=true`・再生成なし・review_required |
| 2 | ASR 例外 | `qualityUnavailable=true`・再生成なし・lyricsGateResult=null |
| 3 | singableLyrics あり → `/start` 呼び出し | `displayLyrics === singableLyrics`、ログに `displaySource=singable` |
| 4 | singableLyrics 空 → `/start` 呼び出し | `displayLyrics === masterLyrics`、ログに `displaySource=master` |
| 5 | attempt2 生成失敗 | ログに `attempt2 generation failed — falling back to attempt1` |
| 6 | attempt2 ASR 不能 | ログに `attempt2 ASR unavailable — falling back to attempt1` |
| 7 | rawUrl も finalUrl も null | `completed` にならず `review_required` |
| 8 | `result` API 呼び出し | `displayLyrics` フィールドが singable 由来になっている |
| 9 | `approve-lyrics` 呼び出し | hookSummary に正しく保存される |
