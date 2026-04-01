import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { NOTE_PLAN_SCHEMA } from "@/lib/ai/schemas";
import { NOTE_SYSTEM_PROMPT, buildPlanPrompt } from "@/lib/ai/prompts/note";
import { BP_COSTS } from "@/app/lib/bp-config";

const NOTE_BP_COST = BP_COSTS.note_full; // 150 BP

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { theme, format, persona, tone, length, expertise, paywall_mode, extra_keywords, loginId } = body;
  if (!theme || !format || !persona || !tone || !length || !expertise || !paywall_mode) {
    return NextResponse.json({ ok: false, error: "必須パラメータが不足しています" }, { status: 400 });
  }
  if (!loginId) {
    return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
  }

  // ── BP 消費（GAS deduct_bp）────────────────────────────────────────────────
  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;

  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const gasEndpoint = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const deductRes = await fetch(gasEndpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      cache:   "no-store",
      body: JSON.stringify({
        action:   "deduct_bp",
        adminKey: gasAdminKey,
        loginId,
        amount:   NOTE_BP_COST,
        memo:     "note記事生成",
      }),
    });
    const deductData = await deductRes.json().catch(() => ({ ok: false, error: "invalid_response" }));
    if (!deductData.ok) {
      const reason = deductData.error || "deduct_failed";
      if (reason === "insufficient_bp") {
        return NextResponse.json({ ok: false, error: "insufficient_bp", bp_balance: deductData.bp_balance }, { status: 402 });
      }
      return NextResponse.json({ ok: false, error: reason }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "bp_deduct_failed" }, { status: 502 });
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

  return NextResponse.json({ ok: true, plan_id, data: result });
}
