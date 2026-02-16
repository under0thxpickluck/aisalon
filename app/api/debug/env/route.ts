import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    GAS_WEBAPP_URL: process.env.GAS_WEBAPP_URL || null,
    GAS_API_KEY: process.env.GAS_API_KEY ? "set" : null,
    GAS_ADMIN_KEY: process.env.GAS_ADMIN_KEY ? "set" : null,
  });
}