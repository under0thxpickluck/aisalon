// lib/music/storage.ts
// raw / final / analysis.json を R2 に保存するヘルパー

import fs from "fs";

function getR2Config() {
  return {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket:    process.env.CLOUDFLARE_R2_BUCKET_NAME,
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL,
  };
}

async function getS3Client() {
  const { accountId, accessKey, secretKey } = getR2Config();
  if (!accountId || !accessKey || !secretKey) return null;

  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region:      "auto",
    endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

function buildPublicUrl(key: string): string | null {
  const { publicUrl } = getR2Config();
  if (!publicUrl) return null;
  return `${publicUrl}/${key}`;
}

/** ArrayBuffer を R2 に保存して公開 URL を返す */
async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  const { bucket } = getR2Config();
  if (!bucket) return null;

  const s3 = await getS3Client();
  if (!s3) return null;

  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    }));
    console.log(`[storage] Uploaded: ${key}`);
    return buildPublicUrl(key);
  } catch (err: any) {
    console.error(`[storage] Upload failed (${key}):`, err?.message);
    return null;
  }
}

/** ファイルパスから R2 に保存して公開 URL を返す */
async function uploadFile(
  filePath: string,
  key: string,
  contentType: string
): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    return uploadBuffer(buffer, key, contentType);
  } catch (err: any) {
    console.error(`[storage] File read failed (${filePath}):`, err?.message);
    return null;
  }
}

/** raw 音源（ArrayBuffer）を R2 に保存 */
export async function uploadRawAudio(
  audioBuffer: ArrayBuffer,
  jobId: string
): Promise<string | null> {
  const key = `songs/${jobId}/raw.mp3`;
  return uploadBuffer(Buffer.from(audioBuffer), key, "audio/mpeg");
}

/** final 音源（ファイルパス）を R2 に保存 */
export async function uploadFinalAudio(
  filePath: string,
  jobId: string
): Promise<string | null> {
  const key = `songs/${jobId}/final.mp3`;
  return uploadFile(filePath, key, "audio/mpeg");
}

/** analysis JSON を R2 に保存 */
export async function uploadAnalysisJson(
  analysis: Record<string, unknown>,
  jobId: string
): Promise<string | null> {
  const key = `songs/${jobId}/analysis.json`;
  const buffer = Buffer.from(JSON.stringify(analysis, null, 2), "utf-8");
  return uploadBuffer(buffer, key, "application/json");
}

/** /tmp の一時ファイルを削除（失敗は致命エラーにしない） */
export function cleanupTempFiles(...filePaths: string[]): void {
  for (const p of filePaths) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log(`[storage] Cleaned up: ${p}`);
      }
    } catch (err: any) {
      console.warn(`[storage] Cleanup failed (${p}):`, err?.message);
    }
  }
}
