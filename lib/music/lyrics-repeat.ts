// lib/music/lyrics-repeat.ts
// ASR 歌詞の反復検知

export type RepetitionResult = {
  repeatDetected: boolean;
  repeatScore: number; // 0-100、高いほど問題あり
  repeatSegments: Array<{
    text: string;
    count: number;
    start?: number;
    end?: number;
    section?: string;
  }>;
};

/**
 * ASR 書き起こし歌詞から不自然な反復を検知する。
 * Chorus の自然な反復は許容し、それ以外を罰する。
 *
 * 判定基準:
 * - repeatScore < 15  : 正常
 * - repeatScore 15-34 : 注意
 * - repeatScore 35-59 : 要レビュー
 * - repeatScore >= 60 : 自動再生成候補
 */
export function detectRepetition(params: {
  asrLyrics: string;
  timestamps?: unknown;
  chorusLines?: string[];
}): RepetitionResult {
  const { asrLyrics, chorusLines = [] } = params;

  if (!asrLyrics || asrLyrics.trim().length === 0) {
    return { repeatDetected: false, repeatScore: 0, repeatSegments: [] };
  }

  const lines = asrLyrics
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^\[/.test(l)); // セクションタグ除外

  const chorusSet = new Set(
    chorusLines.map(l => normalizeForRepeat(l)).filter(l => l.length > 0)
  );

  const repeatSegments: RepetitionResult["repeatSegments"] = [];
  let totalPenalty = 0;

  // --- ルール1: 同一行が連続2回以上 ---
  const lineFreq = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeForRepeat(lines[i]);
    if (norm.length < 3) continue;

    lineFreq.set(norm, (lineFreq.get(norm) ?? 0) + 1);

    // 連続出現チェック
    if (i > 0 && normalizeForRepeat(lines[i - 1]) === norm) {
      const isChorus = chorusSet.has(norm);
      if (!isChorus) {
        totalPenalty += 20;
        const existing = repeatSegments.find(s => normalizeForRepeat(s.text) === norm);
        if (existing) {
          existing.count++;
        } else {
          repeatSegments.push({ text: lines[i], count: 2 });
        }
      }
    }
  }

  // --- ルール2: 6文字以上の同一 n-gram が2回以上（Chorus以外） ---
  const ngramPenalty = detectNgramRepetition(lines, chorusSet);
  totalPenalty += ngramPenalty;

  // --- ルール3: Chorus以外で同一行の再出現率が20%超 ---
  lineFreq.forEach((count, norm) => {
    if (count >= 2) {
      const isChorus = chorusSet.has(norm);
      if (!isChorus) {
        const rate = count / lines.length;
        if (rate > 0.20) {
          const penalty = Math.min(30, Math.round(rate * 60));
          totalPenalty += penalty;
          const originalLine = lines.find(l => normalizeForRepeat(l) === norm) ?? norm;
          if (!repeatSegments.find(s => normalizeForRepeat(s.text) === norm)) {
            repeatSegments.push({ text: originalLine, count });
          }
        }
      }
    }
  });

  const repeatScore = Math.min(100, Math.max(0, Math.round(totalPenalty)));
  const repeatDetected = repeatScore >= 15;

  return { repeatDetected, repeatScore, repeatSegments };
}

/** 反復検知用の正規化（ひらがな・カタカナ・漢字・英数字のみ残す） */
function normalizeForRepeat(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\u3040-\u30ff\u4e00-\u9fff\uff00-\uffefa-z0-9]/g, "")
    .trim();
}

/** n-gram（6文字以上）の連続反復ペナルティを計算 */
function detectNgramRepetition(lines: string[], chorusSet: Set<string>): number {
  const MIN_NGRAM = 6;
  const seenNgrams = new Map<string, number>(); // ngram -> 出現回数
  let penalty = 0;

  for (const line of lines) {
    const norm = normalizeForRepeat(line);
    if (norm.length < MIN_NGRAM) continue;
    if (chorusSet.has(norm)) continue; // Chorus 行はスキップ

    // 代表的な長さだけチェック（全組み合わせは重いので上限設定）
    for (let len = MIN_NGRAM; len <= Math.min(norm.length, 15); len += 2) {
      for (let start = 0; start <= norm.length - len; start += 2) {
        const ngram = norm.slice(start, start + len);
        if (isFillerNgram(ngram)) continue;

        const prev = seenNgrams.get(ngram) ?? 0;
        seenNgrams.set(ngram, prev + 1);

        if (prev >= 1) {
          // 2回目以降の出現でペナルティ
          penalty += 5;
        }
      }
    }
  }

  return Math.min(40, penalty);
}

/** フィラー語・短い繰り返し音節の判定 */
function isFillerNgram(text: string): boolean {
  const fillers = ["oh", "yeah", "ah", "la", "na", "oo", "mm", "hey", "wow", "ooh", "aah"];
  const normalized = text.toLowerCase().trim();
  return fillers.some(f => normalized === f || normalized === f.repeat(2) || normalized === f.repeat(3));
}
