// lib/music/lyrics-singable.ts
// master_lyrics を ElevenLabs に渡すための「歌いやすい歌詞」に変換する

/**
 * OpenAI を使ってマスター歌詞を歌いやすい形に変換する。
 * - 1行あたりのシラブル数を減らす
 * - 促音・長音・複合漢字など歌いにくい表現を平易に変換
 * - BPM・ジャンルを考慮したリズムに合わせる
 * - セクション構造（[Verse] 等）は保持する
 */
export async function buildSingableLyrics(params: {
  masterLyrics: string;
  bpm?: number;
  genre?: string;
  mood?: string;
  apiKey: string;
}): Promise<string> {
  const { masterLyrics, bpm, genre, mood, apiKey } = params;

  const contextHint = [
    bpm   ? `BPM: ${bpm}`     : "",
    genre ? `ジャンル: ${genre}` : "",
    mood  ? `雰囲気: ${mood}`    : "",
  ].filter(Boolean).join("、");

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

変換ルール：
1. 促音（っ）・長音（ー）の多用は避け、母音が流れやすいように調整する
2. 複雑な漢字熟語は読みやすいひらがな・カタカナ表現に変換する
3. 1行あたりのシラブル数を12〜16に収める（BPMに合わせてリズムが乗りやすくする）
4. 子音の連続（例：「ストリート」「スプリング」）は避け、母音で終わる音節を優先する
5. セクション構造（[Verse A]・[Chorus] 等）は必ず保持する
6. 意味はできるだけ原文に近づけるが、発音しやすさを最優先にする
7. 変換後の歌詞のみ出力し、説明は不要`,
          },
          {
            role: "user",
            content: `以下の歌詞を歌いやすい形に変換してください。${contextHint ? `\n\n楽曲情報: ${contextHint}` : ""}\n\n歌詞:\n${masterLyrics}`,
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
