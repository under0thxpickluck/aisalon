import { NextResponse } from "next/server";
import { getCachedLyrics, getJob, updateJob } from "../_cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5分（Vercel / Next.js タイムアウト延長）

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
    return NextResponse.json(
      { ok: false, error: "id_required" },
      { status: 400 }
    );
  }

  try {
    // ── マルチセクションジョブか確認 ────────────────────────────
    const job = getJob(id);
    if (job) {
      const cachedLyrics = getCachedLyrics(id);
      const lyricsPart = cachedLyrics ? { lyrics: cachedLyrics } : {};

      // 完了・失敗済み
      if (job.stage === "done") {
        return NextResponse.json({ ok: true, status: "succeeded", stage: "完成", progress: 1, outputUrl: job.outputUrl, ...lyricsPart });
      }
      if (job.stage === "failed") {
        return NextResponse.json({ ok: true, status: "failed", stage: "エラー", progress: 0 });
      }
      if (job.stage === "merging") {
        return NextResponse.json({ ok: true, status: "processing", stage: "結合中", progress: 0.9, ...lyricsPart });
      }

      // 現ステージの予測IDとラベルを決定
      const currentId =
        job.stage === "verse"  ? job.verseId  :
        job.stage === "chorus" ? job.chorusId :
        job.bridgeId;
      const stageLabel =
        job.stage === "verse"  ? "Verse生成中"  :
        job.stage === "chorus" ? "Chorus生成中" :
        "Bridge生成中";
      const stageProgress =
        job.stage === "verse"  ? 0.2  :
        job.stage === "chorus" ? 0.55 :
        0.75;

      // 現ステージの予測をポーリング
      const predRes = await fetch(`https://api.replicate.com/v1/predictions/${currentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const predData = await predRes.json();

      if (!predRes.ok) {
        return NextResponse.json({ ok: false, error: predData?.detail ?? "replicate_error" }, { status: 502 });
      }

      const predStatus: string = predData.status;

      if (predStatus === "failed" || predStatus === "canceled") {
        updateJob(id, { stage: "failed" });
        return NextResponse.json({ ok: true, status: "failed", stage: "エラー", progress: 0 });
      }

      if (predStatus === "succeeded") {
        // 出力URLを抽出
        const raw = predData.output;
        const sectionUrl: string =
          typeof raw === "string" ? raw :
          Array.isArray(raw) && raw[0] ? String(raw[0]) : "";

        if (!sectionUrl) {
          updateJob(id, { stage: "failed" });
          return NextResponse.json({ ok: true, status: "failed", stage: "エラー（出力なし）", progress: 0 });
        }

        if (job.stage === "verse") {
          updateJob(id, { stage: "chorus", verseUrl: sectionUrl });
          return NextResponse.json({ ok: true, status: "processing", stage: "Chorus生成中", progress: 0.37, ...lyricsPart });
        }
        if (job.stage === "chorus") {
          updateJob(id, { stage: "bridge", chorusUrl: sectionUrl });
          return NextResponse.json({ ok: true, status: "processing", stage: "Bridge生成中", progress: 0.67, ...lyricsPart });
        }

        // Bridge完了 → マージサーバーに送信
        updateJob(id, { stage: "merging", bridgeUrl: sectionUrl });
        const mergeServerUrl = process.env.MERGE_SERVER_URL;
        if (!mergeServerUrl) {
          updateJob(id, { stage: "failed" });
          return NextResponse.json({ ok: true, status: "failed", stage: "エラー（MERGE_SERVER_URL未設定）", progress: 0 });
        }

        try {
          const refreshed = getJob(id)!;
          const mergeRes = await fetch(`${mergeServerUrl}/merge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sections: [refreshed.verseUrl, refreshed.chorusUrl, sectionUrl],
              job_id: id,
            }),
          });
          const mergeData = await mergeRes.json().catch(() => ({}));
          const mergedUrl: string = mergeData?.url || mergeData?.outputUrl || "";

          if (mergedUrl) {
            updateJob(id, { stage: "done", outputUrl: mergedUrl });
            return NextResponse.json({ ok: true, status: "succeeded", stage: "完成", progress: 1, outputUrl: mergedUrl, ...lyricsPart });
          } else {
            updateJob(id, { stage: "failed" });
            return NextResponse.json({ ok: true, status: "failed", stage: "エラー（結合失敗）", progress: 0 });
          }
        } catch (mergeErr: any) {
          updateJob(id, { stage: "failed" });
          return NextResponse.json({ ok: true, status: "failed", stage: "エラー（結合失敗）", progress: 0 });
        }
      }

      // starting / processing: 継続
      return NextResponse.json({ ok: true, status: "processing", stage: stageLabel, progress: stageProgress, ...lyricsPart });
    }
    // ── 既存：単一予測ポーリング（後方互換） ────────────────────

    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        Authorization: `Token ${token}`,
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.detail ?? "replicate_error" },
        { status: 502 }
      );
    }

    const status: "starting" | "processing" | "succeeded" | "failed" =
      data.status;

    // MusicGen は output を string (URI) で返す。配列の場合も両方対応
    const rawOutput = data.output;
    const outputUrl: string | undefined =
      status === "succeeded" && rawOutput
        ? typeof rawOutput === "string"
          ? rawOutput
          : Array.isArray(rawOutput) && rawOutput[0]
          ? String(rawOutput[0])
          : undefined
        : undefined;

    const cachedLyrics = getCachedLyrics(id);

    return NextResponse.json(
      {
        ok: true,
        status,
        ...(outputUrl ? { outputUrl } : {}),
        ...(cachedLyrics ? { lyrics: cachedLyrics } : {}),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
