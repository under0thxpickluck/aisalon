// ElevenLabs Scribe を使った音声書き起こし

import { createHash } from "node:crypto";

export type AsrResult = {
  text: string;
  timestampsJson: string;   // JSON文字列（words配列）
  words?: unknown[];
};

export async function transcribeSongLyrics(params: {
  audioUrl: string;         // R2の公開URL
  languageHint?: string;    // "ja" 等（未指定なら自動検出）
  apiKey: string;
}): Promise<AsrResult> {
  // 1. R2からaudioをダウンロード (ArrayBuffer)
  console.log(`[asr] fetching audio: ${params.audioUrl}`);
  const audioResponse = await fetch(params.audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
  }
  const arrayBuffer = await audioResponse.arrayBuffer();

  // ── ファイル識別ログ ──────────────────────────────────────────────────────
  const sha256 = createHash("sha256").update(Buffer.from(arrayBuffer)).digest("hex");
  const contentType = audioResponse.headers.get("content-type") ?? "unknown";
  const urlBasename = params.audioUrl.split("/").pop()?.split("?")[0] ?? "unknown";
  console.log(`[asr] file: name=${urlBasename} size=${arrayBuffer.byteLength} mime=${contentType} sha256=${sha256}`);

  // 2. FormDataにaudioを添付してScribeへPOST
  // mime は URL の拡張子から判定
  const isWav = urlBasename.endsWith(".wav");
  const mimeType = isWav ? "audio/wav" : "audio/mpeg";
  const fileName = isWav ? "audio.wav" : "audio.mp3";
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("model_id", "scribe_v2");
  formData.append("timestamps_granularity", "word");
  formData.append("tag_audio_events", "true");
  formData.append("no_verbatim", "false");
  // language_code は送らない（UI と同様に自動検出）
  // languageHint が明示指定された場合のみ送る
  if (params.languageHint) {
    formData.append("language_code", params.languageHint);
  }

  console.log(`[asr] request: model=scribe_v2 file=${fileName} mime=${mimeType} lang=${params.languageHint ?? "auto"} tag_audio_events=true no_verbatim=false`);

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

    const data = await response.json() as {
      text?: string;
      transcript?: string;
      words?: unknown[];
      language_code?: string;
      language_probability?: number;
    };

    // ── APIレスポンス生ログ ────────────────────────────────────────────────
    const text = typeof data.text === "string" ? data.text
               : typeof data.transcript === "string" ? data.transcript
               : "";
    console.log(`[asr] response: lang=${data.language_code ?? "?"} lang_prob=${data.language_probability ?? "?"} words=${data.words?.length ?? 0} textLen=${text.length}`);
    console.log(`[asr] response.text (first 300): ${text.slice(0, 300)}`);

    const words = data.words ?? [];
    const trimmedWords = words.length > 1000 ? (words as unknown[]).slice(0, 1000) : words;
    return {
      text,
      timestampsJson: JSON.stringify(trimmedWords),
      words: trimmedWords,
    };
  } finally {
    clearTimeout(timeoutId);
  }
  // 5. エラー時は例外をthrow（呼び出し側でcatch）
}
