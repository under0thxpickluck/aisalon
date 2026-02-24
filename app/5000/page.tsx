"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadDraft, saveDraft } from "@/components/storage";

/* ===== 固定設定（2000$ / 5000$） ===== */
const PLAN_ID_2000 = "2000" as any; // Plan型に "2000" を追加したら as any 消せる
const AMOUNT_2000 = 2000; // USDT想定
const SEAT_LIMIT_2000 = 50;

const PLAN_ID_5000 = "5000" as any; // Plan型に "5000" を追加したら as any 消せる
const AMOUNT_5000 = 5000; // USDT想定
const SEAT_LIMIT_5000 = 20;

// 分配仕様（表示用 / 5000のみ）
const POOL_MAX_PCT = 10; // ワークフロー追加課金（経費控除後）の最大分配総量
const STEP_PEOPLE = 5; // Core以上紹介 5人ごと
const STEP_PCT = 1; // +1%
const PERSONAL_MAX_PCT = 5; // 個人上限

export default function DaoMemberPage() {
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);

  // 決済中フラグ（ティア別）
  const [payBusy2000, setPayBusy2000] = useState(false);
  const [payBusy5000, setPayBusy5000] = useState(false);

  // UI表示用：紹介人数入力（任意 / 5000のみ）
  const [refCoreCount, setRefCoreCount] = useState<number>(0);

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
    const busy = is2000 ? payBusy2000 : payBusy5000;
    const setBusy = is2000 ? setPayBusy2000 : setPayBusy5000;

    if (busy) return;
    setBusy(true);

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
      setBusy(false);
    }
  }

  // 紹介人数 → 個人%（表示用 / 5000のみ）
  const personalPct = useMemo(() => {
    const n = Math.max(0, refCoreCount);

    // 4人までは0%
    if (n <= 4) return 0;

    // 5人で1%、以降1人ごとに+0.2%（6人で1.2%）
    const pct = 1 + (n - 5) * 0.2;

    // 小数誤差対策（1.2000000002 など）
    const rounded = Math.round(pct * 10) / 10;

    return Math.min(PERSONAL_MAX_PCT, rounded);
  }, [refCoreCount]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* subtle glow background */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-neutral-700 blur-[130px]" />
        <div className="absolute -top-10 right-[-120px] h-[420px] w-[420px] rounded-full bg-neutral-800 blur-[130px]" />
        <div className="absolute bottom-[-260px] left-[-160px] h-[520px] w-[520px] rounded-full bg-neutral-800 blur-[140px]" />
        <div className="absolute bottom-[-220px] right-[-120px] h-[520px] w-[520px] rounded-full bg-neutral-800 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        {/* Top bar */}
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            href="/start"
            className="rounded-full border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
          >
            ← 戻る
          </Link>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-200">
              PRESALE / LIMITED
            </span>
            <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-200">
              DAO ACCESS
            </span>
          </div>
        </div>

        {/* HERO */}
        <section className="grid gap-10 lg:grid-cols-2">
          {/* Left */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-xs text-neutral-200">
              <span className="h-2 w-2 rounded-full bg-neutral-200" />
              LIFAI / DAO Membership
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              DAOメンバー制度
              <br />
              <span className="text-neutral-200">
                「閲覧」では終わらない、意思決定のレイヤーへ
              </span>
            </h1>

            <p className="max-w-xl text-base leading-7 text-neutral-300">
              LIFAIのDAOメンバーは、<strong className="text-neutral-100">透明性</strong>と
              <strong className="text-neutral-100">参加性</strong>を両立した上位枠です。
              <br />
              役割は「投票・合意形成への参加」と「先行案件へのアクセス」。
              <br />
              <span className="text-neutral-200">
                ※出資・株式・経営権・利益配当・価格上昇益を約束する権利ではありません。
              </span>
            </p>

            {/* Status chips */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-200">
                On-chain / Off-chain 分離運用（権利はサービス内）
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-200">
                投票・議事ログ・方針の透明性
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-200">
                先行案件アクセス
              </span>
            </div>

            {/* Quick tier cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6">
                <div className="text-sm text-neutral-400">DAOフェロー（最上位）</div>
                <div className="mt-1 text-2xl font-semibold">5,000 USDT</div>
                <div className="mt-2 text-sm text-neutral-400">
                  発言＋投票 / P/L開示 / 分配プール参加（仕様内）
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6">
                <div className="text-sm text-neutral-400">DAOメンバー（上位）</div>
                <div className="mt-1 text-2xl font-semibold">2,000 USDT</div>
                <div className="mt-2 text-sm text-neutral-400">
                  閲覧＋投票 / 先行案件 抽選参加
                </div>
              </div>
            </div>

            <div className="text-xs leading-6 text-neutral-400">
              注意：本ページの内容は、出資・株式・経営権を示すものではありません。提供されるのはサービス内の権利・特典です。
            </div>
          </div>

          {/* Right: Relationship diagram */}
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-neutral-300">DAOメンバー 相関図</div>
                <div className="mt-2 text-2xl font-semibold">Governance Access Layers</div>
                <div className="mt-2 text-sm text-neutral-400">
                  “通常会員” → “DAOメンバー” → “DAOフェロー”
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-xs text-neutral-200">
                LAYERS
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-950/60 p-5">
              {/* Diagram (SVG) */}
              <svg
                viewBox="0 0 920 520"
                className="h-auto w-full"
                role="img"
                aria-label="DAO membership relationship diagram"
              >
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
                    <stop offset="1" stopColor="rgba(255,255,255,0.04)" />
                  </linearGradient>
                </defs>

                {/* background frame */}
                <rect
                  x="12"
                  y="12"
                  width="896"
                  height="496"
                  rx="28"
                  fill="rgba(0,0,0,0.08)"
                  stroke="rgba(255,255,255,0.10)"
                />

                {/* nodes */}
                {/* Fellow */}
                <rect
                  x="90"
                  y="70"
                  width="740"
                  height="110"
                  rx="22"
                  fill="url(#g1)"
                  stroke="rgba(255,255,255,0.14)"
                />
                <text
                  x="130"
                  y="115"
                  fill="rgba(255,255,255,0.92)"
                  fontSize="28"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  DAOフェロー（5,000）
                </text>
                <text
                  x="130"
                  y="150"
                  fill="rgba(255,255,255,0.70)"
                  fontSize="18"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  発言＋投票 / P/L開示 / 分配プール参加（仕様内）/ 先行案件 優先案内
                </text>

                {/* Member */}
                <rect
                  x="140"
                  y="225"
                  width="640"
                  height="110"
                  rx="22"
                  fill="rgba(255,255,255,0.08)"
                  stroke="rgba(255,255,255,0.12)"
                />
                <text
                  x="180"
                  y="270"
                  fill="rgba(255,255,255,0.90)"
                  fontSize="26"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  DAOメンバー（2,000）
                </text>
                <text
                  x="180"
                  y="305"
                  fill="rgba(255,255,255,0.70)"
                  fontSize="18"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  閲覧＋投票 / 先行案件 抽選参加 / 上位枠の透明性アクセス
                </text>

                {/* Normal */}
                <rect
                  x="190"
                  y="380"
                  width="540"
                  height="90"
                  rx="22"
                  fill="rgba(255,255,255,0.05)"
                  stroke="rgba(255,255,255,0.10)"
                />
                <text
                  x="230"
                  y="420"
                  fill="rgba(255,255,255,0.86)"
                  fontSize="22"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  通常会員（1,000以下）
                </text>
                <text
                  x="230"
                  y="450"
                  fill="rgba(255,255,255,0.62)"
                  fontSize="16"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  サービス利用権・一般特典（DAOの投票/発言は含まれない）
                </text>

                {/* arrows */}
                <path
                  d="M460 185 L460 220"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M460 340 L460 375"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M448 218 L460 232 L472 218"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M448 373 L460 387 L472 373"
                  fill="none"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <div className="mt-4 text-[11px] leading-5 text-neutral-500">
                ※「DAO」は意思決定プロセスの枠組みを示します。提供される権利はLIFAIサービス内の特典として設計されています。
                本ページは出資募集・有価証券・利益配当・価格上昇益を示すものではありません。
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">参加レイヤー</div>
                <div className="mt-2 text-sm text-neutral-300">
                  権限は「閲覧 → 投票 → 発言 → 透明性」の順で拡張
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">制約</div>
                <div className="mt-2 text-sm text-neutral-300">
                  収益分配・持分・議決権株式は付与されません
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 2000: Rights -> Purchase link ===== */}
        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">DAOメンバー（2,000 USDT）</h2>
            <div className="text-xs text-neutral-400">
              プレセール限定 / 限定{SEAT_LIMIT_2000}枠
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-6 lg:col-span-2">
              <div className="text-sm font-semibold text-neutral-200">付与される権利</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "DAO閲覧権",
                    desc: "議題・議事ログ・方針を閲覧。",
                  },
                  {
                    title: "DAO投票権",
                    desc: "意思決定に投票で参加。",
                  },
                  {
                    title: "先行案件 抽選参加権",
                    desc: "先行案件への抽選参加枠。",
                  },
                  {
                    title: "透明性アクセス",
                    desc: "運用方針・ルール・意思決定ログの透明性。",
                  },
                ].map((x) => (
                  <div
                    key={x.title}
                    className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
                  >
                    <div className="text-base font-semibold">{x.title}</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-400">
                      {x.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-sm font-semibold text-neutral-200">含まれないもの</div>
                <div className="mt-2 text-sm leading-6 text-neutral-400">
                  発言権・収益分配・持分・株式・経営権・利益配当・価格上昇益を約束する権利は含まれません。
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-6">
              <div className="text-sm text-neutral-300">価格</div>
              <div className="mt-2 text-3xl font-semibold">2,000 USDT</div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">月の交換上限</div>
                <div className="mt-2 text-xl font-semibold">200,000円</div>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">プレセール限定</div>
                <div className="mt-2 text-sm text-neutral-300">
                  限定{SEAT_LIMIT_2000}枠 / 埋まり次第終了
                </div>
              </div>

              <button
                onClick={() => handlePay("2000")}
                disabled={payBusy2000}
                className="mt-6 w-full rounded-2xl bg-white px-6 py-4 text-base font-bold text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
              >
                {payBusy2000 ? "決済ページを準備中…" : "DAOメンバーに申し込む（2,000）"}
              </button>

              <div className="mt-4 text-xs leading-6 text-neutral-500">
                ※提供されるのはLIFAIサービス内の権利・特典です。
              </div>
            </div>
          </div>
        </section>

        {/* ===== 5000: Rights -> Purchase link ===== */}
        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">DAOフェロー（5,000 USDT）</h2>
            <div className="text-xs text-neutral-400">
              プレセール限定 / 限定{SEAT_LIMIT_5000}枠
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Luxury panel */}
            <div className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-neutral-300">PRESALE / LIMITED ACCESS</div>
                  <div className="mt-2 text-2xl font-semibold">Fellowship Tier</div>
                  <div className="mt-2 text-sm text-neutral-400">
                    “参加”ではなく、<span className="text-neutral-200">中枢</span>へ。
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-xs text-neutral-200">
                  FELLOW
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { title: "DAO閲覧権", desc: "議題・議事ログ・方針を閲覧。" },
                  { title: "DAO投票権", desc: "意思決定に投票で参加。" },
                  { title: "DAO発言権", desc: "議題に対して意見提出が可能。" },
                  { title: "P/L開示", desc: "ワークフロー部門の損益計算書（P/L）を閲覧。" },
                ].map((x) => (
                  <div
                    key={x.title}
                    className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"
                  >
                    <div className="text-base font-semibold">{x.title}</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-400">{x.desc}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                <div className="text-sm font-semibold">
                  分配プール（最大{POOL_MAX_PCT}%）
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  分配対象は<strong className="text-neutral-200">ワークフロー追加課金の月間売上（経費控除後）</strong>。
                  そのうち最大{POOL_MAX_PCT}%を、DAOフェローで分配します。
                  <br />
                  <span className="text-neutral-500">※在籍中のみ有効</span>
                </p>

                <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs text-neutral-400">個人上限（紹介条件）</div>
                  <div className="mt-2 text-sm text-neutral-300">
                    Core以上の紹介者が<strong className="text-neutral-100">{STEP_PEOPLE}人ごとに +{STEP_PCT}%</strong>、
                    最大<strong className="text-neutral-100">{PERSONAL_MAX_PCT}%</strong>まで。
                    解約時はカウント減少。
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <div className="text-xs text-neutral-400">試算（表示用）</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        value={refCoreCount}
                        onChange={(e) => setRefCoreCount(Number(e.target.value || 0))}
                        className="w-28 rounded-xl border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-100 outline-none"
                        placeholder="0"
                      />
                      <div className="text-sm text-neutral-300">
                        Core以上紹介{" "}
                        <span className="text-neutral-100 font-semibold">{refCoreCount}</span>{" "}
                        人 → 個人上限{" "}
                        <span className="text-neutral-100 font-semibold">{personalPct}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-500">
                      ※これは「個人上限％」の目安表示です。実際の分配はプール内での計算方式に依存します。
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">含まれないもの</div>
                <div className="mt-2 text-sm leading-6 text-neutral-400">
                  有価証券・持分・株式・経営権・利益配当・価格上昇益を約束する権利は含まれません。
                </div>
              </div>
            </div>

            {/* Right: Purchase card */}
            <div className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-6">
              <div className="text-sm text-neutral-300">価格</div>
              <div className="mt-2 text-3xl font-semibold">5,000 USDT</div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">月の交換上限</div>
                <div className="mt-2 text-xl font-semibold">400,000円</div>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">EP</div>
                <div className="mt-2 text-sm text-neutral-200">
                  通常：4EP=1円 / MAX：2EP=1円
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs text-neutral-400">プレセール限定</div>
                <div className="mt-2 text-sm text-neutral-300">
                  限定{SEAT_LIMIT_5000}枠 / 埋まり次第終了
                </div>
              </div>

              <button
                type="button"
                onClick={() => handlePay("5000")}
                disabled={payBusy5000}
                className={[
                  "mt-6 w-full inline-flex items-center justify-center rounded-2xl px-6 py-4 text-base font-bold",
                  "bg-neutral-50 text-neutral-950 hover:bg-neutral-200",
                  payBusy5000 ? "opacity-70 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {payBusy5000 ? "決済ページを準備中…" : "DAOフェローに申し込む（5,000）"}
              </button>

              <div className="mt-4 text-xs leading-6 text-neutral-500">
                ※在籍中のみ有効。提供されるのはLIFAIサービス内の権利・特典です。
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-neutral-900 pt-8 text-xs text-neutral-500">
          © {new Date().getFullYear()} LIFAI
        </footer>
      </div>
    </main>
  );
}