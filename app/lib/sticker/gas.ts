// サーバー側から GAS を叩くための共通ヘルパー（Sticker Studio 専用）。
// 既存の各 route.ts が持っている gasPost と同じ流儀。

const GAS_URL = process.env.GAS_WEBAPP_URL ?? "";
const GAS_KEY = process.env.GAS_API_KEY ?? "";

export async function gasPost(
  action: string,
  body: Record<string, unknown>
): Promise<any> {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_KEY)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action, ...body }),
  });
  return r.json();
}

/**
 * BP を消費する。lock → 実処理 → commit の流れを1関数にまとめる。
 * work が例外を投げたら refund して例外をそのまま投げ直す。
 */
export async function withBp<T>(
  params: { id: string; amount: number; reason: string },
  work: () => Promise<T>
): Promise<T> {
  const balRes = await gasPost("get_balance", { id: params.id });
  if (!balRes?.ok) throw new BpError("balance_fetch_failed", 502);
  if (Number(balRes.bp ?? 0) < params.amount) {
    throw new BpError("insufficient_bp", 402, params.amount);
  }

  const lockRes = await gasPost("bp_lock", {
    id: params.id,
    amount: params.amount,
    reason: params.reason,
  });
  if (!lockRes?.ok) throw new BpError("bp_lock_failed", 502);
  const lockId = lockRes.lock_id as string;

  let result: T;
  try {
    result = await work();
  } catch (e) {
    await gasPost("bp_refund", { id: params.id, lock_id: lockId }).catch(() => {});
    throw e;
  }

  await gasPost("bp_commit", { id: params.id, lock_id: lockId });
  return result;
}

/**
 * R2 が未設定だと image_client は data: URI を返す。
 * それをプロジェクトJSONに入れるとシートのセル上限を即座に超えて保存が壊れるため、
 * 生成直後に弾いて BP を返金させる。
 */
export function assertStorableUrl(url: string): void {
  if (!url || url.startsWith("data:")) {
    throw new Error("image_storage_unavailable");
  }
}

export class BpError extends Error {
  status: number;
  required?: number;
  constructor(message: string, status: number, required?: number) {
    super(message);
    this.status = status;
    this.required = required;
  }
}

/**
 * 生成クレジットを増減する。GAS 側で原子的に処理され、0未満にはならない。
 * delta < 0 で残高不足のときは ok:false / error:"no_credits" が返る。
 */
export async function changeCredits(
  id: string,
  projectId: string,
  delta: number
): Promise<{ ok: boolean; credits: number; error?: string }> {
  const res = await gasPost("sticker_credits", {
    id,
    project_id: projectId,
    delta,
  });
  return {
    ok: Boolean(res?.ok),
    credits: Number(res?.credits ?? 0),
    error: res?.error ? String(res.error) : undefined,
  };
}
