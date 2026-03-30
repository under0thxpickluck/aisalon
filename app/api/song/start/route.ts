// app/api/song/start/route.ts
// 歌詞ステップなし。直接 structure_ready まで生成して返す。
// master_lyrics / singable_lyrics も同時生成・保存。
import { NextResponse } from "next/server";
import { createJob, updateJob, getJob } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";
import { buildSingableLyrics } from "@/lib/music/lyrics-singable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function generateJobId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `song_${date}_${rand}`;
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

// テーマ・ジャンル・雰囲気から構成 + master_lyrics を一気に生成
async function generateStructureAndLyrics(
  jobId: string,
  theme: string,
  genre: string,
  mood: string,
  apiKey: string,
  options?: { isPro?: boolean; bpmHint?: number; vocalStyle?: string; vocalMood?: string; language?: string }
): Promise<{ structureData: any; masterLyrics: string } | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 40_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `あなたはプロの音楽プロデューサー兼作詞家です。テーマ・ジャンル・雰囲気から楽曲構成と歌詞を同時に生成します。

必ずJSON形式で以下のフィールドを返してください：
{
  "bpm": 数値,
  "key": "キー（例: C major）",
  "sections": ["Intro", "Verse", "Chorus", "Bridge", "Outro" などのリスト],
  "hookSummary": "サビの内容の一行要約",
  "title": "曲タイトル",
  "lyrics": "歌詞全文（[Verse A]\\n...\\n[Chorus]\\n... の形式、最大40行、1行20文字以内）"
}

歌詞のフォーマット例：
[Verse A]
（Aメロ4〜8行）

[Verse B]
（Bメロ4〜8行）

[Chorus]
（サビ4〜8行）

[Verse A]
（Aメロ4〜8行）

[Chorus]
（サビ4〜8行）`,
          },
          {
            role: "user",
            content: `以下のテーマ・ジャンル・雰囲気から楽曲構成と歌詞を生成してください。\n\nテーマ：${theme}\nジャンル：${genre}\n雰囲気：${mood}${
  options?.isPro
    ? `\nBPM目安：${options.bpmHint ?? "自由"}\nボーカルスタイル：${options.vocalStyle ?? "指定なし"}\nボーカルムード：${options.vocalMood ?? "指定なし"}\n言語：${options.language ?? "日本語"}\n\n※Proモード：歌詞は歌唱表現に優れた自然な日本語を使い、1行12〜16音節に収めてください。`
    : ""
}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`openai_error_${res.status}`);

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content ?? "{}");
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}

    const structureData = {
      bpm:         Number(parsed.bpm ?? 120),
      key:         String(parsed.key ?? "C major"),
      sections:    Array.isArray(parsed.sections) ? parsed.sections.map(String) : ["Intro", "Verse", "Chorus", "Outro"],
      hookSummary: String(parsed.hookSummary ?? ""),
      title:       String(parsed.title ?? theme),
    };
    const masterLyrics = String(parsed.lyrics ?? "");

    await updateJob(jobId, {
      status: "structure_ready",
      structureData,
      masterLyrics,
    });

    return { structureData, masterLyrics };
  } catch (e: any) {
    await updateJob(jobId, { status: "failed", error: String(e?.message ?? e) });
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { id, code, theme, genre, mood, isPro, bpmHint, vocalStyle, vocalMood, language } = body ?? {};

  if (!id || !code) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!theme || !genre || !mood) {
    return NextResponse.json({ ok: false, error: "theme_genre_mood_required" }, { status: 400 });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "gas_env_missing" }, { status: 500 });
  }

  let bp: number;
  try {
    bp = await callGasBalance(String(id), gasUrl, gasKey);
  } catch {
    return NextResponse.json({ ok: false, error: "balance_check_failed" }, { status: 502 });
  }

  if (bp < BP_COSTS.music_full) {
    return NextResponse.json({ ok: false, error: "insufficient_bp", bp }, { status: 400 });
  }

  const gasAdminKey = process.env.GAS_ADMIN_KEY;
  if (!gasAdminKey) {
    return NextResponse.json({ ok: false, error: "gas_admin_key_missing" }, { status: 500 });
  }

  try {
    const deductRes = await fetch(
      `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action:   "deduct_bp",
          adminKey: gasAdminKey,
          loginId:  String(id),
          amount:   BP_COSTS.music_full,
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

  const jobId = generateJobId();
  await createJob(
    jobId,
    String(id),
    {
      theme:      String(theme),
      genre:      String(genre),
      mood:       String(mood),
      isPro:      !!isPro,
      bpmHint:    bpmHint ? Number(bpmHint) : undefined,
      vocalStyle: vocalStyle ? String(vocalStyle) : undefined,
      vocalMood:  vocalMood ? String(vocalMood) : undefined,
      language:   language  ? String(language)  : "ja",
    },
    BP_COSTS.music_full
  );

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    await updateJob(jobId, { status: "failed", error: "openai_key_missing" });
    const failedJob = await getJob(jobId);
    return NextResponse.json({ ok: true, jobId, status: failedJob?.status ?? "failed", structureData: null });
  }

  // 構成 + master_lyrics を同時生成
  const generated = await generateStructureAndLyrics(
    jobId, String(theme), String(genre), String(mood), openaiKey,
    { isPro: !!isPro, bpmHint: bpmHint ? Number(bpmHint) : undefined, vocalStyle, vocalMood, language }
  );

  // singable_lyrics を生成（失敗してもmaster_lyricsで続行）
  if (generated?.masterLyrics) {
    const singable = await buildSingableLyrics({
      masterLyrics: generated.masterLyrics,
      bpm:          generated.structureData.bpm,
      genre:        String(genre),
      mood:         String(mood),
      apiKey:       openaiKey,
    });
    await updateJob(jobId, {
      singableLyrics:       singable,
      displayLyrics:        singable,    // Phase 1: singable をそのまま表示用に
      distributionLyrics:   singable,    // Phase 1: singable をそのまま配信用に
      lyricsSource:         "singable",
      lyricsReviewRequired: true,        // ASR完了まで要確認
      distributionReady:    false,       // ASR未実施なのでfalse
    });
  }

  const completedJob = await getJob(jobId);
  return NextResponse.json({
    ok:            true,
    jobId,
    status:        completedJob?.status ?? "structure_ready",
    structureData: completedJob?.structureData ?? null,
  });
}
