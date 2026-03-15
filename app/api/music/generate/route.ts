import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AIっぽさを消すヒューマナイズキーワード
const HUMANIZE_SUFFIX =
  "avoid quantized beats, slight tempo rubato, natural reverb, imperfect timing, human-like expression";

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

  return `${english}, natural feel, humanized rhythm, warm acoustics, professional music production`;
}

function buildProPrompt(params: {
  prompt: string;
  bpm: number;
  waveform: string;
}): string {
  const waveformMap: Record<string, string> = {
    sine: "smooth sine-wave synthesizer",
    sawtooth: "aggressive sawtooth synth",
    square: "retro 8-bit square wave",
    triangle: "warm triangle wave pads",
    noise: "white noise texture, atmospheric noise layer",
    organic: "organic acoustic texture, natural wooden instruments",
  };

  return [
    humanizePrompt(params.prompt),
    `at ${params.bpm} BPM`,
    waveformMap[params.waveform] ?? "",
    "no vocals, instrumental only",
    "complete song structure, verse chorus bridge, professional music production, studio quality recording",
    "high quality music production",
  ]
    .filter(Boolean)
    .join(", ");
}

type GenerateRequest = {
  prompt?: string;
  mode?: "standard" | "pro";
  bpm?: number;
  waveform?: string;
};

export async function POST(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;

  console.log(
    "[music/generate] REPLICATE_API_TOKEN present:",
    !!token,
    token ? `prefix=${token.slice(0, 6)}…` : "MISSING"
  );

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
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { prompt, mode, bpm = 120, waveform = "sine" } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ ok: false, error: "prompt_required" }, { status: 400 });
  }

  if (mode !== "standard" && mode !== "pro") {
    return NextResponse.json(
      { ok: false, error: "mode_must_be_standard_or_pro" },
      { status: 400 }
    );
  }

  // プロンプト構築（ボーカルなしBGM固定）
  let finalPrompt =
    mode === "pro"
      ? buildProPrompt({ prompt, bpm, waveform })
      : `${humanizePrompt(prompt)}, no vocals, instrumental only, background music`;

  finalPrompt += `, ${HUMANIZE_SUFFIX}`;

  console.log("[music/generate] finalPrompt preview:", finalPrompt.slice(0, 150));

  // Replicate にジョブを投げて即 ID を返す（待たない）
  let predictionId: string;
  try {
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
        input: {
          prompt: finalPrompt,
          model_version: "stereo-large",
          duration: 30,
          output_format: "mp3",
          normalization_strategy: "peak",
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[music/generate] Replicate error:", {
        status: res.status,
        body: JSON.stringify(data),
      });
      const msg =
        data?.detail ??
        data?.error ??
        (typeof data === "string" ? data : JSON.stringify(data)) ??
        "replicate_error";
      return NextResponse.json(
        { ok: false, error: `Replicate ${res.status}: ${msg}` },
        { status: 502 }
      );
    }

    predictionId = String(data.id ?? "");
    if (!predictionId) {
      return NextResponse.json({ ok: false, error: "no_prediction_id" }, { status: 502 });
    }

    console.log("[music/generate] prediction created:", predictionId, "status:", data.status);
  } catch (e: any) {
    console.error("[music/generate] fetch error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, predictionId }, { status: 200 });
}
