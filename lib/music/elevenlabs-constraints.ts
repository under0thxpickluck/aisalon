// lib/music/elevenlabs-constraints.ts
// ElevenLabs 歌詞拘束プロンプト生成

/**
 * ElevenLabs に渡す歌詞拘束プロンプトの追記部分を生成する。
 * buildElevenLabsPrompt / buildElevenLabsProPrompt の末尾に連結して使用する。
 */
export function buildLyricsConstraintPrompt(params: {
  anchorWords?: string[];
  hookLines?: string[];
  maxChorusRepeats?: number;
}): string {
  const { anchorWords = [], hookLines = [], maxChorusRepeats = 2 } = params;

  const parts: string[] = [];

  // 最優先: 歌詞を守る
  parts.push("PRIORITY: strict lyrics adherence");
  parts.push("do not add new phrases beyond the specified lyrics");
  parts.push("do not replace any lyrics with different meanings");

  // hookLines 拘束（最重要）
  if (hookLines.length > 0) {
    const hookStr = hookLines.slice(0, 4).join(" / ");
    parts.push(`chorus hook lines must be sung exactly as written: "${hookStr}"`);
  }

  // セクション順序を守る
  parts.push("maintain section order strictly: intro -> verse -> chorus -> outro");
  parts.push("respect section boundaries");

  // anchorWords 拘束
  if (anchorWords.length > 0) {
    const wordList = anchorWords.slice(0, 10).join(", ");
    parts.push(`preserve these key lyric words: ${wordList}`);
  }

  // 反復制限
  parts.push(`chorus repeats maximum ${maxChorusRepeats} times`);
  parts.push("do not repeat identical phrases consecutively outside of chorus");
  parts.push("each verse line must be treated as a distinct unique line");

  // アドリブ禁止
  parts.push("no ad-libs, no improvised vocalizations, no filler phrases");

  return parts.join(", ");
}
