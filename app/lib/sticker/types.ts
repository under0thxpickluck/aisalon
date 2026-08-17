// LINE Sticker Studio の型定義
// プロジェクト全体が sticker_projects シートの project_json 列に
// 1つのJSON文字列として保存される。

export type StickerCount = 8 | 16 | 24 | 32 | 40;

export type StickerTheme =
  | "daily"
  | "polite"
  | "couple"
  | "work"
  | "funny"
  | "custom";

// キャラクター定義（Character Bible）
// LLM がユーザーの文章から生成し、全スタンプの生成プロンプトの土台になる。
export type CharacterProfile = {
  name: string;
  species: string;
  body: string;      // 例: "2.5頭身"
  color: string;
  eyes: string;
  ears: string;
  tail: string;
  clothes: string;
  style: string;     // 例: "手描きゆるキャラ"
  lineWidth: string; // 例: "太め"
  extra: string;
};

export type StickerAsset = {
  version: number;
  imageUrl: string;
  createdAt: string;
};

export type StickerItemStatus = "pending" | "rendering" | "done" | "failed";

export type StickerItem = {
  index: number; // 1 始まり
  text: string;
  emotion: string;
  pose: string;
  expression: string;
  assets: StickerAsset[];
  selectedVersion: number; // 0 = 未選択
  status: StickerItemStatus;
};

export type StickerCharacter = {
  sourcePrompt: string;
  profile: CharacterProfile | null;
  masterUrl: string;
  variantUrls: string[];
  locked: boolean;
};

export type StickerExportMeta = {
  title: string;
  description: string;
  creator: string;
  copyright: string;
};

export type StickerProjectStatus =
  | "draft"       // 入力中
  | "character"   // キャラ生成済み・LOCK前
  | "planning"    // LOCK済み・企画待ち
  | "rendering"   // 一括生成中
  | "ready";      // 全枚数完成

export type StickerProject = {
  version: 1;
  projectId: string;
  name: string;
  count: StickerCount;
  theme: StickerTheme;
  themeCustom: string;
  character: StickerCharacter;
  items: StickerItem[];
  credits: number; // 残り生成回数（先払い済み）
  meta: StickerExportMeta;
  status: StickerProjectStatus;
  createdAt: string;
  updatedAt: string;
};

// LLM が返すスタンプ企画1件（生成前の素の形）
export type ManifestEntry = {
  id: number;
  text: string;
  emotion: string;
  pose: string;
  expression: string;
};

export function emptyCharacterProfile(): CharacterProfile {
  return {
    name: "",
    species: "",
    body: "",
    color: "",
    eyes: "",
    ears: "",
    tail: "",
    clothes: "",
    style: "",
    lineWidth: "",
    extra: "",
  };
}

export function selectedAssetUrl(item: StickerItem): string {
  if (!item.selectedVersion) return "";
  const hit = item.assets.find((a) => a.version === item.selectedVersion);
  return hit?.imageUrl ?? "";
}

// 1枚あたりに残す世代数。
// プロジェクト全体を1セルのJSONとして保存するため、
// 無制限に貯めるとスプレッドシートのセル上限（50,000文字）に当たる。
export const MAX_ASSET_VERSIONS = 5;

/** 生成結果を新しい世代として追加し、それを選択状態にする */
export function appendAsset(item: StickerItem, imageUrl: string): StickerItem {
  const lastVersion = item.assets.length
    ? item.assets[item.assets.length - 1].version
    : 0;
  const version = lastVersion + 1;
  const assets = [
    ...item.assets,
    { version, imageUrl, createdAt: new Date().toISOString() },
  ].slice(-MAX_ASSET_VERSIONS);

  return { ...item, assets, selectedVersion: version, status: "done" };
}
