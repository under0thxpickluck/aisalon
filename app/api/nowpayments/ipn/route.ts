// app/api/nowpayments/ipn/route.ts
import { NextResponse } from "next/server";
import * as crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";

// NOWPaymentsの署名は「sha512 HMAC の hex文字列」で来る想定
function verifyNowpaymentsSig(
  rawBody: string,
  sigHeader: string | null,
  ipnSecret: string
) {
  if (!sigHeader) return false;

  const hmac = crypto.createHmac("sha512", ipnSecret);
  hmac.update(rawBody);
  const digestHex = hmac.digest("hex"); // 128文字(hex)

  // ✅ hexとしてバイナリ化（64bytes）
  const a = Buffer.from(digestHex, "hex");

  // sigHeader が hex じゃない形式で来ても落ちないようにガード
  let b: Buffer;
  try {
    // 0xプレフィックスが付くケースも一応ケア
    const cleaned = sigHeader.startsWith("0x") ? sigHeader.slice(2) : sigHeader;
    b = Buffer.from(cleaned, "hex");
  } catch {
    return false;
  }

  // ✅ timingSafeEqualは「長さ違い」で例外になるので先に判定
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

// ブラウザで開いた時用（動作確認できるようにする）
export async function GET() {
  return NextResponse.json({ ok: true, route: "nowpayments/ipn" });
}

export async function POST(req: Request) {
  try {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET; // NOWPayments側で表示されるIPN secret
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;

    const raw = await req.text();
    const sig = req.headers.get("x-nowpayments-sig");

    // 署名検証（secretが設定されてる時だけ）
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

    // GASへ通知（失敗してもIPN自体は200返してNOW側のリトライ地獄を避ける）
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
        // ここで落とさない
        console.error("GAS notify failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("IPN crashed:", e);
    return NextResponse.json({ ok: false, error: "ipn crashed" }, { status: 500 });
  }
}
