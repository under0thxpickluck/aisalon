import OpenAI, { toFile } from "openai";
import { randomUUID } from "crypto";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getR2Config() {
  return {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL,
  };
}

// 生成オプション。すべて任意で、省略時は従来と同じ挙動になる。
// （LINE Sticker Studio が transparent / quality を必要とするため追加した）
export type ImageOptions = {
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  /** R2の保存先プレフィックス。省略時は "images" */
  keyPrefix?: string;
};

async function uploadGeneratedImage(
  b64Json: string,
  keyPrefix = "images"
): Promise<string> {
  const { accountId, accessKey, secretKey, bucket, publicUrl } = getR2Config();
  const cleanBase64 = b64Json.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
    return `data:image/png;base64,${cleanBase64}`;
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const month = new Date().toISOString().slice(0, 7);
  const key = `${keyPrefix}/${month}/${randomUUID()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: "image/png",
  }));

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

/** URL の画像を OpenAI へ渡せる File に変換する */
async function fetchAsUploadable(url: string, name: string) {
  const source = await fetch(url);
  if (!source.ok) {
    throw new Error("image_fetch_failed");
  }
  const contentType = source.headers.get("content-type") || "image/png";
  const ext = contentType.includes("jpeg") || contentType.includes("jpg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  return toFile(Buffer.from(await source.arrayBuffer()), `${name}.${ext}`, {
    type: contentType,
  });
}

export async function generateImage(
  prompt: string,
  opts: ImageOptions = {}
): Promise<string> {
  const res = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: opts.size ?? "1024x1024",
    ...(opts.quality ? { quality: opts.quality } : {}),
    ...(opts.background ? { background: opts.background } : {}),
  });

  const item = res.data?.[0];
  if (item?.url) {
    return item.url;
  }
  if (item?.b64_json) {
    return uploadGeneratedImage(item.b64_json, opts.keyPrefix);
  }

  throw new Error("image_generation_failed");
}

export async function editImage(_params: {
  imageUrl: string;
  instruction: string;
  /** 追加で渡す参照画像。キャラクターの同一性を保つために使う */
  referenceUrls?: string[];
} & ImageOptions): Promise<string> {
  const urls = [_params.imageUrl, ...(_params.referenceUrls ?? [])];
  const files = await Promise.all(
    urls.map((u, i) => fetchAsUploadable(u, i === 0 ? "source" : `ref${i}`))
  );

  const res = await client.images.edit({
    model: "gpt-image-1",
    // 参照が1枚のときは従来どおり単体で渡す
    image: files.length === 1 ? files[0] : files,
    prompt: _params.instruction,
    size: _params.size ?? "1024x1024",
    ...(_params.quality ? { quality: _params.quality } : {}),
    ...(_params.background ? { background: _params.background } : {}),
  });

  const item = res.data?.[0];
  if (item?.url) {
    return item.url;
  }
  if (item?.b64_json) {
    return uploadGeneratedImage(item.b64_json, _params.keyPrefix);
  }

  throw new Error("image_edit_failed");
}
