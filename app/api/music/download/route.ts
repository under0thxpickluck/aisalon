import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// 許可ホストをモジュール初期化時に一度だけ構築する。
// replicate.delivery は固定。CLOUDFLARE_R2_PUBLIC_URL と MERGE_SERVER_URL が設定されていれば
// そのホストも許可することで、Songモード(R2)とstandard/proモード(マージサーバー)のダウンロードを通す。
const ALLOWED_HOSTS: string[] = (() => {
  const hosts = ["replicate.delivery"];
  const extras = [
    process.env.CLOUDFLARE_R2_PUBLIC_URL,
    process.env.MERGE_SERVER_URL,
  ];
  for (const u of extras) {
    if (!u) continue;
    try { hosts.push(new URL(u).hostname); } catch {}
  }
  return hosts;
})();

function isAllowed(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl   = searchParams.get("url") ?? "";
  const filename = searchParams.get("filename") || "lifai_song.wav";
  const safeFilename = filename.replace(/["\\\r\n]/g, "");

  if (!rawUrl)            return NextResponse.json({ error: "missing_url" },       { status: 400 });
  if (!isAllowed(rawUrl)) return NextResponse.json({ error: "disallowed_origin" }, { status: 403 });

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

  const upstreamType = upstream.headers.get("Content-Type") ?? "";
  const contentType = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/x-wav"].includes(upstreamType)
    ? upstreamType
    : "audio/wav";

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
