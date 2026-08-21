import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  PROFILE_SYSTEM_PROMPT,
  PROFILE_FROM_IMAGE_SYSTEM_PROMPT,
} from "@/app/lib/sticker/character_prompt";
import {
  extractJson,
  normalizeProfile,
  normalizeManifest,
  MAX_TEXT_LENGTH,
} from "@/app/lib/sticker/manifest";
import {
  THEME_GUIDANCE,
  THEME_LABELS,
  exampleFor,
  isValidTheme,
} from "@/app/lib/sticker/templates";
import { isOfferedCount } from "@/app/lib/sticker/cost";
import type { CharacterProfile, StickerTheme } from "@/app/lib/sticker/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function buildProfile(
  sourcePrompt: string,
  sourceImageUrl: string
): Promise<CharacterProfile> {
  // 画像がある場合は画像から特徴を読み取る（gpt-4o-mini は画像入力に対応）
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = sourceImageUrl
    ? [
        { role: "system", content: PROFILE_FROM_IMAGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                sourcePrompt ||
                "この画像の主役を、LINEスタンプ用マスコットにするための設計書を作ってください。",
            },
            { type: "image_url", image_url: { url: sourceImageUrl } },
          ],
        },
      ]
    : [
        { role: "system", content: PROFILE_SYSTEM_PROMPT },
        { role: "user", content: sourcePrompt },
      ];

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    messages,
  });
  const raw = res.choices?.[0]?.message?.content ?? "";
  return normalizeProfile(extractJson(raw));
}

function manifestSystemPrompt(
  theme: StickerTheme,
  themeCustom: string,
  count: number
): string {
  const guidance = theme === "custom" ? themeCustom : THEME_GUIDANCE[theme];
  const examples = exampleFor(theme);

  return `あなたはLINEスタンプの企画者です。
「${theme === "custom" ? themeCustom : THEME_LABELS[theme]}」をテーマに、スタンプ${count}個分の企画をJSON配列で作ります。

テーマの方向性: ${guidance}

出力形式（この配列だけを出力。説明文やコードフェンスは不要）:
${JSON.stringify(examples, null, 2)}

ルール:
- 必ず${count}件ちょうど出力する
- text は日本語のセリフ。${MAX_TEXT_LENGTH}文字以内。短いほど良い
- text は全件すべて異なる内容にする
- emotion / pose / expression は英語で書く（画像生成AIに渡すため）
- pose は「体の動き」、expression は「顔の表情」を書き分ける
- 実在の人物・既存キャラクター・ブランド名・商標を一切含めない
- 日常で本当に使う言葉を選ぶ。凝った言い回しより使用頻度を優先する`;
}

async function buildManifest(
  theme: StickerTheme,
  themeCustom: string,
  count: number,
  characterName: string
): Promise<unknown> {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 4000,
    messages: [
      { role: "system", content: manifestSystemPrompt(theme, themeCustom, count) },
      {
        role: "user",
        content: `キャラクター名: ${characterName || "（未設定）"}\nスタンプ${count}個分の企画を作ってください。`,
      },
    ],
  });
  return extractJson(res.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: NextRequest) {
  try {
    const { id, code, sourcePrompt, sourceImageUrl, theme, themeCustom, count } =
      (await req.json()) as {
        id?: string;
        code?: string;
        sourcePrompt?: string;
        sourceImageUrl?: string;
        theme?: StickerTheme;
        themeCustom?: string;
        count?: number;
      };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    // 文章と画像のどちらか一方があればよい
    const safeImageUrl = (sourceImageUrl ?? "").trim();
    if (!sourcePrompt?.trim() && !safeImageUrl) {
      return NextResponse.json(
        { ok: false, error: "source_required" },
        { status: 400 }
      );
    }
    // 新規作成は提供中の枚数のみ。
    // （start 側は既存プロジェクトを完了させるため LINE 規格に対して緩く検証する）
    if (!isOfferedCount(Number(count))) {
      return NextResponse.json(
        { ok: false, error: "invalid_sticker_count" },
        { status: 400 }
      );
    }

    const safeTheme: StickerTheme = isValidTheme(theme) ? theme : "daily";
    const safeCustom = (themeCustom ?? "").trim();
    if (safeTheme === "custom" && !safeCustom) {
      return NextResponse.json(
        { ok: false, error: "theme_custom_required" },
        { status: 400 }
      );
    }

    // キャラ定義とスタンプ企画を並列で作る
    const [profileResult, manifestRaw] = await Promise.allSettled([
      buildProfile((sourcePrompt ?? "").trim(), safeImageUrl),
      buildManifest(safeTheme, safeCustom, Number(count), ""),
    ]);

    // プロフィールは生成に失敗しても sourcePrompt をそのまま使えるので致命的ではない
    const profile =
      profileResult.status === "fulfilled"
        ? profileResult.value
        : normalizeProfile(null);

    // 企画は失敗してもテンプレートで必ず count 件そろう
    const manifest = normalizeManifest(
      manifestRaw.status === "fulfilled" ? manifestRaw.value : null,
      safeTheme,
      Number(count)
    );

    return NextResponse.json({
      ok: true,
      profile,
      manifest,
      usedFallback: {
        profile: profileResult.status === "rejected",
        manifest: manifestRaw.status === "rejected",
      },
    });
  } catch (e) {
    console.error("[sticker/plan] failed:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
