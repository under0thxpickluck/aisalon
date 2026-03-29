import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { Buffer } from "buffer";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", hint: "POST webhook only" });
}

function verifyNowpaymentsSig(rawBody: string, sigHeader: string | null, ipnSecret: string) {
  try {
    if (!sigHeader) return false;
    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(rawBody);
    const digestHex = hmac.digest("hex");
    const a = Buffer.from(digestHex, "hex");
    const b = Buffer.from(sigHeader, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig");
  const isTest = process.env.NODE_ENV !== "production" && req.headers.get("x-test-ipn") === "1";

  console.log("[5000/IPN] hit", new Date().toISOString());
  console.log("[5000/IPN] isTest", isTest);

  if (ipnSecret && !isTest) {
    const ok = verifyNowpaymentsSig(raw, sig, ipnSecret);
    if (!ok) {
      console.warn("[5000/IPN] bad signature");
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const applyId = payload?.order_id as string | undefined;
  if (!applyId) {
    return NextResponse.json({ ok: false, error: "order_id missing" }, { status: 400 });
  }

  const paymentStatus = payload?.payment_status as string | undefined;
  const paymentId = payload?.payment_id;
  const actuallyPaid = payload?.actually_paid ?? payload?.pay_amount ?? 0;
  const payAmount = payload?.pay_amount ?? payload?.actually_paid;
  const payCurrency = payload?.pay_currency ?? payload?.pay_currency_code;
  const priceAmount = payload?.price_amount ?? payload?.amount;
  const priceCurrency = payload?.price_currency ?? payload?.price_currency_code;

  console.log("[5000/IPN] applyId", applyId, "paymentStatus", paymentStatus);

  if (gasUrl && gasKey) {
    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "payment_update_5000",
          applyId,
          paymentId,
          paymentStatus,
          actuallyPaid,
          payAmount,
          payCurrency,
          priceAmount,
          priceCurrency,
          isTest,
        }),
      });
      console.log("[5000/IPN] GAS status", r.status);
      try {
        const t = await r.text();
        console.log("[5000/IPN] GAS body", t.slice(0, 300));
      } catch {}
    } catch (e) {
      console.error("[5000/IPN] GAS notify failed", e);
    }
  }

  return NextResponse.json({ ok: true, isTest });
}
