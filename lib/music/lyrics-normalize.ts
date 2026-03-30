// lib/music/lyrics-normalize.ts
// 歌詞テキストを比較用に正規化する

export function normalizeLyricsForCompare(text: string): string {
  let normalized = text;

  // 1. [Verse], [Chorus] 等のセクションタグを除去
  normalized = normalized.replace(/\[.*?\]/g, "");

  // 2. 全角→半角（英数字のみ）
  normalized = normalized.replace(/[\uFF01-\uFF5E]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
  // 全角スペース（\u3000）を半角スペースに
  normalized = normalized.replace(/\u3000/g, " ");

  // 3. 大文字→小文字
  normalized = normalized.toLowerCase();

  // 4. 句読点・記号除去（。、！？!?,.）
  normalized = normalized.replace(/[。、！？!?,.\-\(\)「」『』【】・…～〜]/g, "");

  // 5. 連続空白・改行を単一スペースに
  normalized = normalized.replace(/[\s\n\r]+/g, " ");

  // 6. trim
  normalized = normalized.trim();

  return normalized;
}

export function splitIntoLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
