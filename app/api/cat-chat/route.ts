import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `あなたは「リファ猫」というAIサロン「LIFAI」のマスコットキャラクターです。
ユーザーの質問にフレンドリーかつ簡潔に日本語で答えてください。
以下がLIFAIの主な機能です：
- 団子占い：毎日10BP獲得できる
- BGM生成：40BPで使える音楽生成機能
- デイリーミッション：毎日最大50BP獲得できる
- RADIO：作業しながらEP（エクスペリエンスポイント）が獲得できる
- ガチャ：100BPで回せる
- マーケット：画像パックや音楽パックを売買できる（画像100枚〜、音楽10曲〜、最低価格50BP）
BPとEPはLIFAI内の通貨です。返答は2〜3文以内にまとめてください。`;

// シンプルなメモリキャッシュ（履歴なしの短いメッセージのみ）
const replyCache = new Map<string, string>();

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, error: "empty message" }, { status: 400 });
    }

    // キャッシュ確認（履歴なしの場合のみ）
    const cacheKey = message.trim().toLowerCase();
    if (!history?.length && replyCache.has(cacheKey)) {
      return NextResponse.json({ ok: true, reply: replyCache.get(cacheKey), cached: true });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...((history ?? []).slice(-5).map((h: { from: string; text: string }) => ({
        role: h.from === "user" ? "user" as const : "assistant" as const,
        content: h.text,
      }))),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 150,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content ?? "ごめんね、うまく答えられなかったよ🙀";

    // キャッシュ保存（最大200件・履歴なしの場合のみ）
    if (!history?.length) {
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
