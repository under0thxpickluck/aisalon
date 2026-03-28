import { NextResponse } from "next/server";

type Apply5000Payload = {
  applyId?: string;
  email?: string;
  name?: string;
  nameKana?: string;
  ageBand?: string;
  prefecture?: string;
  city?: string;
  job?: string;
  refName?: string;
  refId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Apply5000Payload;

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

    // applyIdがなければサーバー側で生成
    const applyId = body.applyId || `5000_${Date.now()}`;

    const safePayload = {
      action: "apply_5000",
      group: "5000",
      plan: "5000",
      applyId,
      email: body.email ?? "",
      name: body.name ?? "",
      nameKana: body.nameKana ?? "",
      discordId: "",
      ageBand: body.ageBand ?? "",
      prefecture: body.prefecture ?? "",
      city: body.city ?? "",
      job: body.job ?? "",
      refName: body.refName ?? "",
      refId: body.refId ?? "",
    };

    const url = `${gasUrl}?key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safePayload),
      cache: "no-store",
    });

    const text = await r.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return NextResponse.json(
      {
        ok: r.ok && (parsed as any)?.ok !== false,
        gas: { httpStatus: r.status, parsed },
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
