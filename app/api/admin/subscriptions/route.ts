// app/api/admin/subscriptions/route.ts
//
// 財務管理「サブスク」タブ用。Music Boost の契約一覧を、ユーザー名・メールを
// 結合したうえで返す。/api/admin/* 配下なので middleware.ts の Basic 認証がかかる。
//
// GAS を2アクション叩く:
//   - music_boost_admin_list : music_boost シートの全契約行
//   - admin_list             : applies シートの全ユーザー（login_id → name/email 用）
import { NextResponse } from "next/server";
import { findMusicBoostPlan } from "@/app/lib/music-boost-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GasBoost = {
  id: string;
  user_id: string;
  plan_id: string;
  percent: number;
  price_usd: number;
  slots_used: number;
  status: string;
  started_at: string;
  expires_at: string;
  canceled_at?: string;
};

export type SubscriptionItem = {
  id: string;
  login_id: string;
  name: string;
  email: string;
  plan_id: string;
  plan_label: string;
  percent: number;
  /** 現在のプラン表から引いた月額（円）。シートの price_usd は旧ドル建てが混在するため使わない */
  price_jpy: number;
  slots_used: number;
  status: string;
  started_at: string;
  expires_at: string;
  canceled_at: string;
  /** 期限までの残日数。期限切れならマイナス。判定不能なら null */
  days_left: number | null;
};

function daysLeft(expiresAt: string): number | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

export async function GET() {
  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;

  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json(
      { ok: false, error: "env_missing", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
      { status: 500 }
    );
  }

  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  const callGas = async (body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      cache:   "no-store",
      body:    JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`gas_not_json: ${text.slice(0, 200)}`);
    }
  };

  try {
    const [boostJson, usersJson] = await Promise.all([
      callGas({ action: "music_boost_admin_list", key: gasKey, adminKey: gasAdminKey }),
      callGas({ action: "admin_list", adminKey: gasAdminKey }),
    ]);

    if (!boostJson?.ok) {
      return NextResponse.json(
        { ok: false, error: "boost_list_failed", detail: boostJson?.error ?? null },
        { status: 502 }
      );
    }

    // ユーザー名簿を login_id で引けるようにする。
    // admin_list が失敗しても一覧そのものは出せるので、名前は空のまま続行する。
    const nameMap = new Map<string, { name: string; email: string }>();
    if (usersJson?.ok && Array.isArray(usersJson.items)) {
      for (const u of usersJson.items) {
        const id = String(u?.login_id ?? "").trim();
        if (!id) continue;
        nameMap.set(id, {
          name:  String(u?.name  ?? "").trim(),
          email: String(u?.email ?? "").trim(),
        });
      }
    }

    const boosts: GasBoost[] = Array.isArray(boostJson.boosts) ? boostJson.boosts : [];

    const items: SubscriptionItem[] = boosts.map(b => {
      const loginId = String(b.user_id ?? "");
      const user    = nameMap.get(loginId);
      const plan    = findMusicBoostPlan(String(b.plan_id ?? ""));
      return {
        id:          String(b.id ?? ""),
        login_id:    loginId,
        name:        user?.name  ?? "",
        email:       user?.email ?? "",
        plan_id:     String(b.plan_id ?? ""),
        plan_label:  plan?.label ?? String(b.plan_id ?? ""),
        percent:     Number(b.percent ?? plan?.percent ?? 0),
        price_jpy:   plan?.price ?? 0,
        slots_used:  Number(b.slots_used ?? 0),
        status:      String(b.status ?? ""),
        started_at:  String(b.started_at ?? ""),
        expires_at:  String(b.expires_at ?? ""),
        canceled_at: String(b.canceled_at ?? ""),
        days_left:   daysLeft(String(b.expires_at ?? "")),
      };
    });

    // 契約中を上に、そのなかは開始日の新しい順
    items.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });

    const active = items.filter(i => i.status === "active");

    return NextResponse.json({
      ok:    true,
      items,
      summary: {
        active_count:    active.length,
        mrr_jpy:         active.reduce((sum, i) => sum + i.price_jpy, 0),
        used_slots:      Number(boostJson.used_slots      ?? 0),
        total_slots:     Number(boostJson.total_slots     ?? 0),
        available_slots: Number(boostJson.available_slots ?? 0),
        // 名簿の結合に失敗した場合、画面側で「名前が出ない理由」を示せるようにする
        names_joined:    nameMap.size > 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
