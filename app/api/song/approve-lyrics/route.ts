// app/api/song/approve-lyrics/route.ts
import { NextResponse } from "next/server";
import { getJob, updateJob } from "../_jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function generateStructureBackground(
  jobId: string,
  lyrics: string,
  theme: string,
  genre: string,
  mood: string,
  fallbackTitle: string,
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
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'あなたは音楽プロデューサーです。歌詞とテーマから楽曲の構成を提案します。必ずJSON形式で以下のフィールドを返してください：{"bpm": 数値, "key": "キー（例: C major）", "sections": ["Intro", "Verse", "Chorus", "Bridge", "Outro"などのリスト], "hookSummary": "サビの内容の一行要約", "title": "曲タイトル"}',
          },
          {
            role: "user",
            content: `以下の歌詞・テーマ・ジャンル・雰囲気から楽曲構成を提案してください。\n\nテーマ：${theme}\nジャンル：${genre}\n雰囲気：${mood}\n\n歌詞：\n${lyrics}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error("openai_error");

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content ?? "{}");
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    updateJob(jobId, {
      status: "structure_ready",
      structureData: {
        bpm: Number(parsed.bpm ?? 120),
        key: String(parsed.key ?? "C major"),
        sections: Array.isArray(parsed.sections)
          ? parsed.sections.map(String)
          : ["Intro", "Verse", "Chorus", "Outro"],
        hookSummary: String(parsed.hookSummary ?? ""),
        title: String(parsed.title ?? fallbackTitle),
      },
    });
  } catch (e: any) {
    updateJob(jobId, { status: "failed", error: String(e?.message ?? e) });
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

  const { jobId, lyrics: editedLyrics } = body ?? {};

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId_required" }, { status: 400 });
  }

  const job = getJob(String(jobId));
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  if (job.status !== "lyrics_ready") {
    return NextResponse.json(
      { ok: false, error: "invalid_status", status: job.status },
      { status: 400 }
    );
  }

  const originalLyrics = job.lyricsData?.lyrics ?? "";
  const finalLyrics = typeof editedLyrics === "string" ? editedLyrics : originalLyrics;
  const editedByUser = finalLyrics !== originalLyrics;

  updateJob(String(jobId), {
    status: "structure_generating",
    lyricsData: {
      title: job.lyricsData?.title ?? "",
      lyrics: finalLyrics,
      editedByUser,
      version: (job.lyricsData?.version ?? 1) + (editedByUser ? 1 : 0),
    },
    rightsLog: {
      ...job.rightsLog,
      lyricsApproved: true,
      humanEditedLyrics: editedByUser,
    },
  });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    generateStructureBackground(
      String(jobId),
      finalLyrics,
      job.prompt.theme,
      job.prompt.genre,
      job.prompt.mood,
      job.lyricsData?.title ?? job.prompt.theme,
      openaiKey
    ).catch((e) => updateJob(String(jobId), { status: "failed", error: String(e) }));
  } else {
    updateJob(String(jobId), { status: "failed", error: "openai_key_missing" });
  }

  return NextResponse.json({ ok: true, status: "structure_generating" });
}
