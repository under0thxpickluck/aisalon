// lib/music/lyrics-singable.ts
// master_lyrics を ElevenLabs に渡すための「歌いやすい歌詞」に変換する

/**
 * OpenAI を使ってマスター歌詞を歌いやすい形に変換する。
 *
 * 変換方針: 意味保持優先 + 発音補助
 * - hookLines は原文維持率 95% 以上
 * - anchorWords は 80% 以上保持
 * - 意味の異なる語への置換・主題変更は禁止
 * - BPM に応じた音節ガイドを遵守
 */
export async function buildSingableLyrics(params: {
  masterLyrics: string;
  bpm?: number;
  genre?: string;
  mood?: string;
  anchorWords?: string[];
  hookLines?: string[];
  apiKey: string;
}): Promise<string> {
  const { masterLyrics, bpm, genre, mood, anchorWords = [], hookLines = [], apiKey } = params;

  const contextHint = [
    bpm   ? `BPM: ${bpm}`       : "",
    genre ? `ジャンル: ${genre}` : "",
    mood  ? `雰囲気: ${mood}`    : "",
  ].filter(Boolean).join("、");

  // BPM 別音節ガイド
  const syllableGuide = bpm
    ? bpm <= 90
      ? "1行あたり 8〜12 音節"
      : bpm <= 115
      ? "1行あたり 10〜14 音節"
      : bpm <= 140
      ? "1行あたり 8〜12 音節"
      : "1行あたり 6〜10 音節"
    : "1行あたり 8〜14 音節";

  const anchorConstraint = anchorWords.length > 0
    ? `\n\n【保持必須キーワード（80%以上を維持すること）】\n${anchorWords.join("、")}`
    : "";

  const hookConstraint = hookLines.length > 0
    ? `\n\n【サビ固定行（原文から95%以上変更禁止）】\n${hookLines.join("\n")}`
    : "";

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `あなたはAI音楽生成の専門家です。日本語の歌詞を「歌いやすい形」に変換してください。

## 最重要原則: 意味保持優先
元歌詞の意味・主題・世界観を必ず保持してください。発音しやすさは補助的な調整に留めてください。

## 許可する変換
1. 難読語だけひらがな補助（例：「憂鬱」→「ゆううつ」）
2. 長すぎる1行を2行へ分割
3. 語尾の軽微な調整（「〜している」→「〜してる」）
4. 句読点・記号の除去
5. ${syllableGuide}（BPMに合わせたリズム調整）

## 絶対禁止
1. 意味の異なる語への置換
2. 主題・テーマの変更
3. サビ固定行（hookLines）の書き換え
4. 保持必須キーワード（anchorWords）の削除
5. Verse内容の過度な要約や省略
6. 全文ひらがな化（漢字は適切に残す）
7. 新しいフレーズの追加

## 出力形式
変換後の歌詞のみ出力し、説明は不要。セクション構造（[Verse A] 等）は必ず保持してください。`,
          },
          {
            role: "user",
            content: `以下の歌詞を歌いやすい形に変換してください。${contextHint ? `\n\n楽曲情報: ${contextHint}` : ""}${anchorConstraint}${hookConstraint}\n\n歌詞:\n${masterLyrics}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`openai_error_${res.status}: ${errText}`);
    }

    const data = await res.json();
    const result = String(data?.choices?.[0]?.message?.content ?? "").trim();

    // フォールバック：変換に失敗した場合はマスター歌詞をそのまま返す
    return result || masterLyrics;
  } catch (e: any) {
    console.warn("[buildSingableLyrics] failed, using master:", e?.message);
    return masterLyrics;
  } finally {
    clearTimeout(t);
  }
}
