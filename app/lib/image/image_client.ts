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

/**
 * 任意の画像バイト列をR2に保存し、公開URLを返す。
 * R2が未設定のときは data: URI を返す（呼び元でその扱いを決める）。
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  contentType = "image/png",
  keyPrefix = "images"
): Promise<string> {
  const { accountId, accessKey, secretKey, bucket, publicUrl } = getR2Config();

  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const month = new Date().toISOString().slice(0, 7);
  const key = `${keyPrefix}/${month}/${randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

async function uploadGeneratedImage(
  b64Json: string,
  keyPrefix = "images"
): Promise<string> {
  const cleanBase64 = b64Json.replace(/^data:image\/\w+;base64,/, "");
  return uploadImageBuffer(Buffer.from(cleanBase64, "base64"), "image/png", keyPrefix);
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

// gpt-image-1 の課金はトークン建て（2026-08時点）:
//   テキスト入力 $5 / 1M・画像入力 $10 / 1M・画像出力 $40 / 1M
// images.edit は参照画像の入力トークンも課金されるため、
// 実使用量を残しておかないと原価が読めない。
const PRICE_PER_1M = { text: 5, image: 10, output: 40 } as const;

function logUsage(label: string, usage: any) {
  if (!usage) return;
  const textIn = Number(usage.input_tokens_details?.text_tokens ?? 0);
  const imageIn = Number(usage.input_tokens_details?.image_tokens ?? 0);
  const out = Number(usage.output_tokens ?? 0);
  const usd =
    (textIn * PRICE_PER_1M.text +
      imageIn * PRICE_PER_1M.image +
      out * PRICE_PER_1M.output) /
    1_000_000;
  console.log(
    `[image-cost] ${label} text_in=${textIn} image_in=${imageIn} out=${out} usd=${usd.toFixed(4)}`
  );
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

  logUsage(`generate q=${opts.quality ?? "auto"}`, (res as any).usage);

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

  logUsage(
    `edit q=${_params.quality ?? "auto"} refs=${files.length}`,
    (res as any).usage
  );

  const item = res.data?.[0];
  if (item?.url) {
    return item.url;
  }
  if (item?.b64_json) {
    return uploadGeneratedImage(item.b64_json, _params.keyPrefix);
  }

  throw new Error("image_edit_failed");
}
