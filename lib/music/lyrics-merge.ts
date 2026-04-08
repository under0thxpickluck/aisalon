// lib/music/lyrics-merge.ts

import { finalizeDisplayLyrics, buildDisplayLyricsFromTimestamps } from "./lyrics-display";

export type MergeResult = {
  displayLyrics: string;
  distributionLyrics: string;
  mergedLyrics: string;
  reviewRequired: boolean;
  distributionReady: boolean;
  lyricsSource: "singable" | "asr_merged" | "manual";
  lyricsGateResult: "pass" | "review" | "reject";
};

/**
 * ASR スコアと反復スコアをもとに displayLyrics / distributionLyrics を決定する。
 *
 * Case A (score >= 90, repeatScore < 15): 高品質
 *   displayLyrics = singableLyrics, distributionLyrics = singableLyrics
 *
 * Case B (80 <= score < 90): 軽微ずれ
 *   displayLyrics = mergedLyrics, distributionLyrics = mergedLyrics
 *
 * Case C (65 <= score < 80): 中程度ずれ
 *   displayLyrics = mergedLyrics, distributionLyrics = "" (配信不可)
 *
 * Case D (score < 65 または repeatScore >= 35): 重度ずれ・強反復
 *   displayLyrics = singableLyrics, distributionLyrics = "" (配信不可)
 */
export function mergeLyricsForDisplay(params: {
  singableLyrics: string;
  asrLyrics: string;
  score: number;
  repeatScore?: number;
  anchorWords?: string[];
  hookLines?: string[];
  jobId?: string;
  timestampsJson?: string;
}): MergeResult {
  const { singableLyrics, asrLyrics, score, repeatScore = 0, jobId, timestampsJson } = params;

  // merged の生成: singable と asr を行単位でブレンド
  const mergedLyrics = buildMergedLyrics(singableLyrics, asrLyrics, score);

  // displayLyrics: timestamps ベース再構築を優先し、失敗時は既存ロジックへフォールバック
  const tag = jobId ? `[merge][jobId=${jobId}]` : "[merge]";
  let displayLyrics: string;
  let lyricsSource: "singable" | "asr_merged" | "manual";

  if (timestampsJson) {
    const tsDisplay = buildDisplayLyricsFromTimestamps(timestampsJson, singableLyrics);
    if (tsDisplay && tsDisplay.trim().length > 0) {
      displayLyrics = tsDisplay;
      lyricsSource  = "asr_merged";
      console.log(`${tag} displayLyrics=timestamps len=${tsDisplay.length}`);
    } else {
      const fallback = finalizeDisplayLyrics(singableLyrics, asrLyrics, jobId);
      displayLyrics  = fallback.displayLyrics;
      lyricsSource   = fallback.lyricsSource;
      console.log(`${tag} displayLyrics=fallback(textMerge) reason=timestamps_empty`);
    }
  } else {
    const fallback = finalizeDisplayLyrics(singableLyrics, asrLyrics, jobId);
    displayLyrics  = fallback.displayLyrics;
    lyricsSource   = fallback.lyricsSource;
    console.log(`${tag} displayLyrics=fallback(textMerge) reason=no_timestamps`);
  }

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
}

/**
 * singableLyrics と asrLyrics を行単位でブレンドして mergedLyrics を生成する。
 * スコアが高いほど singable を優先し、低いほど asr をそのまま使う。
 */
function buildMergedLyrics(singable: string, asr: string, score: number): string {
  if (!singable && !asr) return "";
  if (!asr) return singable;
  if (!singable) return asr;

  const singableLines = splitLyricLines(singable);
  const asrLines      = splitLyricLines(asr);

  // スコアが高い場合は singable 優先、低い場合は asr 優先
  if (score >= 80) {
    // singable をベースに、セクションタグは singable から取る
    return singable;
  }

  // score 65〜80: 行数の多い方をベース、セクションタグは singable から取る
  const singableSections = extractSectionStructure(singable);
  const merged: string[] = [];
  let asrIdx = 0;

  for (const { tag, lines } of singableSections) {
    if (tag) merged.push(tag);
    for (let i = 0; i < lines.length; i++) {
      // セクション内の対応するASR行があれば使う
      if (asrIdx < asrLines.length && !asrLines[asrIdx].startsWith("[")) {
        merged.push(asrLines[asrIdx]);
        asrIdx++;
      } else {
        merged.push(lines[i]);
      }
    }
  }

  return merged.join("\n") || singable;
}

/** セクションタグと行を分けて構造化する */
function extractSectionStructure(lyrics: string): Array<{ tag: string; lines: string[] }> {
  const result: Array<{ tag: string; lines: string[] }> = [];
  let currentTag = "";
  let currentLines: string[] = [];

  for (const line of lyrics.split("\n")) {
    const trimmed = line.trim();
    if (/^\[/.test(trimmed)) {
      if (currentTag || currentLines.length > 0) {
        result.push({ tag: currentTag, lines: currentLines });
      }
      currentTag = trimmed;
      currentLines = [];
    } else if (trimmed.length > 0) {
      currentLines.push(trimmed);
    }
  }

  if (currentTag || currentLines.length > 0) {
    result.push({ tag: currentTag, lines: currentLines });
  }

  return result;
}

/** 歌詞を行単位で分割（空行・セクションタグを含む） */
function splitLyricLines(lyrics: string): string[] {
  return lyrics.split("\n").map(l => l.trim()).filter(l => l.length > 0);
}
