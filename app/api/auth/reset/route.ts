import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || "");
    const password = String(body.password || "");

    if (!token || !password) {
      return NextResponse.json(
        { ok: false, error: "missing_fields" },
        { status: 400 }
      );
    }

    const url = process.env.GAS_WEBAPP_URL!;
    const key = process.env.GAS_API_KEY!;

    const res = await fetch(
      `${url}?action=reset_password&key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ✅ 重要：GAS doPost は body.action を見るので必ず入れる
          action: "reset_password",
          token,
          password,
        }),
      }
    );

    const json = await res.json();

    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}