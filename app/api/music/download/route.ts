import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = ["replicate.delivery"];

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

  if (!rawUrl)            return NextResponse.json({ error: "missing_url" },       { status: 400 });
  if (!isAllowed(rawUrl)) return NextResponse.json({ error: "disallowed_origin" }, { status: 403 });

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type":        upstream.headers.get("Content-Type") ?? "audio/wav",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
