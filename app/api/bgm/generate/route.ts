import { NextRequest, NextResponse } from "next/server";
import { BP_COSTS } from "@/app/lib/bp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  神秘的: "mysterious, ethereal, mystical",
  ダーク: "dark, moody, deep, brooding",
  壮大: "epic, grand, majestic, orchestral",
  かわいい: "cute, sweet, playful, innocent",
  夏っぽい: "summer vibes, sunny, carefree, warm",
  夜っぽい: "night vibes, late night, atmospheric",
  前向き: "positive, uplifting, motivational",
  集中できる: "focus, concentration, minimal, steady",
  緊張感: "tense, suspenseful, thrilling",
  ホラー: "horror, eerie, unsettling, dark ambient",
  ファンタジー: "fantasy, magical, whimsical, enchanting",
  リラックス: "relaxing, soothing, peaceful, gentle",
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
  アンビエント: "ambient, atmospheric",
  チルアウト: "chillout, downtempo, relaxed",
  ニューエイジ: "new age, meditative, peaceful",
  ボサノバ: "bossa nova, samba, Brazilian jazz",
  フォーク: "folk, acoustic, organic",
  ネオソウル: "neo soul, smooth, groovy",
  トロピカルハウス: "tropical house, upbeat, summery",
  ドラムンベース: "drum and bass, energetic, breakbeat",
  メタル: "metal, heavy, powerful, aggressive",
  ダークエレクトロ: "dark electro, industrial, synth, gritty",
};

async function generateBgmAtmosphere(
  theme: string,
  genre: string,
  mood: string,
  openaiKey: string
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You are a music prompt engineer for AI music generation. Output ONLY a comma-separated list of English descriptive keywords describing the atmosphere, texture, instrumentation, and sonic feel (no explanation, no sentences). Keep it under 80 words.",
          },
          {
            role: "user",
            content: `Theme: ${theme}\nGenre: ${genre}\nMood: ${mood}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("openai_error");
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? "").trim();
  } finally {
    clearTimeout(t);
  }
}

function buildBgmPrompt(params: {
  theme: string;
  genre: string;
  mood: string;
  bpm?: number;
  atmosphere?: string;
}): string {
  const parts: string[] = [];
  if (params.genre) parts.push(GENRE_MAP[params.genre] ?? params.genre);
  if (params.mood)  parts.push(MOOD_MAP[params.mood] ?? params.mood);
  if (params.atmosphere) parts.push(params.atmosphere);
  if (params.theme) parts.push(params.theme);
  if (params.bpm)   parts.push(`${params.bpm} BPM`);
  parts.push("instrumental only, no vocals, no singing, background music, BGM");
  parts.push("high quality, studio quality, clear mix");
  return parts.filter(Boolean).join(", ");
}

async function callGasBalance(id: string, gasUrl: string, gasKey: string): Promise<number> {
  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action: "get_balance", id }),
  });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) throw new Error("balance_fetch_failed");
  return Number(data.bp ?? 0);
}

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "REPLICATE_API_TOKEN is missing" }, { status: 500 });
  }

  const body = await req.json() as {
    id?: string;
    code?: string;
    isPro?: boolean;
    theme: string;
    genre: string;
    mood: string;
    duration?: number;
    bpm?: number;
  };

  const id = String(body.id ?? "");
  const code = String(body.code ?? "");
  if (!id || !code) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;
  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "gas_env_missing" }, { status: 500 });
  }

  let bp: number;
  try {
    bp = await callGasBalance(id, gasUrl, gasKey);
  } catch {
    return NextResponse.json({ ok: false, error: "balance_check_failed" }, { status: 502 });
  }

  const isPro = body.isPro === true;
  const bpCost = isPro ? BP_COSTS.music_bgm_pro : BP_COSTS.music_bgm;
  if (bp < bpCost) {
    return NextResponse.json({ ok: false, error: "insufficient_bp", bp, required: bpCost }, { status: 400 });
  }

  // BP消費（Replicate呼び出し前に確定）
  try {
    const deductRes = await fetch(
      `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "deduct_bp",
          adminKey: gasAdminKey,
          loginId: id,
          amount: bpCost,
        }),
      }
    );
    const deductData = await deductRes.json().catch(() => ({ ok: false }));
    if (!deductData.ok) {
      return NextResponse.json(
        { ok: false, error: deductData.error || "deduct_bp_failed" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ ok: false, error: "deduct_bp_request_failed" }, { status: 502 });
  }

  // GPT-4o-miniで雰囲気の英語説明を生成（失敗してもフォールバック）
  let atmosphere = "";
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      atmosphere = await generateBgmAtmosphere(
        body.theme ?? "",
        body.genre ?? "",
        body.mood ?? "",
        openaiKey
      );
    } catch {
      atmosphere = "";
    }
  }

  const prompt = buildBgmPrompt({
    theme: body.theme ?? "",
    genre: body.genre ?? "",
    mood: body.mood ?? "",
    bpm: body.bpm,
    atmosphere,
  });

  // 通常: 120〜210秒のランダム。Pro: ユーザー指定（120〜210でクランプ）
  const duration = isPro
    ? Math.min(Math.max(Number(body.duration ?? 120), 120), 210)
    : 120 + Math.floor(Math.random() * 91); // 120〜210

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
        output_format: "wav",
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

  console.log("[bgm/generate] success:", { userId: id, predictionId: data.id, isPro, bpCost, duration, promptPreview: prompt.slice(0, 100) });
  return NextResponse.json({ ok: true, predictionId: String(data.id), bpUsed: bpCost });
}
