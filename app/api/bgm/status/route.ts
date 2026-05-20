import { NextResponse } from "next/server";
import {
  normalizeLoudness,
  bakeLoop,
  applyProEffects,
  extendLoop,
  cleanupTmp,
} from "@/app/lib/bgm-processor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // R2アップロード（ダウンロード+転送）を考慮して延長

// Replicateから取得したBGM音声をCloudflare R2に保存して永続URLを返す。
// R2 env vars が未設定またはアップロード失敗の場合は null を返す（呼び元でReplicateURLにフォールバック）。
async function tryUploadBgmToR2(replicateUrl: string, predictionId: string): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket    = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) return null;

  try {
    const audioRes = await fetch(replicateUrl, { cache: "no-store" });
    if (!audioRes.ok) return null;
    const audioBuffer = await audioRes.arrayBuffer();

    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region:      "auto",
      endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });

    const key = `bgm/${predictionId}/output.wav`;
    await s3.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        Buffer.from(audioBuffer),
      ContentType: "audio/wav",
    }));

    console.log(`[bgm/status] R2 upload succeeded: ${key}`);
    return `${publicUrl}/${key}`;
  } catch (err: any) {
    console.error("[bgm/status] R2 upload failed:", err?.message);
    return null;
  }
}

type BgmMode = "standard_loop" | "pro_loop";

async function processAndUpload(
  replicateUrl: string,
  predictionId: string,
  mode: BgmMode
): Promise<string | null> {
  const tmpIn = path.join(os.tmpdir(), `bgm_raw_${predictionId}.wav`);
  const temps: string[] = [tmpIn];

  try {
    const audioRes = await fetch(replicateUrl, { cache: "no-store" });
    if (!audioRes.ok) return null;
    const buf = await audioRes.arrayBuffer();
    fs.writeFileSync(tmpIn, Buffer.from(buf));

    const normalized = await normalizeLoudness(tmpIn);
    temps.push(normalized);

    const looped = await bakeLoop(normalized, 4);
    temps.push(looped);

    if (mode === "pro_loop") {
      const effected = await applyProEffects(looped);
      temps.push(effected);

      const extended = await extendLoop(effected, 180);
      temps.push(extended);

      return await tryUploadBgmToR2(extended, predictionId);
    }

    return await tryUploadBgmToR2(looped, predictionId);
  } catch (err: any) {
    console.error("[bgm/status] processAndUpload failed:", err?.message);
    return null;
  } finally {
    cleanupTmp(...temps);
  }
}

export async function GET(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "REPLICATE_API_TOKEN is missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id   = searchParams.get("id");
  const mode = (searchParams.get("mode") ?? "standard_loop") as BgmMode;

  if (!id) {
    return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.detail ?? data?.error ?? "replicate_error" },
        { status: 502 }
      );
    }

    const status = String(data.status ?? "processing");

    if (status === "failed" || status === "canceled") {
      return NextResponse.json({ ok: true, status: "failed", progress: 0, stage: "エラー" });
    }

    if (status !== "succeeded") {
      return NextResponse.json({
        ok: true,
        status: "processing",
        progress: status === "starting" ? 0.15 : 0.65,
        stage: "BGM生成中",
      });
    }

    const rawOutput = data.output;
    const outputUrl = rawOutput
      ? typeof rawOutput === "string" ? rawOutput
        : Array.isArray(rawOutput) && rawOutput[0] ? String(rawOutput[0]) : undefined
      : undefined;

    if (!outputUrl) {
      return NextResponse.json({ ok: true, status: "failed", progress: 0, stage: "エラー" });
    }

    console.log(`[bgm/status] post-process start: mode=${mode}`);
    const finalUrl = await processAndUpload(outputUrl, id, mode);

    if (!finalUrl) {
      const fallback = (await tryUploadBgmToR2(outputUrl, id)) ?? outputUrl;
      return NextResponse.json({ ok: true, status: "succeeded", progress: 1, stage: "完成", outputUrl: fallback });
    }

    return NextResponse.json({ ok: true, status: "succeeded", progress: 1, stage: "完成", outputUrl: finalUrl });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
