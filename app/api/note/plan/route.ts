import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { NOTE_PLAN_SCHEMA } from "@/lib/ai/schemas";
import { NOTE_SYSTEM_PROMPT, buildPlanPrompt } from "@/lib/ai/prompts/note";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { theme, format, persona, tone, length, expertise, paywall_mode, extra_keywords } = body;
  if (!theme || !format || !persona || !tone || !length || !expertise || !paywall_mode) {
    return NextResponse.json({ ok: false, error: "必須パラメータが不足しています" }, { status: 400 });
  }

  const client = getOpenAIClient();
  const userPrompt = buildPlanPrompt({ theme, format, persona, tone, length, expertise, paywall_mode, extra_keywords });

  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: NOTE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "note_plan",
            strict: true,
            schema: NOTE_PLAN_SCHEMA,
          },
        },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      result = JSON.parse(content!);
      break;
    } catch (err) {
      if (attempt === 2) {
        console.error("Plan generation failed after 3 attempts", err);
        return NextResponse.json({ ok: false, error: "企画生成に失敗しました。再試行してください" }, { status: 500 });
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  const plan_id = `plan_${Date.now()}`;
  // TODO: savePlan(plan_id, { ...body, result }) を呼ぶ
  // TODO: consumeBP(userId, 8)

  return NextResponse.json({ ok: true, plan_id, data: result });
}
