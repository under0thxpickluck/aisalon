// app/api/nowpayments/ipn/route.ts
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { Buffer } from "buffer";

export const runtime = "nodejs";

// ✅ GETでも落とさない（疎通確認用）
export async function GET() {
  return NextResponse.json({ ok: true, message: "ipn endpoint alive" }, { status: 200 });
}

function verifyNowpaymentsSig(rawBody: string, sigHeader: string | null, ipnSecret: string) {
  if (!sigHeader) return false;

  const hmac = crypto.createHmac("sha512", ipnSecret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  // ✅ timingSafeEqualは「長さが違う」と例外で落ちるのでガード
  const a = Buffer.from(digest);
  const b = Buffer.from(sigHeader);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || "";
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;

    const raw = await req.text();
    const sig = req.headers.get("x-nowpayments-sig");

    // ✅ 署名検証（Secretが入っている時だけ）
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

    // ✅ GASへ更新
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
  } catch (err) {
    // ✅ ここに来ても落とさず500 JSONを返す
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
