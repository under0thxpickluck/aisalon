// app/api/nowpayments/ipn/route.ts
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { Buffer } from "buffer";
export const runtime = "nodejs";

function verifyNowpaymentsSig(rawBody: string, sigHeader: string | null, ipnSecret: string) {
  if (!sigHeader) return false;
  const hmac = crypto.createHmac("sha512", ipnSecret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");
  // 一応タイミング攻撃対策
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sigHeader));
}

export async function POST(req: Request) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET; // NOWPayments側で設定したIPN Secret
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  // raw body を取る（署名検証のため）
  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig");

  // 署名検証（強く推奨）
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

  // NOWPayments IPNの主な項目
  const orderId = payload?.order_id as string | undefined;  // "lifai_XXXX"
  const paymentStatus = payload?.payment_status as string | undefined; // finished/confirmed/waiting/failed など
  const invoiceId = payload?.invoice_id ?? payload?.payment_id; // どちらか入ることが多い
  const actuallyPaid = payload?.pay_amount ?? payload?.actually_paid; // あると便利

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "order_id missing", payload }, { status: 400 });
  }

  // order_id から applyId を復元
  const applyId = orderId.startsWith("lifai_") ? orderId.slice("lifai_".length) : orderId;

  // 入金確定扱いにするステータス（運用で調整）
  const isPaid =
    paymentStatus === "finished" ||
    paymentStatus === "confirmed";

  // GASに「支払いステータス更新」を投げる（applyの仕組みと同じ）
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

  // NOWPaymentsには基本200返せばOK（リトライ抑制）
  return NextResponse.json({ ok: true });
}
