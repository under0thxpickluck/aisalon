import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorized(realm: string) {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}"`,
    },
  });
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // /gift, /api/gift をパスワード保護
  const isGiftProtected =
    pathname.startsWith("/gift") ||
    pathname.startsWith("/api/gift");

  if (isGiftProtected) {
    const giftPass = process.env.GIFT_PASS || "nagoya01@";
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) return unauthorized("LIFAI GiftEP");
    const [, p] = Buffer.from(auth.slice(6), "base64").toString().split(":");
    if (p !== giftPass) return unauthorized("LIFAI GiftEP");
    return NextResponse.next();
  }

  // ✅ /admin, /api/admin をガード（/note-generator は BP 課金に移行）
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/5000/admin") ||
    pathname.startsWith("/api/5000/admin");
  if (!isProtected) return NextResponse.next();

  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASS || "";
  if (!user || !pass) return unauthorized("LIFAI Admin");

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized("LIFAI Admin");

  const base64 = auth.slice(6);
  const [u, p] = Buffer.from(base64, "base64").toString().split(":");

  if (u !== user || p !== pass) return unauthorized("LIFAI Admin");

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/gift/:path*",
    "/gift",
    "/api/gift/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/5000/admin/:path*",
    "/5000/admin",
    "/api/5000/admin/:path*",
  ],
};
