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

  // /5000 系は全て OV (lifaiov.vercel.app) にリダイレクト
  if (pathname === "/5000" || pathname.startsWith("/5000/") || pathname.startsWith("/api/5000/")) {
    const ovUrl = `https://lifaiov.vercel.app${pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(ovUrl);
  }

  // ✅ /admin, /api/admin をガード（/note-generator は BP 課金に移行）
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin");
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
    "/5000",
    "/5000/:path*",
    "/api/5000/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
