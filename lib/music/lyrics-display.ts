// lib/music/lyrics-display.ts
// singableLyrics と asrLyrics を行単位でマージして displayLyrics を確定する。
// 「比較用正規化」と「表示向け正規化」は明確に分離している。
// normalizeAsrLineForDisplay は表示向け軽整形のみで情報を削りすぎない。

const SIMILARITY_THRESHOLD_DEFAULT = 0.68;
const SIMILARITY_THRESHOLD_SHORT   = 0.82; // singable 行が 4 文字以内の場合
const SHORT_LINE_MAX_LEN           = 4;
const WINDOW_HALF                  = 3;
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
  if (t.length < 4)        return true; // 極端に短い
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

    // ASR行が元行の35%未満の長さなら切り捨て（短すぎるASR結果が置き換わるのを防ぐ）
    const lengthRatioOk =
      bestIdx >= 0 && asrLines[bestIdx].length >= trimmed.length * 0.35;

    const shouldAdopt =
      bestIdx >= 0 &&
      bestSim >= threshold &&
      !isNoiseLine(asrLines[bestIdx]) &&
      lengthRatioOk;

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

// ── タイムスタンプから displayLyrics を再構築 ─────────────────────────────────

type TimestampWord = {
  type: "word" | "spacing" | "audio_event";
  text: string;
  start?: number;
  end?: number;
  logprob?: number;
};

const GAP_THRESHOLD_SEC  = 1.4;  // この秒数以上の無音で改行
const MIN_LOGPROB        = -3.0; // これ未満の確信度は除外
const SRC_CORRECT_THRESH = 0.70; // 元歌詞を採用する類似度の閾値

// 捨てる audio_event（歌・ボーカルを示すもの）
const DISCARD_EVENT = /^\[(歌|song|music|vocal|speech)\]$/i;
// 保持する audio_event（間奏・インスト）
const KEEP_EVENT    = /^\[(間奏|ギターソロ|ソロ|instrumental|interlude)\]$/i;

/**
 * lyrics_timestamps_json から displayLyrics を再構築する。
 * 失敗時は null を返す（呼び出し側でフォールバック）。
 */
export function buildDisplayLyricsFromTimestamps(
  timestampsJson: string,
  sourceLyrics?: string,
  jobId?: string
): string | null {
  const tag = jobId ? `[timestamps][jobId=${jobId}]` : "[timestamps]";

  let tokens: TimestampWord[];
  try {
    const parsed = JSON.parse(timestampsJson);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log(`${tag} parse_failed_or_empty parsed=${JSON.stringify(parsed)?.slice(0, 80)}`);
      return null;
    }
    tokens = parsed as TimestampWord[];
  } catch (e) {
    console.log(`${tag} parse_error err=${String(e).slice(0, 80)}`);
    return null;
  }

  // ── 1. token 件数 ──────────────────────────────────────────────────────────
  const wordCount    = tokens.filter(t => t?.type === "word").length;
  const spacingCount = tokens.filter(t => t?.type === "spacing").length;
  const eventCount   = tokens.filter(t => t?.type === "audio_event").length;
  console.log(`${tag} parsed tokens=${tokens.length} word=${wordCount} spacing=${spacingCount} event=${eventCount}`);

  const lines: string[] = [];
  let currentWords: string[] = [];
  let prevEnd: number | null = null;
  let removedLowLogprobCount = 0;
  let keptWordCount = 0;

  const flushLine = () => {
    const raw        = currentWords.join("");
    const normalized = raw.trim();
    console.log(`${tag} flush_enter type=array raw_len=${raw.length} normalized_len=${normalized.length} preview="${normalized.slice(0, 40)}"`);

    if (normalized.length === 0) {
      console.log(`${tag} flush_skip reason=empty`);
      currentWords = [];
      console.log(`${tag} flush_exit currentLine_reset=true`);
      return;
    }
    if (/^[\s\W]+$/.test(normalized)) {
      console.log(`${tag} flush_skip reason=symbols_only`);
      currentWords = [];
      console.log(`${tag} flush_exit currentLine_reset=true`);
      return;
    }

    lines.push(normalized);
    console.log(`${tag} flush_push pushed_len=${normalized.length} lines_now=${lines.length}`);
    currentWords = [];
    console.log(`${tag} flush_exit currentLine_reset=true`);
  };

  // ── loop_start ────────────────────────────────────────────────────────────
  console.log(`${tag} loop_start words=${wordCount}`);
  let wordLogCount = 0;

  for (const token of tokens) {
    if (token.type === "spacing") continue;

    if (token.type === "audio_event") {
      const t = (token.text ?? "").trim();
      const currentPreview = currentWords.join("").slice(0, 40);
      if (KEEP_EVENT.test(t)) {
        flushLine();
        lines.push("[間奏]");
        console.log(`${tag} on_audio_event text="${t}" action=flush+push currentLine_preview="${currentPreview}" lines_now=${lines.length}`);
      } else {
        console.log(`${tag} on_audio_event text="${t}" action=discard currentLine_preview="${currentPreview}"`);
      }
      prevEnd = token.end ?? prevEnd;
      continue;
    }

    if (token.type === "word") {
      // logprob フィルタ（極端に低い確信度のみ除外）
      if (typeof token.logprob === "number" && token.logprob < MIN_LOGPROB) {
        removedLowLogprobCount++;
        prevEnd = token.end ?? prevEnd;
        continue;
      }
      // 長い無音で改行
      if (prevEnd !== null && token.start != null && token.start - prevEnd >= GAP_THRESHOLD_SEC) {
        const gapSec = (token.start - prevEnd).toFixed(2);
        const linePreview = currentWords.join("").slice(0, 40);
        const lineLenBefore = currentWords.length;
        flushLine();
        console.log(`${tag} on_gap_break gapSec=${gapSec} currentLine_preview="${linePreview}" currentLine_len_before=${lineLenBefore} lines_now=${lines.length}`);
      }
      // each_word: 最初の5件のみ
      if (wordLogCount < 5) {
        console.log(`${tag} each_word[${wordLogCount}] text="${token.text}" start=${token.start} end=${token.end} type=${token.type} currentLine_len_before=${currentWords.length} currentLine_len_after=${currentWords.length + 1}`);
      }
      currentWords.push(token.text);
      keptWordCount++;
      wordLogCount++;
      prevEnd = token.end ?? prevEnd;
    }
  }

  // ── after_loop_before_flush ───────────────────────────────────────────────
  console.log(`${tag} after_loop_before_flush currentLine_len=${currentWords.length} currentLine_preview="${currentWords.join("").slice(0, 60)}"`);
  flushLine();
  // ── after_final_flush ─────────────────────────────────────────────────────
  console.log(`${tag} after_final_flush lines=${lines.length} preview=${lines.slice(0, 8).join(" | ")}`);

  // ── 2. low logprob 除外件数 ────────────────────────────────────────────────
  console.log(`${tag} low_logprob_removed=${removedLowLogprobCount} kept_words=${keptWordCount}`);

  // ── 3. 行組み立て結果（cleanup前 = cleanup後 = lines） ──────────────────────
  console.log(`${tag} before_cleanup lines=${lines.length} preview=${lines.slice(0, 8).join(" | ")}`);

  if (lines.length === 0) {
    console.log(`${tag} lines_empty → return null`);
    return null;
  }

  // ── 4. sourceLyrics 補正 ───────────────────────────────────────────────────
  if (!sourceLyrics || sourceLyrics.trim().length === 0) {
    const result = lines.join("\n");
    console.log(`${tag} no_source_lyrics final_join len=${result.length} preview=${result.slice(0, 160)}`);
    return result;
  }

  console.log(`${tag} before_source_correct lines=${lines.length} preview=${lines.slice(0, 8).join(" | ")}`);
  const corrected = applySourceCorrection(lines, sourceLyrics);
  const correctedLines = corrected.split("\n");
  console.log(`${tag} after_source_correct lines=${correctedLines.length} preview=${correctedLines.slice(0, 8).join(" | ")}`);

  console.log(`${tag} final_join len=${corrected.length} preview=${corrected.slice(0, 160)}`);
  return corrected;
}

/** timestamps 由来の各行を元歌詞と近傍照合し、高信頼時のみ元歌詞表記を採用する */
function applySourceCorrection(tsLines: string[], sourceLyrics: string): string {
  const srcLines = sourceLyrics
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^\[.*\]$/.test(l)); // セクションタグ除外

  return tsLines.map(tsLine => {
    if (/^\[.*\]$/.test(tsLine)) return tsLine; // [間奏] 等はそのまま

    let bestSim = 0;
    let bestSrc = tsLine;
    for (const src of srcLines) {
      const sim = bigramJaccardLine(tsLine, src);
      if (sim > bestSim) { bestSim = sim; bestSrc = src; }
    }
    // 高信頼: 元歌詞の表記を採用 / 低信頼: timestamps 由来をそのまま使う
    return bestSim >= SRC_CORRECT_THRESH ? bestSrc : tsLine;
  }).join("\n");
}

// ── シンプル直列変換（デバッグ用最短ルート）─────────────────────────────────────
// word を順番に連結するだけ。フィルタ・補正・ギャップ改行なし。
// "間奏" を含む audio_event のみ "\n[間奏]\n" を挿入する。

export function displayLyricsFromTimestampsRaw(timestampsJson: string): string {
  let tokens: Array<{ type?: string; text?: string }>;
  try {
    const parsed = JSON.parse(timestampsJson);
    if (!Array.isArray(parsed)) return "";
    tokens = parsed;
  } catch {
    return "";
  }

  let result = "";
  for (const token of tokens) {
    const type = String(token?.type ?? "");
    const text = String(token?.text ?? "");

    if (type === "spacing") continue;

    if (type === "audio_event") {
      if (text.includes("間奏")) result += "\n[間奏]\n";
      continue;
    }

    if (type === "word") {
      result += text;
    }
  }

  return result.trim();
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
