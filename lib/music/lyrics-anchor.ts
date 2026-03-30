// lib/music/lyrics-anchor.ts
// masterLyrics から意味的に重要な anchorWords を抽出する

/**
 * masterLyrics から歌詞の意味拘束用キーワードを抽出する。
 * - タイトル語
 * - hookSummary の中核語
 * - Chorus の語
 * - テーマ語
 */
export function extractAnchorWords(params: {
  title: string;
  hookSummary: string;
  masterLyrics: string;
  theme?: string;
}): string[] {
  const { title, hookSummary, masterLyrics, theme } = params;
  const candidates = new Set<string>();

  // タイトル語を分割して追加
  splitWords(title).forEach(w => candidates.add(w));

  // hookSummary の中核語
  splitWords(hookSummary).forEach(w => candidates.add(w));

  // テーマ語
  if (theme) splitWords(theme).forEach(w => candidates.add(w));

  // Chorus セクションから語を抽出
  const chorusLines = extractChorusLines(masterLyrics);
  chorusLines.forEach(line => {
    splitWords(line).forEach(w => candidates.add(w));
  });

  // フィルタリング: 短すぎる語、ひらがな2文字以下（助詞など）は除外
  return Array.from(candidates).filter(w => {
    if (w.length < 2) return false;
    // ひらがなのみの2文字以下は除外（助詞など）
    if (w.length <= 2 && /^[\u3041-\u3096]+$/.test(w)) return false;
    return true;
  });
}

/** テキストを意味のある単位で分割する */
function splitWords(text: string): string[] {
  if (!text) return [];
  // セクションタグ除去
  const cleaned = text.replace(/\[.*?\]/g, "").trim();
  // 記号・空白で分割し、2文字以上の塊を返す
  return cleaned
    .split(/[\s　、。！？「」『』・…\-\n]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);
}

/** masterLyrics から [Chorus] セクションの行を抽出 */
function extractChorusLines(masterLyrics: string): string[] {
  const lines = masterLyrics.split("\n");
  const result: string[] = [];
  let inChorus = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\[Chorus\]/i.test(trimmed)) {
      inChorus = true;
      continue;
    }
    // 最初の Chorus だけ対象にする
    if (/^\[/.test(trimmed) && inChorus) {
      break;
    }
    if (/^\[/.test(trimmed)) {
      inChorus = false;
      continue;
    }
    if (inChorus && trimmed.length > 0) {
      result.push(trimmed);
    }
  }

  return result;
}
