import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { id, code } = await req.json();

  const gasUrl = process.env.GAS_WEBAPP_URL!;
  const apiKey = process.env.GAS_API_KEY!;

  const r = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      action: "login",
      id,
      code,
    }),
  });

  const data = await r.json();

  return NextResponse.json(data);
}
