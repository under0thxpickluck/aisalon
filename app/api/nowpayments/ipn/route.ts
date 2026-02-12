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

  // ✅ テスト用：このヘッダが付いてたら署名チェックをスキップ（課金なしテスト用）
  // PowerShellなどから叩くときに `x-test-ipn: 1` を付ける
  const isTest = req.headers.get("x-test-ipn") === "1";

  console.log("[IPN] hit", new Date().toISOString());
  console.log("[IPN] isTest", isTest);
  console.log("[IPN] sig", sig);
  console.log("[IPN] raw", raw.slice(0, 200));

  // 署名検証（ipnSecretがある時だけ）
  // ✅ ただしテストの時はスキップ
  if (ipnSecret && !isTest) {
    const ok = verifyNowpaymentsSig(raw, sig, ipnSecret);
    console.log("[IPN] sig_ok", ok);

    if (!ok) {
      console.warn("[IPN] bad signature");
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  } else {
    console.log("[IPN] signature skipped (test or no secret)");
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  console.log("[IPN] payment_status", payload?.payment_status, "order_id", payload?.order_id);

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
      const r = await fetch(url, {
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
          isTest, // ←GAS側でログに出したい時用
        }),
      });

      console.log("[IPN] GAS status", r.status);
    } catch (e) {
      console.error("GAS notify failed", e);
    }
  } else {
    console.log("[IPN] GAS skipped (missing env)", { gasUrl: !!gasUrl, gasKey: !!gasKey });
  }

  return NextResponse.json({ ok: true, isTest });
}
