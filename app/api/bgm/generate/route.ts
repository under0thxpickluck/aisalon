import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPLICATE_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MOOD_MAP: Record<string, string> = {
  さわやか: "refreshing, bright, uplifting",
  落ち着いた: "calm, composed, serene",
  激しい: "energetic, intense, driving",
  エモい: "emotional, touching, heartfelt",
  明るい: "bright, cheerful, positive",
  ロマンチック: "romantic, tender, loving",
  切ない: "bittersweet, nostalgic, longing",
  クール: "cool, stylish, sophisticated",
};

const GENRE_MAP: Record<string, string> = {
  ポップ: "pop",
  ロック: "rock",
  ジャズ: "jazz",
  クラシック: "classical, orchestral",
  EDM: "electronic dance music",
  ヒップホップ: "hip hop",
  "R&B": "R&B, soul",
  アニメ: "anime soundtrack",
  ローファイ: "lo-fi, chill",
  シネマティック: "cinematic, film score",
};

function buildBgmPrompt(params: {
  theme: string;
  genre: string;
  mood: string;
  bpm?: number;
}): string {
  const parts: string[] = [];
  if (params.genre) parts.push(GENRE_MAP[params.genre] ?? params.genre);
  if (params.mood)  parts.push(MOOD_MAP[params.mood] ?? params.mood);
  if (params.theme) parts.push(params.theme);
  if (params.bpm)   parts.push(`${params.bpm} BPM`);
  parts.push("instrumental only, no vocals, no singing, background music, BGM");
  parts.push("high quality, studio quality, clear mix");
  return parts.filter(Boolean).join(", ");
}

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "REPLICATE_API_TOKEN is missing" }, { status: 500 });
  }

  const body = await req.json() as {
    theme: string;
    genre: string;
    mood: string;
    duration?: number;
    bpm?: number;
  };

  const prompt = buildBgmPrompt({
    theme: body.theme ?? "",
    genre: body.genre ?? "",
    mood: body.mood ?? "",
    bpm: body.bpm,
  });

  const duration = Math.min(Math.max(Number(body.duration ?? 30), 30), 180);

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: REPLICATE_VERSION,
      input: {
        prompt,
        model_version: "stereo-large",
        duration,
        output_format: "mp3",
        normalization_strategy: "peak",
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[bgm/generate] Replicate error:", { status: res.status, body: JSON.stringify(data) });
    return NextResponse.json(
      { ok: false, error: data?.detail ?? data?.error ?? "replicate_error" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, predictionId: String(data.id) });
}
