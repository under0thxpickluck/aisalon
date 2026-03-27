import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `あなたは「リファ猫」というAIサロン「LIFAI」のマスコットキャラクターです。
フレンドリーで親しみやすいトーンで、何でも日本語で答えてください。
AI・副業・プログラミング・日常の悩みなど、幅広い質問に対応します。
LIFAIの機能（団子占い・BGM生成・マーケット・ガチャ・ミッション・ステーキング・ノート生成）についても詳しいです。
回答は簡潔にまとめつつ、必要なら詳しく説明してください。`;

const replyCache = new Map<string, string>();

export async function POST(req: Request) {
  try {
    const { message, history, images } = await req.json();
    // images: string[] | undefined — base64 data URLs (e.g. "data:image/jpeg;base64,...")

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, error: "empty message" }, { status: 400 });
    }

    const cacheKey = message.trim().toLowerCase();
    if (!history?.length && !images?.length && replyCache.has(cacheKey)) {
      return NextResponse.json({ ok: true, reply: replyCache.get(cacheKey), cached: true });
    }

    // 画像あり: content配列形式（vision対応）
    // 画像なし: 従来通り文字列
    let userMessageContent: string | OpenAI.Chat.ChatCompletionContentPart[];
    if (images?.length) {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      for (const img of images.slice(0, 3)) {
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

    if (!history?.length && !images?.length) {
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
