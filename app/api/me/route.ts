// app/api/me/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MeRequest = {
  id?: string;
  code?: string;
};

type GasMeResponse =
  | {
      ok: true;
      login_id: string;
      email: string;
      status: string;
      my_ref_code: string;
      ref_path?: string;
      referrer_login_id?: string;
      referrer_2_login_id?: string;
      referrer_3_login_id?: string;
    }
  | {
      ok: false;
      reason?: "invalid" | "pending";
      error?: string;
    };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function jsonError(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function ensureEnv(): { gasUrl: string; gasKey: string } | { err: NextResponse } {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY; // ✅ 統一：auth/login と同じ

  if (!gasUrl) {
    return { err: jsonError(500, { ok: false, error: "GAS_WEBAPP_URL is missing" }) };
  }
  if (!gasKey) {
    return { err: jsonError(500, { ok: false, error: "GAS_API_KEY is missing" }) };
  }

  return { gasUrl: gasUrl.trim(), gasKey: gasKey.trim() };
}

async function safeReadJson(req: Request): Promise<MeRequest> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {};
    return (await req.json()) as MeRequest;
  } catch {
    return {};
  }
}

async function callGasMe(gasUrl: string, gasKey: string, id: string, code: string): Promise<GasMeResponse> {
  const url = new URL(gasUrl);
  url.searchParams.set("key", gasKey);

  const controller = new AbortController();
  const timeoutMs = 15_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "me", id, code }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: "bad_gas_json" };
    }

    if (data && data.ok === true) {
      return {
        ok: true,
        login_id: str(data.login_id),
        email: str(data.email),
        status: str(data.status),
        my_ref_code: str(data.my_ref_code),
        ref_path: str(data.ref_path),
        referrer_login_id: str(data.referrer_login_id),
        referrer_2_login_id: str(data.referrer_2_login_id),
        referrer_3_login_id: str(data.referrer_3_login_id),
      };
    }

    const reason = str(data?.reason) as "invalid" | "pending" | "";
    const error = str(data?.error);

    const out: GasMeResponse = {
      ok: false,
      ...(reason ? { reason } : {}),
      ...(error ? { error } : {}),
    };

    return out;
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "gas_timeout" : "gas_fetch_failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const env = ensureEnv();
  if ("err" in env) return env.err;

  const body = await safeReadJson(req);
  const id = str(body.id).trim();
  const code = str(body.code).trim();

  if (!id || !code) {
    return jsonError(400, { ok: false, error: "id_and_code_required" });
  }

  const gasRes = await callGasMe(env.gasUrl, env.gasKey, id, code);

  if (gasRes.ok) {
    return NextResponse.json(
      { ok: true, me: gasRes },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ✅ ★ここだけ修正（型を明示 narrowing）
  if (!gasRes.ok) {
    const reason = (gasRes as Extract<GasMeResponse, { ok: false }>).reason;

    if (reason === "pending" || reason === "invalid") {
      return NextResponse.json(
        { ok: false, reason },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  return jsonError(502, { ok: false, error: gasRes.error || "unknown_error" });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, hint: "POST {id, code} to get my_ref_code" },
    { headers: { "Cache-Control": "no-store" } }
  );
}