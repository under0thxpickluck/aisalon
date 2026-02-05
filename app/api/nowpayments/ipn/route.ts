import { NextResponse } from "next/server";
import crypto from "crypto";

// ✅ Vercel/NextでEdgeに行くとcryptoが死ぬので Node 固定
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();

  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return new NextResponse("NOWPAYMENTS_IPN_SECRET missing", { status: 500 });

  // ✅ ヘッダー名揺れ対策（どっちでも拾う）
  const signature =
    req.headers.get("x-nowpayments-sig") ||
    req.headers.get("x-nowpayments-signature") ||
    "";

  const hmac = crypto.createHmac("sha512", secret).update(body).digest("hex");

  // ✅ まずは確実に動く“文字列比較”でOK（ここで落ちるのが一番ダルい）
  if (!signature || hmac !== signature) {
    console.log("IPN invalid signature", { signature, hmac });
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const data = JSON.parse(body);
  const status = String(data.payment_status || "");
  const orderId = String(data.order_id || "");

  console.log("IPN received", { status, orderId });

  // ✅ 成功扱い（NOWPaymentsは段階がある）
  const SUCCESS = new Set(["confirmed", "finished", "sending"]);
  if (!SUCCESS.has(status)) {
    return NextResponse.json({ received: true, ignored: true, status });
  }

  // ✅ order_id: lifai_${applyId} から applyId を抜く
  const applyId = orderId.startsWith("lifai_") ? orderId.slice("lifai_".length) : "";
  if (!applyId) {
    console.log("applyId not found in order_id", { orderId });
    return NextResponse.json({ received: true, error: "applyId missing" });
  }

  // ✅ ここが「自動承認」本体：GASに approve 通知
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;
  if (!gasUrl || !gasAdminKey) {
    console.log("GAS env missing", { gasUrl: !!gasUrl, gasAdminKey: !!gasAdminKey });
    return NextResponse.json({ received: true, error: "GAS env missing" });
  }

  const approveRes = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "admin_approve",
      admin_key: gasAdminKey,
      applyId,
      payment: {
        provider: "nowpayments",
        payment_id: data.payment_id,
        status,
        pay_currency: data.pay_currency,
        price_amount: data.price_amount,
        pay_amount: data.pay_amount,
        actually_paid: data.actually_paid,
        txid: data.txid,
      },
    }),
  });

  const approveJson = await approveRes.json().catch(() => null);
  console.log("GAS approve result", approveRes.status, approveJson);

  return NextResponse.json({ received: true, approved: approveRes.ok, applyId });
}
