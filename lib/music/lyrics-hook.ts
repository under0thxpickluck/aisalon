// lib/music/lyrics-hook.ts
// masterLyrics から hookLines（サビ固定行）を抽出する

/**
 * masterLyrics の [Chorus] セクションから 2〜4 行を hookLines として抽出する。
 * これらは ElevenLabs 生成時に絶対保持したい行として使用する。
 */
export function extractHookLines(masterLyrics: string): string[] {
  const lines = masterLyrics.split("\n");
  const chorusLines: string[] = [];
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
      chorusLines.push(trimmed);
    }
  }

  // 2〜4 行を返す（最初の 4 行まで）
  return chorusLines.slice(0, 4);
}
