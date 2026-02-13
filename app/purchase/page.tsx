"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { loadDraft, saveDraft, type Plan } from "@/components/storage";

// ✅ プレセール表示を一括ON/OFF
const ENABLE_PRESALE = true;

// ✅ 通常プレリリース割引率（表示だけ）
const PRESALE_OFF_PCT = 15;

// ✅ BP配布（表示だけ）
const BP_BONUS: Partial<Record<Plan, number>> = {
  "30": 300,
  "50": 600,
  "100": 1200,
  "500": 6000,
  "1000": 12000,
};

type PlanDef = {
  id: Plan;
  priceLabel: string;          // 支払う金額（割引後）
  title: string;
  desc: string;
  bullets: string[];
  badges?: string[];
};

const PLANS: PlanDef[] = [
  {
    id: "30" as Plan,
    priceLabel: "30 USDT",
    title: "Starter",
    desc: "まず体験して全体像を掴む",
    bullets: ["基礎AI副業講座（動画/記事）", "テンプレ：月3個（コピペ型）", "コミュニティ：閲覧のみ"],
  },
  {
    id: "50" as Plan,
    priceLabel: "50 USDT",
    title: "Builder",
    desc: "実践テンプレで手を動かして伸ばす",
    bullets: ["実践テンプレ追加（投稿/台本/プロンプト）", "SNS運用テンプレ（X/TikTok/YouTube短尺）", "コミュニティ：投稿OK（制限あり）"],
  },
  {
    id: "100" as Plan,
    priceLabel: "100 USDT",
    title: "Automation",
    desc: "仕組み化の自動化ワークフローを使う",
    bullets: ["自動化ワークフロー（例：10本）", "AI生成環境：フル解放", "成果共有ルーム：参加"],
    badges: ["人気"],
  },
  {
    id: "500" as Plan,
    priceLabel: "500 USDT",
    title: "Core",
    desc: "中核メンバー枠：運用と案件を前に進める",
    bullets: ["新ツール優先利用（βアクセス）", "共同企画：参加（作業部屋/週1MTG）", "VPS枠：優先（上限付き）"],
    badges: ["おすすめ"],
  },
  {
    id: "1000" as Plan,
    priceLabel: "1,000 USDT",
    title: "Infra",
    desc: "影響層：インフラ整備と共同PJを牽引する",
    bullets: ["インフラ整備：参加権（運営側の手伝い/アイデア枠）", "共同プロジェクト：優先（先行参加）", "テンプレ無料購入チケット：上限付き"],
  },
];

function StepHeaderLite({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          Plan Select
        </div>
        <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>

      <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-slate-900 text-white font-black">L</span>
        <div className="leading-tight">
          <div className="font-semibold text-slate-900">LIFAI</div>
          <div className="text-[11px] text-slate-500">AI副業コミュニティ</div>
        </div>
      </div>
    </div>
  );
}

function parseAmountFromLabel(label: string): number {
  // "1,000 USDT" / "56.95 USDT" など対応
  const n = Number(String(label).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatUsdtn(n: number): string {
  // 表示は整数に寄せる（小数が嫌ならこれが安全）
  const v = Math.round(n);
  return v >= 1000 ? `${v.toLocaleString("en-US")} USDT` : `${v} USDT`;
}

function calcOriginalLabel(discounted: number): string {
  // 15%OFF表示を「矛盾なく」するために、割引後から逆算して通常価格を表示
  const original = discounted / (1 - PRESALE_OFF_PCT / 100);
  return formatUsdtn(original);
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const isBest = plan.id === ("100" as Plan);

  const discountedAmount = parseAmountFromLabel(plan.priceLabel);
  const originalLabel = ENABLE_PRESALE && discountedAmount > 0 ? calcOriginalLabel(discountedAmount) : plan.priceLabel;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "relative w-full rounded-2xl border p-5 text-left transition",
        "bg-white hover:bg-slate-50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        selected ? "border-indigo-500 ring-2 ring-indigo-200 shadow-[0_18px_45px_rgba(99,102,241,.22)]" : "border-slate-200",
        isBest && !selected ? "border-indigo-200 shadow-[0_18px_55px_rgba(99,102,241,.18)]" : "",
      ].join(" ")}
      aria-pressed={selected}
    >
      {isBest ? (
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-[radial-gradient(420px_220px_at_20%_20%,rgba(99,102,241,.18),transparent_55%),radial-gradient(380px_220px_at_90%_10%,rgba(56,189,248,.16),transparent_55%)]" />
      ) : null}

      {plan.badges?.length ? (
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          {plan.badges.map((b) => (
            <span
              key={b}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm",
                plan.id === ("100" as Plan) ? "bg-indigo-600" : "bg-slate-900",
              ].join(" ")}
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">{plan.title}</div>
          <div className="mt-1">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="text-xl font-extrabold text-slate-900">{plan.priceLabel}</div>

              {ENABLE_PRESALE ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-900">
                  プレリリース中！ {PRESALE_OFF_PCT}%OFF
                </span>
              ) : null}

              {BP_BONUS[plan.id] ? (
                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">
                  {BP_BONUS[plan.id]}BP付与
                </span>
              ) : null}
            </div>

            {ENABLE_PRESALE ? (
              <div className="mt-1 text-[11px] text-slate-500">
                通常価格： <span className="line-through opacity-80">{originalLabel}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black",
            selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-400",
          ].join(" ")}
        >
          ✓
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-600">{plan.desc}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">
          含まれる内容：<span className="font-extrabold text-slate-900">{plan.bullets.length}</span>項目
        </span>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-bold",
            selected ? "bg-indigo-600 text-white" : isBest ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {selected ? "選択済み" : "未選択"}
        </span>
      </div>

      <div className="mt-3 text-xs font-semibold text-slate-500">{selected ? "選択中" : "クリックして選択"}</div>
    </button>
  );
}

export default function PurchasePage() {
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);
  const [paidChecked, setPaidChecked] = useState(false);

  // ✅ 決済作成中の二重クリック防止
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    const d = loadDraft();

    // ✅ 決済戻りURLから復帰（/apply?applyId=...&plan=... を想定）
    const sp = new URLSearchParams(window.location.search);
    const applyIdFromUrl = sp.get("applyId") || undefined;
    const planFromUrl = (sp.get("plan") as Plan | null) || undefined;

    const next = {
      ...d,
      ...(applyIdFromUrl ? { applyId: applyIdFromUrl } : null),
      ...(planFromUrl ? { plan: planFromUrl } : null),
    };

    saveDraft(next);
    setDraft(next);
  }, []);

  function setPlan(p: Plan) {
    if (!draft) return;
    const next = { ...draft, plan: p };
    saveDraft(next);
    setDraft(next);
    setPaidChecked(false);
  }

  function ensureApplyId(): string | null {
    if (!draft) return null;
    if (draft.applyId) return draft.applyId;

    // ✅ 通常版 prefix（コラボと衝突しない）
    const applyId = `lifai_${Date.now()}`;

    const next = { ...draft, applyId };
    saveDraft(next);
    setDraft(next);
    return applyId;
  }

  const selectedPlan = useMemo(() => {
    if (!draft) return undefined;
    return PLANS.find((p) => draft.plan === p.id);
  }, [draft]);

  // ✅ 通常版：src は付けない（コラボと区別したいなら別途付ける）
  const nextHref =
    draft?.applyId && selectedPlan
      ? `/apply?applyId=${encodeURIComponent(draft.applyId)}&plan=${encodeURIComponent(selectedPlan.id)}`
      : "/apply";

  const canGoNext = !!selectedPlan && !!draft?.applyId && paidChecked;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_500px_at_15%_-10%,rgba(99,102,241,.18),transparent_60%),radial-gradient(800px_520px_at_110%_5%,rgba(56,189,248,.18),transparent_55%),linear-gradient(180deg,#ffffff,#f7f8fc_45%,#ffffff)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="mx-auto max-w-[980px] px-4 py-10">
        {/* ✅ 通常版：ヒーロー（コラボバナーではない） */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative">
            <Image
              src="/hero.png"
              alt="LIFAI プレリリース"
              width={1400}
              height={700}
              className="w-full h-auto"
              priority
            />
            <div className="absolute bottom-4 left-4 rounded-2xl bg-white/85 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm">
              プレリリース {PRESALE_OFF_PCT}%OFF 実施中
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900 underline decoration-slate-200 hover:decoration-slate-400"
          >
            ← トップへ戻る
          </Link>

          <Link
            href="/login"
            className="text-sm text-slate-600 hover:text-slate-900 underline decoration-slate-200 hover:decoration-slate-400"
          >
            ログインへ
          </Link>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(2,6,23,.10)]">
          <StepHeaderLite
            title="購入（通常）"
            subtitle="①プラン選択 → ②支払い → ③「支払い完了」チェック → ④次へ（申請入力）"
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            {/* 左：プラン */}
            <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">
                購入プラン <span className="text-rose-600">*</span>
              </div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                プレリリース価格で購入できます。選択するとカードが色付きになります。
              </p>

              {!draft ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: PLANS.length }).map((_, i) => (
                    <div key={i} className="h-[170px] rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {PLANS.map((p) => (
                    <PlanCard key={String(p.id)} plan={p} selected={draft.plan === p.id} onSelect={() => setPlan(p.id)} />
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div className="font-bold text-slate-900">選択中：</div>
                <div className="mt-1">
                  {selectedPlan ? (
                    <>
                      <span className="font-extrabold">{selectedPlan.title}</span>
                      <span className="mx-2 text-slate-400">/</span>
                      <span className="font-bold">{selectedPlan.priceLabel}</span>
                      {BP_BONUS[selectedPlan.id] ? (
                        <>
                          <span className="mx-2 text-slate-300">/</span>
                          <span className="font-extrabold text-indigo-700">{BP_BONUS[selectedPlan.id]}BP付与</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-500">未選択（どれか選んでください）</span>
                  )}
                </div>

                {draft?.applyId ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    申請ID：<span className="font-mono text-slate-700">{draft.applyId}</span>
                  </div>
                ) : null}

                {selectedPlan ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-extrabold text-slate-900">選択中プランの内容</div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {selectedPlan.bullets.map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                          <span className="leading-6">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>

            {/* 右：支払い方法 */}
            <aside className="grid gap-5">
              <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">支払い方法</div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  まずは下の方法でお支払いください。支払い完了後、このページに戻って「支払い完了」チェックを入れて次へ進んでください。
                </p>

                <div className="mt-4 grid gap-3">
                  {/* ✅ NOWPayments */}
                  <button
                    type="button"
                    disabled={!selectedPlan || payBusy}
                    className={[
                      "w-full rounded-2xl border px-4 py-4 text-left transition",
                      selectedPlan && !payBusy
                        ? "border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                        : "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed",
                    ].join(" ")}
                    onClick={async () => {
                      if (!selectedPlan) return;
                      if (payBusy) return;

                      setPayBusy(true);
                      try {
                        const applyId = ensureApplyId();
                        if (!applyId) return;

                        // ① 先にGASへ仮登録（分裂防止）
                        const createRes = await fetch("/api/apply/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            plan: selectedPlan.id,
                            applyId,
                            // ✅ 通常版は固定しない（ユーザーがフォームで入れるなら後で上書きされる）
                            refName: draft?.refName || "",
                            refId: draft?.refId || "",
                          }),
                        });

                        const createData = await createRes.json();
                        if (!createData.ok) {
                          alert(createData.error || "申請ID作成に失敗しました");
                          return;
                        }

                        // ② 金額抽出（priceLabelから）
                        const amount = parseAmountFromLabel(selectedPlan.priceLabel);
                        if (!amount || amount <= 0) {
                          alert("金額の取得に失敗しました");
                          return;
                        }

                        // ③ 決済作成（/api/nowpayments/create）
                        const res = await fetch("/api/nowpayments/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            amount,
                            plan: selectedPlan.id,
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
                    }}
                  >
                    <div className="text-sm font-extrabold text-slate-900">
                      {payBusy ? "決済ページを準備中…" : "暗号通貨（NOWPayments）"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">USDTなどで支払い（ウォレットがある方向け）</div>
                  </button>

                  {/* ✅ 仮想通貨を持ってない人向け：導線（必要なら差し替え） */}
                  <a
                    href="https://promote.mexc.com/r/m54hsj74"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:opacity-95 transition"
                  >
                    <Image
                      src="/mexc.png"
                      alt="仮想通貨をこれから買う方はこちら（MEXC）"
                      width={1280}
                      height={1600}
                      className="h-auto w-full"
                      priority={false}
                    />
                  </a>

                  <div className="px-1 text-[11px] text-slate-500">
                    ※暗号通貨をお持ちでない方は、上のバナーから購入できます（外部サイト）
                  </div>

                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 opacity-80">
                    <div className="text-sm font-extrabold text-slate-900">クレカ / 銀行振込（準備中）</div>
                    <div className="mt-1 text-xs text-slate-600">
                      近日対応予定です。暗号通貨がない場合は、こちらが追加されるまでお待ちください。
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">支払い完了後</div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    支払いが完了したら、このページに戻って下のチェックをONにしてください（ONにしないと次へ進めません）。
                  </p>

                  <label className="mt-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={paidChecked}
                      onChange={(e) => setPaidChecked(e.target.checked)}
                      disabled={!selectedPlan}
                    />
                    <div className="text-sm">
                      <div className="font-extrabold text-slate-900">支払い完了しました</div>
                      <div className="text-xs text-slate-600">※支払いが未完了のまま進むと、承認が遅れます</div>
                    </div>
                  </label>
                </div>
              </div>

              <Link
                href={nextHref}
                className={[
                  "inline-flex w-full items-center justify-center rounded-2xl px-4 py-4 text-base font-extrabold text-white",
                  canGoNext ? "bg-slate-900 hover:opacity-95 active:scale-[0.99]" : "bg-slate-300 cursor-not-allowed",
                ].join(" ")}
                aria-disabled={!canGoNext}
                onClick={(e) => {
                  if (!canGoNext) e.preventDefault();
                }}
              >
                次へ（申請入力） →
              </Link>

              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                すでにIDをお持ちの方：ログイン
              </Link>

              <div className="text-center text-xs text-slate-500">※選択内容はこの端末内に一時保存されます</div>
            </aside>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">© LIFAI</div>
      </div>
    </main>
  );
}