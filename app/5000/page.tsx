"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, Variants, useInView } from "framer-motion";
import { loadDraft, saveDraft } from "@/components/storage";

/* ===== 定数 ===== */
const AMOUNT_2000 = 2000;
const AMOUNT_5000 = 5000;

type PlanId = "1000" | "2000" | "5000";

/* ===== Variants ===== */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

/* ===== カウントアップ hook ===== */
function useCountUp(target: number, duration = 1.5) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let current = 0;
    const step = target / (duration * 60);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return { count, ref };
}

/* ===== Component ===== */
export default function DaoMemberPage() {
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("5000");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  /* カウントアップ */
  const c1 = useCountUp(128);
  const c2 = useCountUp(3);
  const c3 = useCountUp(12);

  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
  }, []);

  /* ===== 既存ロジック再利用 ===== */
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
    if (selectedPlan === "1000") {
      alert("1,000プランは個別にお問い合わせください。");
      return;
    }
    handlePay(selectedPlan as "2000" | "5000");
  }

  const ctaLabel = payBusy
    ? "処理中…"
    : selectedPlan === "1000"
    ? "お問い合わせ（$1,000）"
    : selectedPlan === "2000"
    ? "Join LIFAI（$2,000）"
    : "Join LIFAI（$5,000）";

  const slots = selectedPlan === "5000" ? 3 : selectedPlan === "2000" ? 2 : 0;

  return (
    <main className="min-h-screen text-white overflow-x-hidden" style={{ background: "#0A0A0A" }}>
      {/* CSS keyframes */}
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hero-gradient {
          background: linear-gradient(135deg, #6C63FF 0%, #00D4FF 40%, #0A0A0A 70%, #6C63FF 100%);
          background-size: 300% 300%;
          animation: gradientShift 12s ease infinite;
        }
        @keyframes coreGlow {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(108,99,255,0.45); }
          50%       { box-shadow: 0 0 90px 35px rgba(108,99,255,0.75), 0 0 140px 60px rgba(0,212,255,0.25); }
        }
        .ai-core { animation: coreGlow 3s ease-in-out infinite; }
      `}</style>

      {/* ── 固定背景ブロブ ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-[-200px] left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute bottom-[-150px] right-[-100px] h-[400px] w-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* ======================================================
          ① Hero
      ====================================================== */}
      <section className="hero-gradient relative min-h-screen flex flex-col items-center justify-center text-center px-4 pb-20">
        {/* オーバーレイ */}
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 flex flex-col items-center">
          {/* バッジ */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 mb-10 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#6C63FF] animate-pulse" />
            LIMITED ACCESS — 先着枠
          </motion.div>

          {/* AI コア */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="flex justify-center mb-12"
          >
            <div className="relative">
              <div
                className="ai-core h-32 w-32 rounded-full flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle, #6C63FF 0%, #00D4FF 55%, transparent 100%)",
                }}
              >
                <span className="text-4xl select-none">⬡</span>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-16px] rounded-full border border-dashed border-[#6C63FF]/30"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-36px] rounded-full border border-dashed border-[#00D4FF]/15"
              />
            </div>
          </motion.div>

          {/* テキスト */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            <div className="text-sm font-semibold tracking-[0.25em] text-[#6C63FF] uppercase mb-3">
              LIFAI Limited Access
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
              今は一部の参加者だけが
              <br className="hidden sm:block" />
              使っている
            </h1>
            <p className="text-xl text-white/45 mb-10">$1,000 / $2,000 / $5,000</p>
          </motion.div>

          {/* 残り枠カウンター */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="inline-flex flex-wrap justify-center gap-3"
          >
            {[
              { label: "$1,000", slots: "残り——枠" },
              { label: "$2,000", slots: "残り50枠" },
              { label: "$5,000", slots: "残り20枠" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs backdrop-blur-sm"
              >
                <span className="text-white/80 font-bold">{item.label}</span>{" "}
                <span className="text-white/40">{item.slots}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* スクロール誘導 */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-xs"
        >
          ↓
        </motion.div>
      </section>

      <div className="relative mx-auto max-w-3xl px-4 py-20">

        {/* ======================================================
            ② プランカード
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Plans</div>
            <h2 className="text-2xl font-black">参加プランを選ぶ</h2>
          </motion.div>

          {/* タブ */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="flex justify-center gap-2 mb-8"
          >
            {(["1000", "2000", "5000"] as PlanId[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPlan(p)}
                className="rounded-full px-6 py-2 text-sm font-bold transition-all duration-200"
                style={{
                  background: selectedPlan === p ? "#6C63FF" : "rgba(255,255,255,0.05)",
                  color: selectedPlan === p ? "#fff" : "rgba(255,255,255,0.4)",
                  boxShadow: selectedPlan === p ? "0 0 20px rgba(108,99,255,0.5)" : "none",
                }}
              >
                ${p}
              </button>
            ))}
          </motion.div>

          {/* 3枚グリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">

            {/* 1000 */}
            <motion.div
              animate={{
                scale: selectedPlan === "1000" ? 1.02 : 0.94,
                opacity: selectedPlan === "1000" ? 1 : 0.55,
              }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => setSelectedPlan("1000")}
              className="cursor-pointer rounded-2xl border p-6"
              style={{
                borderColor:
                  selectedPlan === "1000" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                background:
                  selectedPlan === "1000" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              }}
            >
              <div className="text-[11px] tracking-widest text-white/30 font-semibold mb-1">STARTER</div>
              <div className="text-3xl font-black mb-4">$1,000</div>
              <ul className="space-y-2 text-xs text-white/50">
                <li>✓ コンテンツ利用無制限</li>
                <li>✓ 月額サポート契約</li>
                <li className="text-white/25">還元なし</li>
              </ul>
            </motion.div>

            {/* 5000 — 中央・強調 */}
            <motion.div
              animate={{
                scale: selectedPlan === "5000" ? 1.1 : 0.94,
                opacity: selectedPlan === "5000" ? 1 : 0.6,
              }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => setSelectedPlan("5000")}
              className="cursor-pointer relative rounded-2xl border p-6"
              style={{
                borderColor: "rgba(108,99,255,0.65)",
                background: "rgba(108,99,255,0.1)",
                boxShadow:
                  selectedPlan === "5000"
                    ? "0 0 60px rgba(108,99,255,0.38), 0 0 120px rgba(108,99,255,0.12)"
                    : "none",
              }}
            >
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white whitespace-nowrap"
                style={{
                  background: "#6C63FF",
                  boxShadow: "0 0 16px rgba(108,99,255,0.7)",
                }}
              >
                MOST POPULAR
              </div>
              <div className="text-[11px] tracking-widest text-[#6C63FF] font-semibold mb-1">FELLOW</div>
              <div className="text-3xl font-black mb-4">$5,000</div>
              <ul className="space-y-2 text-xs text-white/70">
                <li>✓ コンテンツ利用無制限</li>
                <li>✓ 月額サポート契約</li>
                <li>
                  ✓ 還元あり{" "}
                  <span className="text-[#a5b4fc] font-bold">（3口）</span>
                </li>
                <li>✓ 🎧 Music Boost</li>
              </ul>
            </motion.div>

            {/* 2000 */}
            <motion.div
              animate={{
                scale: selectedPlan === "2000" ? 1.02 : 0.94,
                opacity: selectedPlan === "2000" ? 1 : 0.6,
              }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => setSelectedPlan("2000")}
              className="cursor-pointer relative rounded-2xl border p-6"
              style={{
                borderColor:
                  selectedPlan === "2000"
                    ? "rgba(108,99,255,0.45)"
                    : "rgba(255,255,255,0.12)",
                background:
                  selectedPlan === "2000"
                    ? "rgba(108,99,255,0.07)"
                    : "rgba(255,255,255,0.04)",
                boxShadow:
                  selectedPlan === "2000" ? "0 0 28px rgba(108,99,255,0.22)" : "none",
              }}
            >
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold whitespace-nowrap"
                style={{
                  background: "rgba(108,99,255,0.25)",
                  border: "1px solid rgba(108,99,255,0.5)",
                  color: "#a5b4fc",
                }}
              >
                RECOMMENDED
              </div>
              <div className="text-[11px] tracking-widest text-white/35 font-semibold mb-1">MEMBER</div>
              <div className="text-3xl font-black mb-4">$2,000</div>
              <ul className="space-y-2 text-xs text-white/55">
                <li>✓ コンテンツ利用無制限</li>
                <li>✓ 月額サポート契約</li>
                <li>
                  ✓ 還元あり{" "}
                  <span className="text-white/70 font-bold">（2口）</span>
                </li>
              </ul>
            </motion.div>

          </div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            className="text-center text-xs text-white/25 mt-6"
          >
            ※すべてのプランに月額契約（¥9,800）が必要です
          </motion.p>
        </section>

        {/* ======================================================
            ③ What You Get
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Features</div>
            <h2 className="text-2xl font-black">LIFAIでできること</h2>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "🤖", title: "AIツール", desc: "音声 / 会話 / 自動化", accent: "#6C63FF", i: 0 },
              { icon: "🎧", title: "音楽生成", desc: "AI楽曲制作（Beta）", accent: "#00D4FF", i: 1 },
              { icon: "💰", title: "収益機会", desc: "コンテンツ販売 / 仕組み化", accent: "#6C63FF", i: 2 },
              { icon: "🚀", title: "先行アクセス", desc: "新機能を最速で使える", accent: "#00D4FF", i: 3 },
            ].map(({ icon, title, desc, accent, i }) => (
              <motion.div
                key={title}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                whileHover={{
                  scale: 1.03,
                  boxShadow: `0 0 32px ${accent}33`,
                  borderColor: `${accent}55`,
                  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
                }}
                className="rounded-2xl border border-white/8 p-5 cursor-pointer"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="text-3xl mb-3">{icon}</div>
                <div className="font-bold text-sm mb-1 text-white/90">{title}</div>
                <div className="text-xs text-white/40">{desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ======================================================
            ④ 還元の可視化
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">
              Revenue Share
            </div>
            <h2 className="text-2xl font-black">パートナー還元</h2>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="rounded-3xl border border-white/10 p-8"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {/* フロー図 */}
            <div className="flex items-center justify-center gap-3 flex-wrap mb-10">
              <div className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/70">
                売上
              </div>
              <div className="text-white/30 text-lg">→</div>
              <div
                className="rounded-xl px-5 py-3 text-sm font-extrabold text-white"
                style={{
                  background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
                  boxShadow: "0 0 20px rgba(108,99,255,0.5)",
                }}
              >
                5%
              </div>
              <div className="text-white/30 text-lg">→</div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/70">
                パートナー分配
              </div>
            </div>

            {/* 口数アニメーション */}
            <div className="flex justify-center min-h-[88px] items-center mb-6">
              <AnimatePresence mode="wait">
                {slots > 0 ? (
                  <motion.div
                    key={`slots-${slots}`}
                    className="flex gap-4 items-center"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    {Array.from({ length: slots }).map((_, i) => (
                      <motion.div
                        key={i}
                        variants={{
                          hidden: { opacity: 0, scale: 0 },
                          visible: {
                            opacity: 1,
                            scale: 1,
                            transition: {
                              delay: i * 0.15,
                              duration: 0.45,
                              type: "spring",
                              stiffness: 220,
                            },
                          },
                        }}
                        className="rounded-full flex items-center justify-center font-extrabold text-white text-sm"
                        style={{
                          width: slots === 3 ? 72 : 64,
                          height: slots === 3 ? 72 : 64,
                          background:
                            i === 0
                              ? "linear-gradient(135deg, #6C63FF, #00D4FF)"
                              : `rgba(108,99,255,${0.28 - i * 0.06})`,
                          border: "2px solid rgba(108,99,255,0.5)",
                          boxShadow:
                            i === 0
                              ? "0 0 28px rgba(108,99,255,0.65)"
                              : "0 0 12px rgba(108,99,255,0.2)",
                        }}
                      >
                        {i + 1}口
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.p
                    key="no-slots"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-white/25"
                  >
                    1,000プランは還元対象外
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="text-center text-xs text-white/35 space-y-1">
              <p>2,000 = 2口　/　5,000 = 3口</p>
              <p>人数と売上で毎月変動　/　収益保証なし</p>
            </div>
          </motion.div>
        </section>

        {/* ======================================================
            ⑤ 月額サブスク（glassmorphism）
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border border-white/10 p-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-1">
              Monthly Plan
            </div>
            <h2 className="text-lg font-extrabold text-white/90 mb-2">月額サポート契約</h2>
            <div className="text-4xl font-black mb-6" style={{ color: "#6C63FF" }}>
              ¥9,800
              <span className="text-base font-normal text-white/30 ml-2">/ 月</span>
            </div>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-white/60">
              <li>🎓 オンライン講習（月1回）</li>
              <li>🤝 オフライン講習（隔月）</li>
              <li>🛠 専用サポート窓口</li>
              <li>☁️ 安定インフラ運用</li>
            </ul>
          </motion.div>
        </section>

        {/* ======================================================
            ⑥ 信頼ブロック（数字アニメーション）
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Status</div>
            <h2 className="text-2xl font-black">現在の状況</h2>
          </motion.div>

          {/* カウントアップ */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { spanRef: c1.ref, count: c1.count, label: "参加者", suffix: "名" },
              { spanRef: c2.ref, count: c2.count, label: "稼働システム", suffix: "本" },
              { spanRef: c3.ref, count: c3.count, label: "開発中機能", suffix: "件" },
            ].map(({ spanRef, count, label, suffix }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-2xl border border-white/8 p-4 text-center"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span
                  ref={spanRef}
                  className="text-3xl font-black"
                  style={{ color: "#6C63FF" }}
                >
                  {count}
                </span>
                <span className="text-sm text-white/50 ml-1">{suffix}</span>
                <div className="text-xs text-white/30 mt-1">{label}</div>
              </motion.div>
            ))}
          </div>

          {/* ロードマップ */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="rounded-2xl border border-white/8 p-5"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-4">
              Roadmap
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "音楽生成", done: true },
                { label: "AI自動化", done: true },
                { label: "Bot", next: true },
                { label: "Marketplace", next: true },
                { label: "API", soon: true },
              ].map(({ label, done, next, soon }) => (
                <span
                  key={label}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: done
                      ? "rgba(108,99,255,0.2)"
                      : next
                      ? "rgba(0,212,255,0.1)"
                      : "rgba(255,255,255,0.05)",
                    color: done
                      ? "#a5b4fc"
                      : next
                      ? "#00D4FF"
                      : "rgba(255,255,255,0.3)",
                    border: done
                      ? "1px solid rgba(108,99,255,0.4)"
                      : next
                      ? "1px solid rgba(0,212,255,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {done ? "✅" : next ? "🔄" : "🔜"} {label}
                </span>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ======================================================
            ⑦ アコーディオン
        ====================================================== */}
        <section className="mb-16">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <button
              type="button"
              onClick={() => setAccordionOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-sm font-semibold text-white/50 hover:bg-white/7 transition"
            >
              <span>▼ 詳細・利用条件</span>
              <motion.span
                animate={{ rotate: accordionOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-white/30"
              >
                ∧
              </motion.span>
            </button>

            <AnimatePresence>
              {accordionOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/4 px-5 py-5 space-y-4 text-sm text-white/50">
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 参加条件</div>
                      <p>月額契約が必須です。未払いの場合、特典・還元を含む全サービスが停止します。</p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 還元ルール</div>
                      <p>
                        対象は 2,000 / 5,000 プランのみ。毎月の売上に基づき計算・分配。
                        在籍中のみ有効。収益保証はありません。
                      </p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 5,000 特典</div>
                      <p>音楽生成機能の強化・優先処理・拡張機能が利用可能です。</p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 注意事項</div>
                      <p>
                        本サービスへの参加は投資ではありません。利回り・配当・価格上昇益の保証はなく、
                        株式・持分・経営権を付与するものではありません。
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* ======================================================
            ⑧ CTA
        ====================================================== */}
        <section className="text-center pb-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.button
              type="button"
              disabled={payBusy}
              onClick={handleCta}
              whileHover={
                !payBusy
                  ? {
                      scale: 1.06,
                      y: -5,
                      boxShadow:
                        "0 0 65px rgba(108,99,255,0.75), 0 0 130px rgba(108,99,255,0.3)",
                    }
                  : {}
              }
              whileTap={!payBusy ? { scale: 0.97 } : {}}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="inline-flex items-center justify-center rounded-2xl px-12 py-5 text-lg font-extrabold"
              style={{
                background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
                color: "#fff",
                boxShadow: "0 0 40px rgba(108,99,255,0.4)",
                opacity: payBusy ? 0.6 : 1,
                cursor: payBusy ? "not-allowed" : "pointer",
              }}
            >
              {ctaLabel}
            </motion.button>
            <p className="mt-3 text-xs text-white/25">先着受付中 / 審査あり</p>
          </motion.div>

          <div className="mt-12">
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
