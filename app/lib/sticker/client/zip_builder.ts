// ブラウザ専用。書き出し済みPNGを LINE 提出用の ZIP にまとめる。
//
// サーバーを経由しないため、生成コストもタイムアウトも発生しない。

import { zipSync, strToU8 } from "fflate";
import { validateFileSizes } from "../line_spec";
import type { StickerExportMeta } from "../types";
import type { ExportedFile } from "./formatter";

export type ZipResult = {
  blob: Blob;
  issues: { field: string; message: string }[];
  totalBytes: number;
};

async function toBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 提出用ZIPを組み立てる。
 * 規格違反は例外にせず issues として返し、UIで警告表示する
 * （LINE側の仕様は変わりうるため、生成自体は止めない）。
 */
export async function buildZip(
  files: ExportedFile[],
  meta: StickerExportMeta
): Promise<ZipResult> {
  const issues = validateFileSizes(
    files.map((f) => ({ name: f.name, bytes: f.blob.size }))
  );

  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    entries[f.name] = await toBytes(f.blob);
  }
  entries["metadata.json"] = strToU8(JSON.stringify(meta, null, 2));

  // PNG は既に圧縮済みなので再圧縮しない（level 0）。書き出しが数倍速くなる。
  const zipped = zipSync(entries, { level: 0 });
  const blob = new Blob([zipped], { type: "application/zip" });

  return {
    blob,
    issues,
    totalBytes: files.reduce((sum, f) => sum + f.blob.size, 0),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** ファイル名に使えない文字を落とす */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "line-sticker";
}
