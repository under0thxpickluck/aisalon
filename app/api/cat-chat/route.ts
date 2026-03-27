import { NextResponse } from "next/server";
import OpenAI from "openai";
import { BP_COSTS } from "@/app/lib/bp-config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `あなたは「リファ猫」というAIサロン「LIFAI」のマスコットキャラクターです。
フレンドリーで親しみやすいトーンで、何でも日本語で答えてください。
AI・副業・プログラミング・日常の悩みなど、幅広い質問に対応します。
LIFAIの機能（団子占い・BGM生成・マーケット・ガチャ・ミッション・ステーキング・ノート生成）についても詳しいです。
回答は簡潔にまとめつつ、必要なら詳しく説明してください。`;

const replyCache = new Map<string, string>();

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

async function deductBp(id: string, amount: number, gasUrl: string, gasKey: string, gasAdminKey: string): Promise<void> {
  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action: "deduct_bp", adminKey: gasAdminKey, loginId: String(id), amount }),
  });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) throw new Error(data.error || "deduct_bp_failed");
}

export async function POST(req: Request) {
  try {
    const { message, history, images, id } = await req.json();
    // images: string[] | undefined — base64 data URLs (e.g. "data:image/jpeg;base64,...")

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, error: "empty message" }, { status: 400 });
    }

    // BP 残高チェック & 消化（id/code がある場合のみ）
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const gasAdminKey = process.env.GAS_ADMIN_KEY;
    if (id && gasUrl && gasKey && gasAdminKey) {
      let bp: number;
      try {
        bp = await callGasBalance(String(id), gasUrl, gasKey);
      } catch {
        return NextResponse.json({ ok: false, error: "balance_check_failed" }, { status: 502 });
      }
      if (bp < BP_COSTS.chat_message) {
        return NextResponse.json({ ok: false, error: "insufficient_bp", bp }, { status: 400 });
      }
      try {
        await deductBp(String(id), BP_COSTS.chat_message, gasUrl, gasKey, gasAdminKey);
      } catch {
        return NextResponse.json({ ok: false, error: "deduct_bp_failed" }, { status: 502 });
      }
    }

    // Normalize: ensure images is a valid string array of data URLs
    const safeImages = Array.isArray(images)
      ? (images as string[]).filter((img) => typeof img === "string" && img.startsWith("data:image/"))
      : undefined;

    const cacheKey = message.trim().toLowerCase();
    if (!history?.length && !safeImages?.length && replyCache.has(cacheKey)) {
      return NextResponse.json({ ok: true, reply: replyCache.get(cacheKey), cached: true });
    }

    // 画像あり: content配列形式（vision対応）
    // 画像なし: 従来通り文字列
    let userMessageContent: string | OpenAI.Chat.ChatCompletionContentPart[];
    if (safeImages?.length) {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      for (const img of safeImages.slice(0, 3)) {
        parts.push({ type: "image_url", image_url: { url: img, detail: "auto" } });
      }
      parts.push({ type: "text", text: message });
      userMessageContent = parts;
    } else {
      userMessageContent = message;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...((history ?? []).slice(-10).map((h: { role: string; content: string }) => ({
        role: h.role === "user" ? "user" as const : "assistant" as const,
        content: h.content || "",
      }))),
      { role: "user" as const, content: userMessageContent },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content ?? "ごめんね、うまく答えられなかったよ🙀";

    if (!history?.length && !safeImages?.length) {
      if (replyCache.size >= 200) {
        const firstKey = replyCache.keys().next().value;
        if (firstKey) replyCache.delete(firstKey);
      }
      replyCache.set(cacheKey, reply);
    }

    return NextResponse.json({ ok: true, reply, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cat-chat error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
