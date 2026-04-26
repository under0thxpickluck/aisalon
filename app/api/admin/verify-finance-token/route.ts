import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { token } = body;

    const SECRET = process.env.FINANCE_HMAC_SECRET;
    if (!SECRET) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
    }
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, valid: false });
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
      return NextResponse.json({ ok: false, valid: false });
    }

    const [timestamp, hmac] = parts;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return NextResponse.json({ ok: false, valid: false });
    }
    if (Date.now() - ts > TOKEN_TTL_MS) {
      return NextResponse.json({ ok: false, valid: false, reason: "expired" });
    }

    const expected = createHmac("sha256", SECRET).update(timestamp).digest("hex");
    let valid = false;
    try {
      valid = timingSafeEqual(
        Buffer.from(hmac.padEnd(64, "0"), "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      valid = false;
    }

    return NextResponse.json({ ok: valid, valid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
