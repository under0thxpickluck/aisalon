import { NextResponse } from "next/server";

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

export async function GET(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "REPLICATE_API_TOKEN is missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

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
    const rawOutput = data.output;
    const outputUrl =
      status === "succeeded" && rawOutput
        ? typeof rawOutput === "string"
          ? rawOutput
          : Array.isArray(rawOutput) && rawOutput[0]
            ? String(rawOutput[0])
            : undefined
        : undefined;

    // 完成時：R2に保存して永続URLに差し替える。失敗時はReplicateURLのまま返す。
    const finalUrl = outputUrl
      ? ((await tryUploadBgmToR2(outputUrl, id)) ?? outputUrl)
      : undefined;

    return NextResponse.json({
      ok: true,
      status,
      progress:
        status === "succeeded" ? 1 :
        status === "failed" || status === "canceled" ? 0 :
        status === "starting" ? 0.15 :
        0.65,
      stage:
        status === "succeeded" ? "完成" :
        status === "failed" || status === "canceled" ? "エラー" :
        "BGM生成中",
      ...(finalUrl ? { outputUrl: finalUrl } : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
