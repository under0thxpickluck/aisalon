import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { password } = body;

    const PASS   = process.env.FINANCE_UNLOCK_PASS;
    const SECRET = process.env.FINANCE_HMAC_SECRET;

    if (!PASS || !SECRET) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
    }
    if (!password || password !== PASS) {
      return NextResponse.json({ ok: false, error: "invalid_password" }, { status: 401 });
    }

    const timestamp = Date.now().toString();
    const hmac      = createHmac("sha256", SECRET).update(timestamp).digest("hex");
    const token     = `${timestamp}.${hmac}`;

    return NextResponse.json({ ok: true, token });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
