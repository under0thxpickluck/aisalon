import { NextRequest, NextResponse } from "next/server";
import { calcImageCost } from "@/app/lib/image/cost_calculator";
import type { ImageChatState } from "@/app/lib/image/image_types";

export async function POST(req: NextRequest) {
  try {
    const { state } = await req.json() as { state: ImageChatState };
    const result = calcImageCost(state);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
