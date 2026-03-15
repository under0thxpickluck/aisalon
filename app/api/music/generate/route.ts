import { NextResponse } from "next/server";
import { cacheLyrics, cacheJob } from "../_cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5分（Vercel / Next.js タイムアウト延長）


// AIっぽさを消すヒューマナイズキーワード
const HUMANIZE_SUFFIX =
  "avoid quantized beats, slight tempo rubato, breath sounds, natural reverb, imperfect timing, human-like expression";

// デフォルト女性ボーカルサフィックス
const FEMALE_VOCALS_SUFFIX =
  "female vocals, sung lyrics, lead singer, vocal melody, singing voice, human performance, natural singing, organic feel, slight timing variations, expressive dynamics, studio recording";

function humanizePrompt(input: string): string {
  const map: Record<string, string> = {
    さわやか: "refreshing, bright, uplifting",
    落ち着く: "calm, relaxing, ambient",
    激しい: "energetic, intense, driving",
    悲しい: "melancholic, emotional, slow",
    楽しい: "fun, playful, bouncy",
    集中: "focus, concentration, minimal electronic",
    眠れる: "sleep, gentle, soft ambient",
    ロック: "rock, electric guitar, drums",
    ジャズ: "jazz, piano, upright bass",
    ポップ: "pop, catchy, upbeat",
    クラシック: "classical, orchestral, elegant",
    ヒップホップ: "hip hop, beat, rhythm",
    ダンス: "dance, electronic, groovy",
    癒し: "healing, soothing, peaceful",
    自然: "nature, organic, acoustic",
    夜: "night, atmospheric, moody",
    朝: "morning, fresh, bright",
    夏: "summer, bright, energetic",
    冬: "winter, cold, ambient",
    恋愛: "romantic, gentle, warm",
    クール: "cool, stylish, sophisticated",
    エモい: "emotional, touching, heartfelt",
    明るい: "bright, cheerful, positive",
    落ち着いた: "calm, composed, serene",
    ロマンチック: "romantic, tender, loving",
    切ない: "bittersweet, nostalgic, longing",
    神秘的: "mysterious, ethereal, magical",
    チル: "chill, laid-back, relaxed",
    ダーク: "dark, moody, deep",
    壮大: "epic, grand, orchestral",
    かわいい: "cute, sweet, playful",
    夏っぽい: "summer vibes, sunny, carefree",
    夜っぽい: "night vibes, late night, ambient",
    前向き: "positive, uplifting, motivational",
  };

  let english = input;
  for (const [jp, en] of Object.entries(map)) {
    english = english.replace(new RegExp(jp, "g"), en);
  }

  const naturalSuffix =
    "natural feel, humanized rhythm, warm acoustics, professional music production";

  return `${english}, ${naturalSuffix}`;
}

function buildProPrompt(params: {
  prompt: string;
  bpm: number;
  waveform: string;
  vocal: string;
}): string {
  const waveformMap: Record<string, string> = {
    sine: "smooth sine-wave synthesizer",
    sawtooth: "aggressive sawtooth synth",
    square: "retro 8-bit square wave",
    triangle: "warm triangle wave pads",
    noise: "white noise texture, atmospheric noise layer",
    organic: "organic acoustic texture, natural wooden instruments",
  };
  const vocalMap: Record<string, string> = {
    none: "no vocals, instrumental only",
    pop: "pop female vocals, sung lyrics, lead singer, vocal melody, singing voice",
    whisper: "soft whisper vocals",
    rap: "rap vocals, rhythmic flow",
    opera: "operatic soprano vocals",
  };

  // ボーカルあり時: 先頭に強調ボーカルキーワードを追加（none のみ除外）
  const vocalPrefix =
    params.vocal !== "none"
      ? "female lead vocalist, clear singing voice, prominent vocals, vocal melody in foreground, sung lyrics, human singer"
      : "";

  // 曲として成り立つ構成強化サフィックス
  const songStructureSuffix =
    "complete song structure, verse chorus bridge, musical arrangement, full band, professional music production, studio quality recording, 128-192 seconds duration";

  return [
    vocalPrefix,
    humanizePrompt(params.prompt),
    `at ${params.bpm} BPM`,
    waveformMap[params.waveform] ?? "",
    vocalMap[params.vocal] ?? "",
    songStructureSuffix,
    "high quality music production",
  ]
    .filter(Boolean)
    .join(", ");
}

// STANDARD モードのみ女性ボーカルを自動付加
// PRO モードは vocalMap が明示的に処理するため除外
function shouldAddFemaleVocals(
  prompt: string,
  mode: "standard" | "pro"
): boolean {
  if (mode === "pro") return false;
  const exclusions = ["男性", "インスト", "ボーカルなし", "ボーカル無し"];
  return !exclusions.some((kw) => prompt.includes(kw));
}

async function generateLyrics(
  userPrompt: string,
  openaiKey: string
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "あなたはプロの作詞家です。ユーザーの音楽テーマ・ムードに合った日本語の歌詞を作成します。必ず以下のフォーマットで出力してください：\n[Verse]\n（Aメロ歌詞を4〜6行）\n\n[Chorus]\n（サビ歌詞を4〜6行）\n\n[Bridge]\n（Bメロ・アウトロ歌詞を4〜6行）\n\n歌詞のみ出力し、タイトルや説明・ト書きは不要です。",
          },
          {
            role: "user",
            content: `以下のテーマ・ムードに合った歌詞を作成してください。\n\nテーマ: ${userPrompt}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error("openai_error");

    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

// Replicate予測を1件作成してIDを返すヘルパー
async function createMinimaxPrediction(
  token: string,
  prompt: string,
  lyrics: string
): Promise<string> {
  const input: Record<string, string | boolean> = { prompt, instrumental: true };
  if (lyrics) input.lyrics = `##\n${lyrics.trim()}\n##`;

  // デバッグ: 送信内容をターミナルに出力
  console.log("[minimax] createMinimaxPrediction input:", {
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 120),
    hasLyrics: !!lyrics,
    lyricsLength: lyrics?.length ?? 0,
  });

  const res = await fetch(
    "https://api.replicate.com/v1/models/minimax/music-01/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "wait=5",
      },
      body: JSON.stringify({ input }),
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // エラー詳細をターミナルに全出力
    console.error("[minimax] Replicate API error:", {
      status: res.status,
      statusText: res.statusText,
      body: JSON.stringify(data),
    });
    const msg =
      data?.detail ??
      data?.error ??
      (typeof data === "string" ? data : JSON.stringify(data)) ??
      "replicate_prediction_error";
    throw new Error(`Replicate ${res.status}: ${msg}`);
  }

  console.log("[minimax] prediction created:", data.id, "status:", data.status);
  return String(data.id);
}

// 歌詞を [Verse]/[Chorus]/[Bridge] セクションに分割
function parseLyricsSections(
  lyrics: string
): { verse: string; chorus: string; bridge: string } {
  const verse: string[] = [];
  const chorus: string[] = [];
  const bridge: string[] = [];
  let current: "verse" | "chorus" | "bridge" | null = null;

  for (const line of lyrics.split("\n")) {
    const t = line.trim();
    if (/^\[Verse\]/i.test(t)) { current = "verse"; continue; }
    if (/^\[Chorus\]/i.test(t)) { current = "chorus"; continue; }
    if (/^\[Bridge\]/i.test(t)) { current = "bridge"; continue; }
    if (current === "verse") verse.push(line);
    else if (current === "chorus") chorus.push(line);
    else if (current === "bridge") bridge.push(line);
  }

  const v = verse.join("\n").trim();
  const ch = chorus.join("\n").trim();
  const br = bridge.join("\n").trim();
  // セクション取得失敗時は全文をverseにフォールバック
  if (!v && !ch && !br) return { verse: lyrics, chorus: "", bridge: "" };
  return { verse: v, chorus: ch, bridge: br };
}

type GenerateRequest = {
  prompt?: string;
  mode?: "standard" | "pro";
  bpm?: number;
  waveform?: string;
  vocal?: string;
};

export async function POST(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;

  // デバッグ: トークン存在確認（先頭6文字のみ表示）
  console.log("[music/generate] REPLICATE_API_TOKEN present:", !!token, token ? `prefix=${token.slice(0, 6)}…` : "MISSING");

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "REPLICATE_API_TOKEN is missing" },
      { status: 500 }
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const { prompt, mode, bpm = 120, waveform = "sine", vocal = "none" } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { ok: false, error: "prompt_required" },
      { status: 400 }
    );
  }

  if (mode !== "standard" && mode !== "pro") {
    return NextResponse.json(
      { ok: false, error: "mode_must_be_standard_or_pro" },
      { status: 400 }
    );
  }

  // 1. 歌詞生成（非致命的: 失敗しても音楽生成は続行）
  let lyrics = "";
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      lyrics = await generateLyrics(prompt, openaiKey);
    } catch {
      lyrics = "";
    }
  }

  // 2. ベースプロンプト構築
  let finalPrompt =
    mode === "pro"
      ? buildProPrompt({ prompt, bpm, waveform, vocal })
      : humanizePrompt(prompt);

  // 3. 女性ボーカルデフォルト付加（STANDARDのみ、除外キーワードなし）
  if (shouldAddFemaleVocals(prompt, mode)) {
    finalPrompt += `, ${FEMALE_VOCALS_SUFFIX}`;
  }

  // 4. ヒューマナイズ強化（両モード共通）
  finalPrompt += `, ${HUMANIZE_SUFFIX}`;

  // 5. 3セクション予測を作成（Minimax music-01 × 3）
  const CONSISTENCY =
    "same vocalist, consistent melody, same song, continuous";
  const sections = parseLyricsSections(lyrics);

  const versePrompt  = `${finalPrompt}, ${CONSISTENCY}, verse section, melodic introduction, building energy`;
  const chorusPrompt = `${finalPrompt}, ${CONSISTENCY}, chorus section, hook, emotional peak, same vocalist`;
  const bridgePrompt = `${finalPrompt}, ${CONSISTENCY}, bridge section, variation, leading to finale, same vocalist`;

  try {
    const verseId  = await createMinimaxPrediction(token, versePrompt,  sections.verse);
    const chorusId = await createMinimaxPrediction(token, chorusPrompt, sections.chorus);
    const bridgeId = await createMinimaxPrediction(token, bridgePrompt, sections.bridge);

    // 6. ジョブをキャッシュに保存（status route が参照）
    const jobId = `music_${Date.now()}`;
    cacheJob(jobId, { verseId, chorusId, bridgeId, stage: "verse", lyrics });
    if (lyrics) cacheLyrics(jobId, lyrics);

    return NextResponse.json(
      { ok: true, predictionId: jobId, lyrics },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[music/generate] fatal error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
