// app/api/referral/dashboard/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() {
  return jsonError(404, { ok: false, error: "not_found" });
}

export async function GET() {
  return jsonError(404, { ok: false, error: "not_found" });
}
