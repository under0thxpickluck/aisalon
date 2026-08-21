import { NextRequest, NextResponse } from "next/server";
import { withBp, changeCredits, BpError } from "@/app/lib/sticker/gas";
import { packCost, creditsForPack } from "@/app/lib/sticker/cost";
import { isValidStickerCount } from "@/app/lib/sticker/line_spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// スタンプ一括生成の先払い。
// パック代を1回だけ引き落とし、生成クレジットを枚数分だけ発行する。
// 以降の各枚生成は BP を触らず、このクレジットを1つずつ消費する。
export async function POST(req: NextRequest) {
  try {
    const { id, code, projectId, count } = (await req.json()) as {
      id?: string;
      code?: string;
      projectId?: string;
      count?: number;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    if (!isValidStickerCount(Number(count))) {
      return NextResponse.json(
        { ok: false, error: "invalid_sticker_count" },
        { status: 400 }
      );
    }

    const amount = packCost(Number(count));
    const grant = creditsForPack(Number(count));

    // クレジット発行を work の中でやることで、
    // 発行に失敗したときは withBp が BP を返金する。
    const credits = await withBp(
      { id, amount, reason: `sticker_pack_${count}` },
      async () => {
        const res = await changeCredits(id, projectId, grant);
        if (!res.ok) {
          // GAS が bad_action を返すのは sticker_* が本番GASに未反映のとき。
          // 原因が全く違うので、まとめて credit_grant_failed にせず区別する。
          console.error("[sticker/start] credit grant failed:", res.error);
          throw new BpError(
            res.error === "bad_action" ? "gas_not_deployed" : "credit_grant_failed",
            502,
            undefined,
            res.error
          );
        }
        return res.credits;
      }
    );

    return NextResponse.json({ ok: true, credits, bpUsed: amount });
  } catch (e) {
    if (e instanceof BpError) {
      if (e.detail) console.error("[sticker/start]", e.message, "-", e.detail);
      return NextResponse.json(
        { ok: false, error: e.message, required: e.required, detail: e.detail },
        { status: e.status }
      );
    }
    console.error("[sticker/start] failed:", e);
    return NextResponse.json({ ok: false, error: "start_failed" }, { status: 500 });
  }
}
