// app/api/nowpayments/ipn/route.ts
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { Buffer } from "buffer";

export const runtime = "nodejs";

// ブラウザで開いたとき用（NOWPaymentsはPOSTする）
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", hint: "POST webhook only" });
}

function verifyNowpaymentsSig(rawBody: string, sigHeader: string | null, ipnSecret: string) {
  try {
    if (!sigHeader) return false;

    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(rawBody);
    const digestHex = hmac.digest("hex");

    // ✅ hex文字列として比較する
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

  // 署名検証（ipnSecretがある時だけ）
  if (ipnSecret) {
    const ok = verifyNowpaymentsSig(raw, sig, ipnSecret);
    if (!ok) {
      // 署名NGなら401（ここは運用で200にしてもいいが、基本は401推奨）
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

  // GASへ通知（失敗してもIPNは200で返す）
  if (gasUrl && gasKey) {
    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    try {
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
    } catch (e) {
      // console.error("GAS notify failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}
