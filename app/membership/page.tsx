"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, type AuthState } from "../lib/auth";

// =========================================================
// 定数
// =========================================================

type SubscriptionPlan = {
  id: string;
  label: string;
  price: number;
  bp_cap: number;
  desc: string;
  popular?: boolean;
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "free",     label: "Free",     price: 0,   bp_cap: 0,     desc: "まずは基本利用から" },
  { id: "plus",     label: "Plus",     price: 9,   bp_cap: 1000,  desc: "毎月BPを補充しながら継続利用" },
  { id: "pro",      label: "Pro",      price: 29,  bp_cap: 3000,  desc: "BP補充＋案件優先・収益機会も強化", popular: true },
  { id: "priority", label: "Priority", price: 99,  bp_cap: 10000, desc: "案件獲得・優先利用を重視する実践向け" },
  { id: "partner",  label: "Partner",  price: 299, bp_cap: 30000, desc: "提携・高頻度利用を前提とした上位プラン" },
];

const CREDIT_ITEMS = [
  { title: "BP追加パック",     desc: "BPを必要な時に追加" },
  { title: "優先チケット",     desc: "審査・案件を優先列で処理" },
  { title: "音楽案件ブースト", desc: "提携BGM案件への露出を強化" },
  { title: "生成クレジット",   desc: "AI生成の追加利用枠" },
];

// =========================================================
// BalanceBadge
// ※ top/page.tsx で export されていないため、同等の実装をローカルに定義
// =========================================================

function BalanceBadge({ auth }: { auth: AuthState }) {
  const [bp, setBp] = useState<number>(0);
  const [ep, setEp] = useState<number>(0);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const id =
      (auth as Record<string, unknown>)?.id as string ||
      (auth as Record<string, unknown>)?.loginId as string ||
      "";
    if (!id) { setErr("no_login_id"); return; }

    (async () => {
      try {
        const r = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id }),
        });
        const data = await r.json().catch(() => ({ ok: false, error: "not_json" })) as Record<string, unknown>;
        if (!data.ok) { setErr((data.error as string) || "failed"); return; }
        setBp(Number(data.bp || 0));
        setEp(Number(data.ep || 0));
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [auth]);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300">
      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-black">
        WALLET
      </span>
      <span>BP</span>
      <span className="font-extrabold text-white">{bp}</span>
      <span className="opacity-40">/</span>
      <span>EP</span>
      <span className="font-extrabold text-white">{ep}</span>
      {err ? <span className="ml-2 text-[10px] opacity-50">({err})</span> : null}
    </div>
  );
}

// =========================================================
// セクション1: 現在のプラン状態
// =========================================================

function CurrentPlanCard({ auth }: { auth: AuthState }) {
  const planLabel = auth.plan || "―";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">入会ランク</p>
          <p className="mt-1 text-sm font-extrabold text-white">{planLabel}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">月額プラン</p>
          <p className="mt-1 text-sm font-extrabold text-white">Free（未契約）</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">次回更新日</p>
          <p className="mt-1 text-sm font-extrabold text-white">―</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">ステータス</p>
          <span className="mt-1 inline-block rounded-full bg-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300">
            現在のプラン
          </span>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// セクション2: 月額メンバーシップ
// =========================================================

function SubscriptionSection() {
  return (
    <section>
      <h2 className="text-base font-extrabold text-white">② 月額メンバーシップ</h2>
      <p className="mt-1 text-xs text-zinc-500">Stripe決済で近日対応予定</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={[
              "relative rounded-2xl border p-5 transition",
              plan.popular
                ? "border-amber-600 bg-zinc-900"
                : "border-zinc-800 bg-zinc-900",
            ].join(" ")}
          >
            {plan.popular && (
              <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-black">
                人気
              </span>
            )}

            <div className="text-sm font-extrabold text-white">{plan.label}</div>

            <div className="mt-1 text-xl font-extrabold text-white">
              {plan.price === 0 ? "無料" : `$${plan.price}/月`}
            </div>

            <div className="mt-1 text-xs text-zinc-400">
              {plan.bp_cap === 0
                ? "補充なし"
                : `毎月 ${plan.bp_cap.toLocaleString()} BP 補充`}
            </div>

            <p className="mt-3 text-xs text-zinc-500">{plan.desc}</p>

            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-bold text-zinc-500"
            >
              🔒 準備中
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// =========================================================
// セクション3: 追加クレジット
// =========================================================

function AdditionalCreditsSection() {
  return (
    <section>
      <h2 className="text-base font-extrabold text-white">③ 追加クレジット購入</h2>
      <p className="mt-1 text-xs text-zinc-500">必要な分だけ追加できます・近日対応予定</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CREDIT_ITEMS.map((item) => (
          <div key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-sm font-extrabold text-white">{item.title}</div>
            <p className="mt-1 text-xs text-zinc-500">{item.desc}</p>
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-bold text-zinc-500"
            >
              🔒 準備中
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// =========================================================
// メインページ
// =========================================================

export default function MembershipPage() {
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    const a = getAuth();
    if (!a) {
      router.replace("/login");
      return;
    }
    if (a.status !== "approved") {
      router.replace("/login");
      return;
    }
    setAuthState(a);
  }, [router]);

  // ✅ 認証判定が終わるまで描画しない（top/page.tsx と同じパターン）
  if (auth === null) return null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[920px] px-4 py-10">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 shadow-[0_26px_70px_rgba(0,0,0,.4)]">

          {/* ヘッダー */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => router.push("/top")}
                className="text-xs text-zinc-400 transition hover:text-white"
              >
                ← ダッシュボードに戻る
              </button>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                MEMBERSHIP
              </div>

              <h1 className="mt-3 text-xl font-extrabold tracking-tight text-white">
                メンバーシップ
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                サブスクリプションとクレジットを管理します。
              </p>
            </div>

            <BalanceBadge auth={auth} />
          </div>

          {/* セクション1: 現在のプラン */}
          <div className="mt-6">
            <CurrentPlanCard auth={auth} />
          </div>

          {/* セクション2: 月額メンバーシップ */}
          <div className="mt-8">
            <SubscriptionSection />
          </div>

          {/* セクション3: 追加クレジット */}
          <div className="mt-8">
            <AdditionalCreditsSection />
          </div>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-600">
            決済機能は現在準備中です。近日中に対応予定です。
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-zinc-700">© LIFAI</div>
      </div>
    </main>
  );
}
