import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { amount, plan, applyId } = await req.json();

  if (!amount || !applyId) {
    return NextResponse.json(
      { ok: false, error: "amount/applyId required" },
      { status: 400 }
    );
  }

  // ✅ どっちのenv名でも拾えるようにする（保険）
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lifai.vercel.app";

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "NOWPAYMENTS_API_KEY is missing" },
      { status: 500 }
    );
  }

  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      price_amount: Number(amount),
      price_currency: "usd",
      pay_currency: "usdttrc20",
      order_id: `lifai_${applyId}`,
      order_description: `LIFAI plan ${plan || amount}`,
      ipn_callback_url: `${baseUrl}/api/nowpayments/ipn`,
      success_url: `${baseUrl}/apply?applyId=${encodeURIComponent(applyId)}`,
      cancel_url: `${baseUrl}/purchase`,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: data?.message || "nowpayments error", data },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, invoice_url: data.invoice_url, data });
}
