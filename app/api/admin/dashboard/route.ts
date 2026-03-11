// app/api/admin/dashboard/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;

  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      cache:   "no-store",
      body:    JSON.stringify({ action: "admin_dashboard", adminKey: gasAdminKey }),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}
