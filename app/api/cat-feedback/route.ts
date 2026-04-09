import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { logId, rating, comment, userMessage, pagePath } = await req.json();
    if (!logId || !rating) {
      return NextResponse.json({ ok: false, error: "logId and rating required" }, { status: 400 });
    }

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: true }); // GAS未設定時はスルー
    }

    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "cat_log_feedback",
        key: gasKey,
        log_id: logId,
        rating,
        comment: comment || "",
        user_message: userMessage || "",
        page_path: pagePath || "",
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
