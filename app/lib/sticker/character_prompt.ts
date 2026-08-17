// CharacterProfile / StickerItem から画像生成プロンプトを組み立てる。
//
// 重要な前提が2つある。
//   1. 文字は絶対に画像AIに描かせない（日本語が崩れるため）。
//      → NO_TEXT を必ず末尾に付ける。文字は client/composer.ts が後から重ねる。
//   2. スタンプは小さく表示されるため、細部より輪郭の強さを優先する。

import type { CharacterProfile, StickerItem } from "./types";

// 画像AIに文字を描かせないための固定句
const NO_TEXT =
  "no text, no letters, no words, no captions, no watermark, no signature";

// スタンプとして成立させるための固定句
const STICKER_BASE = [
  "LINE sticker style",
  "single character only",
  "full body",
  "centered composition",
  "thick clean outline",
  "flat cel shading",
  "bright saturated colors",
  "simple and readable at small size",
  "transparent background",
].join(", ");

/** CharacterProfile を1行のプロンプト断片にする */
export function profileSummary(profile: CharacterProfile | null): string {
  if (!profile) return "";
  return [
    profile.species,
    profile.body ? `${profile.body} proportions` : "",
    profile.color ? `${profile.color} colored` : "",
    profile.eyes ? `${profile.eyes} eyes` : "",
    profile.ears ? `${profile.ears} ears` : "",
    profile.tail ? `${profile.tail} tail` : "",
    profile.clothes && profile.clothes !== "なし" ? `wearing ${profile.clothes}` : "",
    profile.style,
    profile.lineWidth ? `${profile.lineWidth} line width` : "",
    profile.extra,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

/** ① キャラクター基準画像（master）のプロンプト */
export function buildMasterPrompt(
  profile: CharacterProfile | null,
  sourcePrompt: string
): string {
  return [
    "character reference sheet of a single mascot character",
    profileSummary(profile) || sourcePrompt,
    "front facing, standing, neutral friendly expression",
    STICKER_BASE,
    "clear silhouette",
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * ①' アップロード画像から基準画像を作るときのプロンプト。
 * 元画像を images.edit に渡す前提で書く。
 * 写真でも絵でも、スタンプとして成立する形に描き起こさせる。
 */
export function buildMasterFromImagePrompt(
  profile: CharacterProfile | null,
  note: string
): string {
  return [
    "redraw the main subject of this image as a cute mascot character for a messaging sticker",
    "keep the recognizable features, colors and silhouette of the original",
    profileSummary(profile),
    note,
    "front facing, standing, neutral friendly expression",
    STICKER_BASE,
    "clear silhouette",
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(", ");
}

/** ② LOCK前にユーザーへ見せる表情バリエーションのプロンプト */
export function buildVariantPrompt(
  profile: CharacterProfile | null,
  sourcePrompt: string,
  variant: string
): string {
  return [
    "the exact same mascot character",
    profileSummary(profile) || sourcePrompt,
    variant,
    STICKER_BASE,
    "identical design, identical colors, identical proportions",
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(", ");
}

export const VARIANT_POSES = [
  "happy expression, waving one hand",
  "sad expression, drooping shoulders",
] as const;

/**
 * ③ 各スタンプのプロンプト。
 * master.png を images.edit の参照画像として渡す前提で書く。
 * 「同じキャラ」であることを言葉でも強く固定する。
 */
export function buildStickerPrompt(
  profile: CharacterProfile | null,
  item: Pick<StickerItem, "emotion" | "pose" | "expression">
): string {
  return [
    "redraw the exact same mascot character from the reference image",
    "keep identical design, identical colors, identical proportions, identical art style",
    profileSummary(profile),
    `${item.emotion} emotion`,
    item.pose,
    item.expression,
    STICKER_BASE,
    "leave empty space at the bottom for a caption",
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(", ");
}

/** 画像から CharacterProfile を起こすときのシステムプロンプト */
export const PROFILE_FROM_IMAGE_SYSTEM_PROMPT = `あなたはキャラクターデザイナーです。
渡された画像に写っている主役を、LINEスタンプ用マスコットに落とし込むための設計書をJSONで作ります。

出力するキーと形式は、文章から作る場合とまったく同じにしてください。

{
  "name": "キャラクターの名前（日本語・短く。画像から推測してよい）",
  "species": "英語。例: shiba inu dog / young woman / robot",
  "body": "英語。頭身。例: 2.5 head tall chibi",
  "color": "英語。主要な色",
  "eyes": "英語",
  "ears": "英語。無ければ空文字",
  "tail": "英語。無ければ空文字",
  "clothes": "英語。無いなら なし",
  "style": "英語。例: hand drawn kawaii mascot",
  "lineWidth": "英語。例: thick bold",
  "extra": "英語。見た目の特徴で外せないもの。無ければ空文字"
}

ルール:
- name 以外はすべて英語で書く（画像生成AIに渡すため）
- 画像に写っている特徴のうち、小さく表示しても判別できるものだけを残す
- 実在の人物名・ブランド名・既存キャラクター名は絶対に書かない
- 特定の個人と分かる特徴（ほくろの位置など）は書かない`;

/** LLM に CharacterProfile を作らせるときのシステムプロンプト */
export const PROFILE_SYSTEM_PROMPT = `あなたはキャラクターデザイナーです。
ユーザーが書いたキャラクターの説明から、LINEスタンプ用マスコットの設計書をJSONで作ります。

必ず次のキーを持つJSONオブジェクトだけを出力してください。説明文やコードフェンスは不要です。

{
  "name": "キャラクターの名前（日本語・短く）",
  "species": "英語。例: shiba inu dog",
  "body": "英語。頭身。例: 2.5 head tall chibi",
  "color": "英語。主要な色。例: light brown and cream",
  "eyes": "英語。例: round black button",
  "ears": "英語。例: small triangular",
  "tail": "英語。例: curled",
  "clothes": "英語。無いなら なし",
  "style": "英語。例: hand drawn kawaii mascot",
  "lineWidth": "英語。例: thick bold",
  "extra": "英語。その他の特徴。無ければ空文字"
}

ルール:
- name 以外はすべて英語で書く（画像生成AIに渡すため）
- 実在の人物・既存キャラクター・ブランドを想起させる語は使わない
- 単純で覚えやすい造形にする。小さく表示しても判別できることを最優先する`;
