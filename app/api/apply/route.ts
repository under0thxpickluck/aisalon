import { NextResponse } from "next/server";

type ApplyPayload = {
  plan?: string;
  email?: string;
  name?: string;
  nameKana?: string;
  discordId?: string;
  ageBand?: string;
  prefecture?: string;
  city?: string;
  job?: string;
  refName?: string;
  refId?: string;
  applyId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ApplyPayload;

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const apiKey = process.env.GAS_API_KEY;

    if (!gasUrl) {
      return NextResponse.json(
        { ok: false, where: "env", error: "GAS_WEBAPP_URL missing" },
        { status: 500 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, where: "env", error: "GAS_API_KEY missing" },
        { status: 500 }
      );
    }

    // ✅ applyIdは必須（分裂防止）
    if (!body.applyId) {
      return NextResponse.json(
        { ok: false, where: "validation", error: "applyId missing" },
        { status: 400 }
      );
    }

    // ✅ ホワイトリスト整形
    const safePayload = {
      action: "apply",
      plan: body.plan ?? "",
      email: body.email ?? "",
      name: body.name ?? "",
      nameKana: body.nameKana ?? "",
      discordId: body.discordId ?? "",
      ageBand: body.ageBand ?? "",
      prefecture: body.prefecture ?? "",
      city: body.city ?? "",
      job: body.job ?? "",
      refName: body.refName ?? "",
      refId: body.refId ?? "",
      applyId: body.applyId,
    };

    const url = `${gasUrl}?key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safePayload),
      cache: "no-store",
    });

    const text = await r.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return NextResponse.json(
      {
        ok: r.ok && parsed?.ok !== false,
        gas: {
          httpStatus: r.status,
          parsed,
        },
      },
      { status: r.ok ? 200 : 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, where: "api", error: String(err) },
      { status: 500 }
    );
  }
}
