import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// R2の画像を同一オリジンで配信し直すプロキシ。
//
// なぜ必要か:
//   公開ドメイン pub-*.r2.dev は CORS ヘッダを返さず、設定もできない。
//   スタンプのプレビューとZIP書き出しは画像を canvas に描いてから
//   toBlob() する必要があるため、CORSが無いと
//     - crossOrigin="anonymous" での読み込みが失敗する（表示されない）
//     - canvas が汚染され toBlob() が SecurityError になる（書き出せない）
//   の2つが同時に起きる。同一オリジン経由にすればどちらも発生しない。

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "";

  if (!raw || !base) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // SSRF対策。オリジンを厳密に比較する。
  // startsWith による前方一致だと "https://pub-xxx.r2.dev@evil.com/..." を
  // 通してしまうため、必ず URL として解釈してから origin を突き合わせる。
  let target: URL;
  try {
    target = new URL(raw);
    if (target.origin !== new URL(base).origin) {
      return NextResponse.json({ ok: false, error: "forbidden_host" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { ok: false, error: "upstream_failed" },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        // キーはUUIDで再利用されないため、長期キャッシュしてよい
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[sticker/image] proxy failed:", e);
    return NextResponse.json({ ok: false, error: "proxy_failed" }, { status: 502 });
  }
}
