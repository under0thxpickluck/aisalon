import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="LIFAI Admin"',
    },
  });
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // ✅ /admin と /api/admin をガード（ここ重要）
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdmin) return NextResponse.next();

  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASS || "";
  if (!user || !pass) return unauthorized();

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  const base64 = auth.slice(6);
  const [u, p] = Buffer.from(base64, "base64").toString().split(":");

  if (u !== user || p !== pass) return unauthorized();

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
