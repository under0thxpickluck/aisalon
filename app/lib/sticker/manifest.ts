// LLM が返した企画JSON（Sticker Manifest）とキャラクター定義の検証・正規化。
//
// LLM の出力は信用しない。壊れていたらテンプレートにフォールバックする。

import type {
  CharacterProfile,
  ManifestEntry,
  StickerItem,
  StickerTheme,
} from "./types";
import { emptyCharacterProfile } from "./types";
import { templateFor } from "./templates";

// スタンプのセリフが長すぎると 370x320 に収まらないため制限する
export const MAX_TEXT_LENGTH = 12;

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}

/** ```json ... ``` で囲まれていても取り出せるようにする */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    // 前後に説明文が付いている場合に備えて最初の [ か { から探す
    const start = body.search(/[[{]/);
    if (start < 0) return null;
    const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
    if (end <= start) return null;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function normalizeProfile(input: unknown): CharacterProfile {
  const base = emptyCharacterProfile();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  return {
    name: asString(o.name),
    species: asString(o.species),
    body: asString(o.body),
    color: asString(o.color),
    eyes: asString(o.eyes),
    ears: asString(o.ears),
    tail: asString(o.tail),
    clothes: asString(o.clothes),
    style: asString(o.style),
    lineWidth: asString(o.lineWidth ?? o.line_width),
    extra: asString(o.extra),
  };
}

/**
 * LLM が返した配列を ManifestEntry[] に正規化する。
 * 不足分・不正な行はテンプレートで補うため、必ず count 件そろって返る。
 */
export function normalizeManifest(
  input: unknown,
  theme: StickerTheme,
  count: number
): ManifestEntry[] {
  const fallback = templateFor(theme, count);
  const rows = Array.isArray(input)
    ? input
    : Array.isArray((input as Record<string, unknown>)?.stickers)
      ? ((input as Record<string, unknown>).stickers as unknown[])
      : [];

  const out: ManifestEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (out.length >= count) break;
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;

    const text = asString(o.text).slice(0, MAX_TEXT_LENGTH);
    if (!text) continue;
    // 同じセリフが並ぶと審査で「同一画像の重複」を疑われるため落とす
    if (seen.has(text)) continue;
    seen.add(text);

    const i = out.length;
    out.push({
      id: i + 1,
      text,
      emotion: asString(o.emotion, fallback[i].emotion),
      pose: asString(o.pose, fallback[i].pose),
      expression: asString(o.expression, fallback[i].expression),
    });
  }

  // 足りない分をテンプレートで埋める（セリフ重複は避ける）
  for (const entry of fallback) {
    if (out.length >= count) break;
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    out.push({ ...entry, id: out.length + 1 });
  }

  // それでも足りなければ連番で埋める（テンプレートを使い切った場合）
  let n = 1;
  while (out.length < count) {
    const entry = fallback[out.length % fallback.length];
    out.push({ ...entry, id: out.length + 1, text: `${entry.text}${n++}` });
  }

  return out;
}

/** ManifestEntry[] を、生成状態を持つ StickerItem[] に変換する */
export function toStickerItems(entries: ManifestEntry[]): StickerItem[] {
  return entries.map((e, i) => ({
    index: i + 1,
    text: e.text,
    emotion: e.emotion,
    pose: e.pose,
    expression: e.expression,
    assets: [],
    selectedVersion: 0,
    status: "pending" as const,
  }));
}
