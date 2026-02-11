// app/api/nowpayments/ipn/route.ts
import { NextResponse } from "next/server";
import * as crypto from "crypto";

export const runtime = "nodejs";

// ✅ GETで叩かれても落ちない（疎通確認用）
export async function GET() {
  return NextResponse.json({ ok: true, route: "nowpayments ipn" });
}

function verifyNowpaymentsSig(rawBody: string, sigHeader: string | null, ipnSecret: string) {
  if (!sigHeader) return false;

  const hmac = crypto.createHmac("sha512", ipnSecret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  // ✅ 長さが違うと timingSafeEqual が例外を投げてクラッシュするので防ぐ
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(String(sigHeader).trim(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET; // NOWPayments側のIPN Secret
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig");

  // 署名検証（入れておく）
  if (ipnSecret) {
    const ok = verifyNowpaymentsSig(raw, sig, ipnSecret);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const orderId = payload?.order_id as string | undefined;
  const paymentStatus = payload?.payment_status as string | undefined;
  const invoiceId = payload?.invoice_id ?? payload?.payment_id;
  const actuallyPaid = payload?.pay_amount ?? payload?.actually_paid;

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "order_id missing", payload }, { status: 400 });
  }

  const applyId = orderId.startsWith("lifai_") ? orderId.slice("lifai_".length) : orderId;

  const isPaid = paymentStatus === "finished" || paymentStatus === "confirmed";

  if (gasUrl && gasKey) {
    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "payment_update",
        applyId,
        orderId,
        paymentStatus,
        isPaid,
        invoiceId,
        actuallyPaid,
        raw: payload,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
