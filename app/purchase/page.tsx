"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadDraft, saveDraft, type Plan } from "@/components/storage";

// 送金先（USDT）
const PAY_TO_BEP20 = "0xtesttesttesttest";
const PAY_TO_TRC20 = "T-testtesttesttest";
// ✅ プレセール表示を一括ON/OFF（あとで外すのはここをfalseにするだけ）
const ENABLE_PRESALE = true;

// ✅ 表示用：プレセール割引率（表示だけ）
const PRESALE_OFF_PCT = 25;

// ✅ 表示用：BP配布（表示だけ）
const BP_BONUS: Partial<Record<Plan, number>> = {
  "30": 300,
  "50": 600,
  "100": 1200,
  "500": 6000,
  "1000": 12000,
};

type PlanDef = {
  id: Plan;
  priceLabel: string;
  originalPriceLabel?: string; // ✅ 追加：通常価格（プレセール時だけ表示）
  title: string;
  desc: string;
  bullets: string[];
  badges?: string[]; // 複数OK
};

const PLANS: PlanDef[] = [
  {
    id: "30" as Plan,
    priceLabel: "30 USDT",
    originalPriceLabel: "40 USDT", // ✅ 追加（25%OFFの元値）
    title: "Starter",
    desc: "まず体験して全体像を掴む",
    bullets: [
      "基礎AI副業講座（動画/記事）",
      "テンプレ：月3個（コピペ型）",
      "コミュニティ：閲覧のみ",
    ],
  },
  {
    id: "50" as Plan,
    priceLabel: "50 USDT",
    originalPriceLabel: "67 USDT",
    title: "Builder",
    desc: "実践テンプレで手を動かして伸ばす",
    bullets: [
      "実践テンプレ追加（投稿/台本/プロンプト）",
      "SNS運用テンプレ（X/TikTok/YouTube短尺）",
      "コミュニティ：投稿OK（制限あり）",
    ],
  },
  {
    id: "100" as Plan,
    priceLabel: "100 USDT",
    originalPriceLabel: "134 USDT",
    title: "Automation",
    desc: "仕組み化の自動化ワークフローを使う",
    bullets: [
      "自動化ワークフロー（例：10本）",
      "AI生成環境：フル解放",
      "成果共有ルーム：参加",
    ],
    badges: ["人気"],
  },
  {
    id: "500" as Plan,
    priceLabel: "500 USDT",
    originalPriceLabel: "667 USDT",
    title: "Core",
    desc: "中核メンバー枠：運用と案件を前に進める",
    bullets: [
      "新ツール優先利用（βアクセス）",
      "共同企画：参加（作業部屋/週1MTG）",
      "VPS枠：優先（上限付き）",
    ],
    badges: ["おすすめ"],
  },
  {
    id: "1000" as Plan,
    priceLabel: "1,000 USDT",
    originalPriceLabel: "1,334 USDT",
    title: "Infra",
    desc: "影響層：インフラ整備と共同PJを牽引する",
    bullets: [
      "インフラ整備：参加権（運営側の手伝い/アイデア枠）",
      "共同プロジェクト：優先（先行参加）",
      "テンプレ無料購入チケット：上限付き",
    ],
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

/** ✅ 見た目を崩さず “最小限で伝わる” へ：カード内は短く */
function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const isBest = plan.id === ("100" as Plan); // Automation を視覚的に強く

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "relative w-full rounded-2xl border p-5 text-left transition",
        "bg-white hover:bg-slate-50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        selected
          ? "border-indigo-500 ring-2 ring-indigo-200 shadow-[0_18px_45px_rgba(99,102,241,.22)]"
          : "border-slate-200",
        isBest && !selected
          ? "border-indigo-200 shadow-[0_18px_55px_rgba(99,102,241,.18)]"
          : "",
      ].join(" ")}
      aria-pressed={selected}
    >
      {/* Automationだけ、薄いグラデ背景で“押したくなる感” */}
      {isBest ? (
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-[radial-gradient(420px_220px_at_20%_20%,rgba(99,102,241,.18),transparent_55%),radial-gradient(380px_220px_at_90%_10%,rgba(56,189,248,.16),transparent_55%)]" />
      ) : null}

      {/* 右上バッジ（複数でも縦積みで被らない） */}
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

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">{plan.title}</div>
          <div className="mt-1">
            {/* 価格 + プレセール + BP */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="text-xl font-extrabold text-slate-900">{plan.priceLabel}</div>

              {/* ✅ プレセール限定 25%OFF（表示のみ） */}
              {ENABLE_PRESALE ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-900">
                  プレセール限定価格！ {PRESALE_OFF_PCT}%OFF
                </span>
              ) : null}

              {/* ✅ BP配布（表示のみ） */}
              {BP_BONUS[plan.id] ? (
                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">
                  {BP_BONUS[plan.id]}BP付与
                </span>
              ) : null}
            </div>

            {/* ✅ プレセール時だけ「元値」をうっすら表示（表示のみ） */}
            {ENABLE_PRESALE ? (
              <div className="mt-1 text-[11px] text-slate-500">
                通常価格：{" "}
                <span className="line-through opacity-80">
                  {plan.originalPriceLabel ?? plan.priceLabel}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 選択インジケータ */}
        <div
          className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black",
            selected
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-400",
          ].join(" ")}
        >
          ✓
        </div>
      </div>

      {/* 説明（そのまま） */}
      <p className="mt-2 text-sm text-slate-600">{plan.desc}</p>

      {/* ✅ 箇条書きはカードから外す：ここでは「数だけ」 */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">
          含まれる内容：<span className="font-extrabold text-slate-900">{plan.bullets.length}</span>項目
        </span>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-bold",
            selected
              ? "bg-indigo-600 text-white"
              : isBest
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {selected ? "選択済み" : "未選択"}
        </span>
      </div>

      {/* フッター */}
      <div className="mt-3 text-xs font-semibold text-slate-500">
        {selected ? "選択中" : "クリックして選択"}
      </div>
    </button>
  );
}

/** ✅ CopyFieldを使わず、このページ内で確実に見えるコピーブロック */
function CopyAddressRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // 何もしない（環境によっては失敗するが、UIは壊さない）
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className={[
            "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-extrabold transition",
            copied
              ? "bg-emerald-600 text-white"
              : "bg-indigo-600 text-white hover:opacity-95",
          ].join(" ")}
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>

      {/* ✅ ここが「白地に白文字」にならないよう、明確なコントラスト */}
      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="font-mono text-xs text-slate-900 break-all">{value}</div>
      </div>
    </div>
  );
}

export default function PurchasePage() {
  // SSR/CSR差分を避けるため、最初は未読(null)にして mounted 後に読む
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
  }, []);

  function setPlan(p: Plan) {
    if (!draft) return;
    const next = { ...draft, plan: p };
    saveDraft(next);
    setDraft(next); // ← これが無いと「色が変わらない」
  }

  const selectedPlan = useMemo(() => {
    if (!draft) return undefined;
    return PLANS.find((p) => draft.plan === p.id);
  }, [draft]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* 背景 */}
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
        {/* 上部ナビ */}
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
            title="購入プランを選択"
            subtitle="プランを選んで送金先をコピー → 申請入力へ進みます（TxID入力は不要）"
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            {/* 左：プラン */}
            <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">
                購入プラン <span className="text-rose-600">*</span>
              </div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                金額ではなく「使える権利の範囲」が増えていくイメージです。選択するとカードが色付きになります。
              </p>

              {/* draft読込までスケルトン */}
              {!draft ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: PLANS.length }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[170px] rounded-2xl border border-slate-200 bg-slate-50 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {PLANS.map((p) => (
                    <PlanCard
                      key={String(p.id)}
                      plan={p}
                      selected={draft.plan === p.id}
                      onSelect={() => setPlan(p.id)}
                    />
                  ))}
                </div>
              )}

              {/* ✅ 選択中の内容は“カードの下”にまとめて表示（読みやすく） */}
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
                          <span className="font-extrabold text-indigo-700">
                            {BP_BONUS[selectedPlan.id]}BP付与
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-500">未選択（どれか選んでください）</span>
                  )}
                </div>

                {selectedPlan ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-extrabold text-slate-900">
                      選択中プランの内容
                    </div>
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

            {/* 右：送金先 */}
            <aside className="grid gap-5">
              <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">送金先（USDT）</div>
                <p className="mt-1 text-xs text-slate-600">
                  ネットワークの選択ミス（BEP20 / TRC20）だけ注意してください。
                </p>

                <div className="mt-3 space-y-3">
                  <CopyAddressRow label="USDT（BEP20）" value={PAY_TO_BEP20} />
                  <CopyAddressRow label="USDT（TRC20）" value={PAY_TO_TRC20} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">入金確認について</div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    入金確認は今後 <b>TRONSCAN API</b> により自動化予定です。現時点では送金後に申請入力へ進み、プラン選択内容と照合します（TxID入力は不要）。
                  </p>
                </div>
              </div>

              <Link
                href="/apply"
                className={[
                  "inline-flex w-full items-center justify-center rounded-2xl px-4 py-4 text-base font-extrabold text-white",
                  selectedPlan
                    ? "bg-slate-900 hover:opacity-95 active:scale-[0.99]"
                    : "bg-slate-300 cursor-not-allowed",
                ].join(" ")}
                aria-disabled={!selectedPlan}
                onClick={(e) => {
                  if (!selectedPlan) e.preventDefault();
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

              <div className="text-center text-xs text-slate-500">
                ※選択内容はこの端末内に一時保存されます
              </div>
            </aside>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">© LIFAI</div>
      </div>
    </main>
  );
}
