import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      ...(outputUrl ? { outputUrl } : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
