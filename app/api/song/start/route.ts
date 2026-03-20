// app/api/song/start/route.ts
import { NextResponse } from "next/server";
import { createJob, updateJob } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function generateLyricsBackground(
  jobId: string,
  theme: string,
  genre: string,
  mood: string,
  apiKey: string
): Promise<void> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content:
              "あなたはプロの作詞家です。ユーザーの音楽テーマ・ジャンル・雰囲気に合った日本語のサビ歌詞とタイトルを作成します。サビ（Hook）のみを生成してください。最大8行、1行20文字以内の日本語歌詞にしてください。verse・introは不要です。必ず以下のフォーマットで出力してください：\n\nTITLE: （タイトル）\n\n[Chorus]\n（サビ歌詞を4〜8行、1行20文字以内）\n\nタイトルと歌詞のみ出力し、説明やト書きは不要です。",
          },
          {
            role: "user",
            content: `テーマ：${theme}\nジャンル：${genre}\n雰囲気：${mood}\n\n上記のテーマ・ジャンル・雰囲気に合った日本語の歌詞を作成してください。`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "(unreadable)");
      console.error(`[song/start] OpenAI API error: status=${res.status} body=${errBody}`);
      throw new Error(`openai_http_${res.status}`);
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content ?? "");

    const titleMatch = content.match(/TITLE:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `${theme}の歌`;
    const lyrics = content.replace(/TITLE:\s*.+\n?/, "").trim();

    await updateJob(jobId, {
      status: "lyrics_ready",
      lyricsData: { title, lyrics },
    });
  } catch (e: any) {
    console.error("[song/start] lyrics generation error:", e);
    console.error("[song/start] error details:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    await updateJob(jobId, { status: "failed", error: String(e?.message ?? e) });
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

  const { id, code, theme, genre, mood } = body ?? {};

  if (!id || !code) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!theme || !genre || !mood) {
    return NextResponse.json(
      { ok: false, error: "theme_genre_mood_required" },
      { status: 400 }
    );
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

  // GAS に BP 減算を要求（失敗したらジョブを作らない）
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
          action: "deduct_bp",
          adminKey: gasAdminKey,
          loginId: String(id),
          amount: BP_COSTS.music_full,
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
    { theme: String(theme), genre: String(genre), mood: String(mood) },
    BP_COSTS.music_full
  );

  const openaiKey = process.env.OPENAI_API_KEY;
  console.log("[song/start] OPENAI_API_KEY present:", !!openaiKey);
  if (openaiKey) {
    // Fire-and-forget: バックグラウンドで歌詞生成
    generateLyricsBackground(jobId, String(theme), String(genre), String(mood), openaiKey).catch(
      (e) => {
        console.error("[song/start] unhandled background error:", e);
        updateJob(jobId, { status: "failed", error: String(e) }).catch(console.error);
      }
    );
  } else {
    console.error("[song/start] OPENAI_API_KEY is missing, marking job failed");
    await updateJob(jobId, { status: "failed", error: "openai_key_missing" });
  }

  return NextResponse.json({ ok: true, jobId, status: "lyrics_generating", bpLocked: BP_COSTS.music_full });
}
