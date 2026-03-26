import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { NOTE_ARTICLE_SCHEMA } from "@/lib/ai/schemas";
import { NOTE_SYSTEM_PROMPT, buildArticlePrompt } from "@/lib/ai/prompts/note";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { plan_id, selected_title, outline, tone, length, paywall_mode } = body;

  if (!plan_id || !selected_title || !outline || !tone || !length || !paywall_mode) {
    return NextResponse.json({ ok: false, error: "必須パラメータが不足しています" }, { status: 400 });
  }

  const client = getOpenAIClient();
  const userPrompt = buildArticlePrompt({ selected_title, outline, tone, length, paywall_mode });

  const model = length >= 8000 ? "gpt-4o" : "gpt-4o-mini";

  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: NOTE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "note_article",
            strict: true,
            schema: NOTE_ARTICLE_SCHEMA,
          },
        },
        temperature: 0.75,
        max_tokens: Math.min(length * 2, 8000),
      });

      const content = response.choices[0].message.content;
      result = JSON.parse(content!);
      break;
    } catch (err) {
      if (attempt === 2) {
        return NextResponse.json({ ok: false, error: "本文生成に失敗しました。再試行してください" }, { status: 500 });
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  const markdown = result.sections
    .map((s: { heading: string; body_markdown: string; is_paid: boolean }) => {
      const paidMarker = s.is_paid ? "\n\n---\n> ここから先は有料記事です\n\n" : "";
      return `${paidMarker}## ${s.heading}\n\n${s.body_markdown}`;
    })
    .join("\n\n");

  const job_id = `note_${Date.now()}`;
  // TODO: saveArticle(job_id, { plan_id, markdown, ...result })
  // TODO: consumeBP(userId, calcBP(length))

  return NextResponse.json({
    ok: true,
    job_id,
    data: {
      markdown,
      sections: result.sections,
      note_description: result.note_description,
      x_post: result.x_post,
      line_copy: result.line_copy,
    },
  });
}
