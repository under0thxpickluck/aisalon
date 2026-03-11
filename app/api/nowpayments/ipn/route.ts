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
  const isTest = process.env.NODE_ENV !== "production" && req.headers.get("x-test-ipn") === "1";

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

  // ✅ “軸”を揃えるために通貨/金額情報を拾う（GASで突合に使える）
  const payAmount = payload?.pay_amount ?? payload?.actually_paid;
  const payCurrency = payload?.pay_currency ?? payload?.pay_currency_code;
  const priceAmount = payload?.price_amount ?? payload?.amount;
  const priceCurrency = payload?.price_currency ?? payload?.price_currency_code;

  // ✅ 参考：NOWPaymentsが返す可能性のある別名も拾う（壊さない）
  const actuallyPaid = payload?.actually_paid ?? payload?.pay_amount ?? payload?.amount_received;

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "order_id missing", payload }, { status: 400 });
  }

  const applyId = orderId.startsWith("lifai_") ? orderId.slice("lifai_".length) : orderId;

  // ✅ isPaid 判定を GAS 側の集合に揃える（finished/confirmed/paid）
  const isPaid =
    paymentStatus === "finished" || paymentStatus === "confirmed" || paymentStatus === "paid";

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

          // ✅ 既存の actuallyPaid は残す（壊さない）
          actuallyPaid,

          // ✅ 追加：金額突合に必要な “軸” 情報（壊さない）
          payAmount,
          payCurrency,
          priceAmount,
          priceCurrency,

          // ✅ 既存：生ログ（壊さない）
          raw: payload,

          // ←GAS側でログに出したい時用
          isTest,
        }),
      });

      console.log("[IPN] GAS status", r.status);
      try {
        const t = await r.text();
        console.log("[IPN] GAS body", t.slice(0, 300));
      } catch {}
    } catch (e) {
      console.error("GAS notify failed", e);
    }
  } else {
    console.log("[IPN] GAS skipped (missing env)", { gasUrl: !!gasUrl, gasKey: !!gasKey });
  }

  return NextResponse.json({ ok: true, isTest });
}