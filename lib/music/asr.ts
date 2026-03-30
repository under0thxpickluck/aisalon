// ElevenLabs Scribe を使った音声書き起こし

export type AsrResult = {
  text: string;
  timestampsJson: string;   // JSON文字列（words配列）
  words?: unknown[];
};

export async function transcribeSongLyrics(params: {
  audioUrl: string;         // R2の公開URL
  languageHint?: string;    // "ja" 等
  apiKey: string;
}): Promise<AsrResult> {
  // 1. R2からaudioをダウンロード (ArrayBuffer)
  const audioResponse = await fetch(params.audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
  }
  const arrayBuffer = await audioResponse.arrayBuffer();

  // 2. FormDataにaudioを添付してScribeへPOST
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const formData = new FormData();
  formData.append("file", blob, "audio.mp3");
  formData.append("model_id", "scribe_v1");
  formData.append("timestamps_granularity", "word");
  formData.append("language_code", params.languageHint ?? "ja");

  // 3. レスポンスの text と words を返す
  // 4. タイムアウト: 60秒
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": params.apiKey,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${text}`);
    }

    const data = await response.json() as { text: string; words?: unknown[] };

    const words = data.words ?? [];
    const trimmedWords = words.length > 1000 ? (words as unknown[]).slice(0, 1000) : words;
    return {
      text: data.text,
      timestampsJson: JSON.stringify(trimmedWords),
      words: trimmedWords,
    };
  } finally {
    clearTimeout(timeoutId);
  }
  // 5. エラー時は例外をthrow（呼び出し側でcatch）
}
