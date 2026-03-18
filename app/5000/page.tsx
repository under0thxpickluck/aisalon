"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDraft, saveDraft } from "@/components/storage";

/* ===== 定数 ===== */
const AMOUNT_2000 = 2000;
const AMOUNT_5000 = 5000;

type PlanId = "1000" | "2000" | "5000";

export default function DaoMemberPage() {
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);
  const [plan, setPlan] = useState<PlanId>("5000");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
  }, []);

  function ensureApplyId(planId: string): string | null {
    if (!draft) return null;

    const key = planId === "5000" ? "applyId_5000" : "applyId_2000";
    if ((draft as any)[key]) return (draft as any)[key];

    const applyId = `lifai_${planId}_${Date.now()}`;
    const next = { ...(draft as any), [key]: applyId, plan: planId as any };
    saveDraft(next);
    setDraft(next);
    return applyId;
  }

  async function handlePay(planId: "2000" | "5000") {
    const is2000 = planId === "2000";

    if (payBusy) return;
    setPayBusy(true);

    try {
      const applyId = ensureApplyId(planId);
      if (!applyId) return;

      // ① 申請ID作成（既存フロー踏襲）
      const createRes = await fetch("/api/apply/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId as any,
          applyId,
          refName: (draft as any)?.refName || "",
          refId: (draft as any)?.refId || "",
        }),
      });

      const createData = await createRes.json();
      if (!createData.ok) {
        alert(createData.error || "申請作成に失敗しました");
        return;
      }

      // ② 決済作成（NOWPayments）
      const res = await fetch("/api/nowpayments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: is2000 ? AMOUNT_2000 : AMOUNT_5000,
          plan: planId as any,
          applyId,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "決済作成に失敗しました");
        return;
      }

      window.location.href = data.invoice_url;
    } catch {
      alert("エラーが発生しました");
    } finally {
      setPayBusy(false);
    }
  }

  function handleCta() {
    if (plan === "1000") {
      alert("1,000プランは個別にお問い合わせください。");
      return;
    }
    handlePay(plan as "2000" | "5000");
  }

  const ctaLabel = payBusy
    ? "処理中…"
    : plan === "1000"
    ? "お問い合わせ（$1,000）"
    : plan === "2000"
    ? "参加する（$2,000）"
    : "参加する（$5,000）";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* 背景グロー */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[#6366f1]/10 blur-[140px]" />
        <div className="absolute bottom-[-150px] right-[-100px] h-[400px] w-[400px] rounded-full bg-[#6366f1]/6 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-16">

        {/* ===== Hero ===== */}
        <section className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1]" />
            LIMITED PARTNER
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
            LIFAI 限定パートナー受付
          </h1>
          <p className="text-base text-white/50 mb-3">
            1,000 / 2,000 / 5,000 USD｜現在この3枠のみ受付中
          </p>
          <p className="text-xs text-white/25 leading-6">
            コンテンツ利用無制限　/　参加には月額契約が必要　/　上限到達で終了
          </p>
        </section>

        {/* ===== プランカード3枚 ===== */}
        {/* 表示順: 1000 | 5000（中央・強調） | 2000 */}
        <section className="mb-14">
          <div className="grid grid-cols-3 gap-3 items-end">

            {/* 1000 */}
            <button
              type="button"
              onClick={() => setPlan("1000")}
              className={[
                "rounded-2xl border p-5 text-left transition-all",
                plan === "1000"
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-white/4 hover:bg-white/7",
              ].join(" ")}
            >
              <div className="text-[11px] text-white/35 mb-1 font-semibold tracking-widest">STARTER</div>
              <div className="text-2xl font-black mb-4">$1,000</div>
              <ul className="space-y-2 text-xs text-white/50">
                <li>✓ コンテンツ利用無制限</li>
                <li>✓ 月額サポート契約</li>
                <li className="text-white/25">還元なし</li>
              </ul>
            </button>

            {/* 5000 — 中央・強調 */}
            <button
              type="button"
              onClick={() => setPlan("5000")}
              className={[
                "relative rounded-2xl border p-6 text-left transition-all",
                "border-[#6366f1]/50 bg-[#6366f1]/8",
                plan === "5000"
                  ? "ring-2 ring-[#6366f1]/60 shadow-[0_0_50px_rgba(99,102,241,0.35)]"
                  : "hover:ring-1 hover:ring-[#6366f1]/30 hover:shadow-[0_0_25px_rgba(99,102,241,0.15)]",
              ].join(" ")}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#6366f1] px-3 py-0.5 text-[11px] font-bold text-white shadow-lg whitespace-nowrap">
                おすすめ
              </div>
              <div className="text-[11px] text-[#a5b4fc]/70 mb-1 font-semibold tracking-widest">FELLOW</div>
              <div className="text-3xl font-black mb-4">$5,000</div>
              <ul className="space-y-2 text-xs text-white/60">
                <li>✓ コンテンツ利用無制限</li>
                <li>✓ 月額サポート契約</li>
                <li>✓ 還元あり <span className="text-[#a5b4fc] font-bold">（3口）</span></li>
                <li>✓ 音楽生成ブースト付き</li>
              </ul>
            </button>

            {/* 2000 */}
            <button
              type="button"
              onClick={() => setPlan("2000")}
              className={[
                "rounded-2xl border p-5 text-left transition-all",
                plan === "2000"
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-white/4 hover:bg-white/7",
              ].join(" ")}
            >
              <div className="text-[11px] text-white/35 mb-1 font-semibold tracking-widest">MEMBER</div>
              <div className="text-2xl font-black mb-4">$2,000</div>
              <ul className="space-y-2 text-xs text-white/50">
                <li>✓ コンテンツ利用無制限</li>
                <li>✓ 月額サポート契約</li>
                <li>✓ 還元あり <span className="text-white/70 font-bold">（2口）</span></li>
              </ul>
            </button>

          </div>
        </section>

        {/* ===== 分配セクション ===== */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <h2 className="text-sm font-extrabold mb-3 text-white/90">パートナー還元</h2>
          <ul className="space-y-2 text-sm text-white/55">
            <li>・売上の一部（5%）を対象者へ分配</li>
            <li>・2,000 ＝ 2口　/　5,000 ＝ 3口</li>
            <li>・人数と売上で毎月変動</li>
          </ul>
        </section>

        {/* ===== 月額セクション ===== */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <h2 className="text-sm font-extrabold mb-1 text-white/90">月額サポート契約</h2>
          <div className="text-2xl font-black text-[#a5b4fc] mb-4">
            ¥9,800{" "}
            <span className="text-sm font-normal text-white/30">/ 月</span>
          </div>
          <ul className="grid sm:grid-cols-2 gap-1.5 text-xs text-white/55">
            <li>✓ オンライン講習（月1回）</li>
            <li>✓ オフライン講習（隔月）</li>
            <li>✓ サポート窓口</li>
            <li>✓ インフラ運用</li>
          </ul>
        </section>

        {/* ===== アコーディオン ===== */}
        <section className="mb-12">
          <button
            type="button"
            onClick={() => setAccordionOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-sm font-semibold text-white/50 hover:bg-white/7 transition"
          >
            <span>▼ 詳細・利用条件</span>
            <span
              className="text-white/30 transition-transform duration-200"
              style={{ transform: accordionOpen ? "rotate(180deg)" : "none" }}
            >
              ∧
            </span>
          </button>
          {accordionOpen && (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/4 px-5 py-5 space-y-4 text-sm text-white/50">
              <div>
                <div className="font-extrabold text-white/75 mb-1">■ 参加条件</div>
                <p>月額契約が必須です。未払いの場合、特典・還元を含む全サービスが停止します。</p>
              </div>
              <div>
                <div className="font-extrabold text-white/75 mb-1">■ 還元ルール</div>
                <p>対象は 2,000 / 5,000 プランのみ。毎月の売上に基づき計算・分配。在籍中のみ有効。収益保証はありません。</p>
              </div>
              <div>
                <div className="font-extrabold text-white/75 mb-1">■ 5,000 特典</div>
                <p>音楽生成機能の強化・優先処理・拡張機能が利用可能です。</p>
              </div>
              <div>
                <div className="font-extrabold text-white/75 mb-1">■ 注意事項</div>
                <p>本サービスへの参加は投資ではありません。利回り・配当・価格上昇益の保証はなく、株式・持分・経営権を付与するものではありません。</p>
              </div>
            </div>
          )}
        </section>

        {/* ===== CTA ===== */}
        <section className="text-center">
          <button
            type="button"
            disabled={payBusy}
            onClick={handleCta}
            className={[
              "inline-flex items-center justify-center rounded-2xl px-10 py-4 text-base font-extrabold transition",
              plan === "5000"
                ? "bg-[#6366f1] text-white hover:bg-[#4f46e5] shadow-[0_0_35px_rgba(99,102,241,0.45)]"
                : "bg-white text-[#0a0a0a] hover:bg-white/90",
              payBusy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {ctaLabel}
          </button>
          <p className="mt-3 text-xs text-white/25">先着・審査あり</p>
          <div className="mt-10">
            <Link
              href="/"
              className="text-xs text-white/25 hover:text-white/50 underline decoration-white/20"
            >
              ← トップへ戻る
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
