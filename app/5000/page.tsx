"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadDraft, saveDraft } from "@/components/storage";

/* ===== 定数 ===== */
const AMOUNT_2000 = 2000;
const AMOUNT_5000 = 5000;

type PlanId = "1000" | "2000" | "5000";

/* ===== fade variants ===== */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" },
  }),
};

export default function DaoMemberPage() {
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("5000");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

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

  /* ===== 還元アニメーション用 ===== */
  const slots = selectedPlan === "5000" ? 3 : selectedPlan === "2000" ? 2 : 0;

  return (
    <main
      className="min-h-screen text-white overflow-x-hidden"
      style={{ background: "#0A0A0A" }}
    >
      {/* ── 背景グロー（固定） ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.07, 0.13, 0.07] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-200px] left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, #6C63FF 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-150px] right-[-100px] h-[450px] w-[450px] rounded-full"
          style={{
            background: "radial-gradient(circle, #00D4FF 0%, transparent 70%)",
            opacity: 0.05,
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-16">

        {/* ======================================================
            ① Hero
        ====================================================== */}
        <section className="text-center mb-20">
          {/* バッジ */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 mb-8"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#6C63FF] animate-pulse" />
            LIMITED ACCESS — 先着枠
          </motion.div>

          {/* AI コア光る円 */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="h-28 w-28 rounded-full flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle, #6C63FF 0%, #00D4FF 60%, transparent 100%)",
                  boxShadow: "0 0 60px 20px rgba(108,99,255,0.4), 0 0 120px 40px rgba(0,212,255,0.15)",
                }}
              >
                <span className="text-4xl select-none">⬡</span>
              </motion.div>
              {/* 外周リング */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-12px] rounded-full border border-dashed border-[#6C63FF]/30"
              />
            </div>
          </motion.div>

          {/* テキスト */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            <div className="text-sm font-semibold tracking-[0.25em] text-[#6C63FF] mb-3 uppercase">
              LIFAI Limited Access
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
              今は一部の参加者だけが<br className="hidden sm:block" />使っている
            </h1>
            <p className="text-lg text-white/40 mb-6">
              $1,000 / $2,000 / $5,000
            </p>
          </motion.div>

          {/* 残り枠カウンター */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
            className="inline-flex gap-4 flex-wrap justify-center"
          >
            {[
              { plan: "1000", label: "$1,000", slots: "残り——枠" },
              { plan: "2000", label: "$2,000", slots: "残り50枠" },
              { plan: "5000", label: "$5,000", slots: "残り20枠" },
            ].map((item) => (
              <div
                key={item.plan}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50"
              >
                <span className="text-white/80 font-bold">{item.label}</span>{" "}
                {item.slots}
              </div>
            ))}
          </motion.div>
        </section>

        {/* ======================================================
            ② プランカード（タブ切り替え）
        ====================================================== */}
        <section className="mb-20">
          {/* タブ */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
            className="flex justify-center gap-2 mb-8"
          >
            {(["1000", "2000", "5000"] as PlanId[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPlan(p)}
                className="relative rounded-full px-5 py-2 text-sm font-bold transition-all"
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

          {/* カード */}
          <AnimatePresence mode="wait">
            {selectedPlan === "5000" && (
              <motion.div
                key="card5000"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative rounded-3xl border p-8 text-center mx-auto max-w-sm"
                style={{
                  borderColor: "rgba(108,99,255,0.6)",
                  background: "rgba(108,99,255,0.08)",
                  boxShadow: "0 0 60px rgba(108,99,255,0.3), 0 0 120px rgba(108,99,255,0.1)",
                }}
              >
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold"
                  style={{ background: "#6C63FF", boxShadow: "0 0 16px rgba(108,99,255,0.7)" }}
                >
                  RECOMMENDED
                </div>
                <div className="text-xs tracking-widest text-[#6C63FF] font-semibold mb-2">FELLOW</div>
                <div className="text-5xl font-black mb-6">$5,000</div>
                <ul className="space-y-3 text-sm text-white/70 text-left">
                  <li className="flex items-center gap-2"><span className="text-[#6C63FF]">✓</span> コンテンツ利用無制限</li>
                  <li className="flex items-center gap-2"><span className="text-[#6C63FF]">✓</span> 月額サポート契約</li>
                  <li className="flex items-center gap-2"><span className="text-[#6C63FF]">✓</span> 還元あり <span className="text-[#a5b4fc] font-bold ml-1">（3口）</span></li>
                  <li className="flex items-center gap-2"><span className="text-[#00D4FF]">✓</span> 🎧 Music Boost</li>
                </ul>
              </motion.div>
            )}
            {selectedPlan === "2000" && (
              <motion.div
                key="card2000"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative rounded-3xl border p-8 text-center mx-auto max-w-sm"
                style={{
                  borderColor: "rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                  boxShadow: "0 0 30px rgba(108,99,255,0.12)",
                }}
              >
                <div className="text-xs tracking-widest text-white/40 font-semibold mb-2">MEMBER</div>
                <div className="text-5xl font-black mb-6">$2,000</div>
                <ul className="space-y-3 text-sm text-white/70 text-left">
                  <li className="flex items-center gap-2"><span className="text-white/50">✓</span> コンテンツ利用無制限</li>
                  <li className="flex items-center gap-2"><span className="text-white/50">✓</span> 月額サポート契約</li>
                  <li className="flex items-center gap-2"><span className="text-white/50">✓</span> 還元あり <span className="text-white/70 font-bold ml-1">（2口）</span></li>
                </ul>
              </motion.div>
            )}
            {selectedPlan === "1000" && (
              <motion.div
                key="card1000"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative rounded-3xl border p-8 text-center mx-auto max-w-sm"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div className="text-xs tracking-widest text-white/30 font-semibold mb-2">STARTER</div>
                <div className="text-5xl font-black mb-6">$1,000</div>
                <ul className="space-y-3 text-sm text-white/60 text-left">
                  <li className="flex items-center gap-2"><span className="text-white/40">✓</span> コンテンツ利用無制限</li>
                  <li className="flex items-center gap-2"><span className="text-white/40">✓</span> 月額サポート契約</li>
                  <li className="flex items-center gap-2 text-white/25">　 還元なし</li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ======================================================
            ③ 還元アニメーション
        ====================================================== */}
        <section className="mb-20 text-center">
          <motion.h2
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-xs tracking-widest text-white/30 font-semibold mb-8 uppercase"
          >
            Revenue Distribution
          </motion.h2>

          <div className="flex flex-col items-center gap-6">
            {/* フロー図 */}
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
              className="flex items-center gap-3 text-sm text-white/50"
            >
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/70 font-bold">
                売上
              </span>
              <span className="text-white/20">→</span>
              <span
                className="rounded-full px-4 py-2 font-extrabold text-white"
                style={{ background: "#6C63FF", boxShadow: "0 0 16px rgba(108,99,255,0.5)" }}
              >
                5%
              </span>
              <span className="text-white/20">→</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/70 font-bold">
                分配
              </span>
            </motion.div>

            {/* 口数アニメーション */}
            <AnimatePresence mode="wait">
              {slots > 0 ? (
                <motion.div
                  key={`slots-${slots}`}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="flex gap-3 mt-2"
                >
                  {Array.from({ length: slots }).map((_, i) => (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={{
                        hidden: { opacity: 0, scale: 0, x: 0 },
                        visible: {
                          opacity: 1,
                          scale: 1,
                          x: (i - (slots - 1) / 2) * 12,
                          transition: { delay: i * 0.15, duration: 0.4, type: "spring" },
                        },
                      }}
                      className="rounded-full flex items-center justify-center font-extrabold text-white"
                      style={{
                        width: slots === 3 ? 64 : 56,
                        height: slots === 3 ? 64 : 56,
                        background:
                          i === 0
                            ? "linear-gradient(135deg,#6C63FF,#00D4FF)"
                            : "rgba(108,99,255,0.25)",
                        border: "2px solid rgba(108,99,255,0.5)",
                        boxShadow: i === 0 ? "0 0 20px rgba(108,99,255,0.5)" : "none",
                        fontSize: 13,
                      }}
                    >
                      {i + 1}口
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="no-slots"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-white/25 mt-2"
                >
                  1,000プランは還元対象外
                </motion.div>
              )}
            </AnimatePresence>

            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2}
              className="text-xs text-white/30 mt-2"
            >
              人数と売上で毎月変動 / 在籍中のみ有効
            </motion.p>
          </div>
        </section>

        {/* ======================================================
            ④ What You Get
        ====================================================== */}
        <section className="mb-20">
          <motion.h2
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-xs tracking-widest text-white/30 font-semibold mb-8 uppercase text-center"
          >
            What You Get
          </motion.h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "🤖", title: "AIツール", desc: "音声 / 会話 / 自動化", i: 0 },
              { icon: "🎧", title: "音楽生成", desc: "AI楽曲制作", i: 1 },
              { icon: "💰", title: "収益機会", desc: "コンテンツ販売 / 仕組み化", i: 2 },
              { icon: "🚀", title: "先行アクセス", desc: "新機能優先", i: 3 },
            ].map(({ icon, title, desc, i }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="rounded-2xl border border-white/8 p-5"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="text-2xl mb-2">{icon}</div>
                <div className="font-bold text-sm mb-1 text-white/90">{title}</div>
                <div className="text-xs text-white/40">{desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ======================================================
            ⑤ 月額サブスク（glassmorphism）
        ====================================================== */}
        <section className="mb-20">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="rounded-3xl border border-white/10 p-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold mb-1 uppercase">Monthly</div>
            <h2 className="text-lg font-extrabold mb-1 text-white/90">月額サポート契約</h2>
            <div className="text-3xl font-black mb-6" style={{ color: "#6C63FF" }}>
              ¥9,800{" "}
              <span className="text-sm font-normal text-white/30">/ 月</span>
            </div>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-white/60">
              <li className="flex items-center gap-2">🎓 オンライン講習（月1回）</li>
              <li className="flex items-center gap-2">🤝 オフライン講習（隔月）</li>
              <li className="flex items-center gap-2">🛠 サポート窓口</li>
              <li className="flex items-center gap-2">☁️ インフラ運用</li>
            </ul>
          </motion.div>
        </section>

        {/* ======================================================
            ⑥ 信頼ブロック（ロードマップ）
        ====================================================== */}
        <section className="mb-20">
          <motion.h2
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-xs tracking-widest text-white/30 font-semibold mb-8 uppercase text-center"
          >
            Roadmap
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
              className="rounded-2xl border border-[#6C63FF]/30 p-5"
              style={{ background: "rgba(108,99,255,0.06)" }}
            >
              <div className="text-xs text-[#6C63FF] font-bold tracking-widest mb-3 uppercase">Active Systems</div>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li>🎵 音楽生成 AI</li>
                <li>🤖 AI チャット / 自動化</li>
                <li>⚡ ワークフロー自動化</li>
              </ul>
            </motion.div>
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
              className="rounded-2xl border border-[#00D4FF]/20 p-5"
              style={{ background: "rgba(0,212,255,0.04)" }}
            >
              <div className="text-xs text-[#00D4FF] font-bold tracking-widest mb-3 uppercase">Coming Next</div>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li>🤖 Bot プラットフォーム</li>
                <li>🛒 Marketplace</li>
                <li>🔌 API 公開</li>
              </ul>
            </motion.div>
          </div>
        </section>

        {/* ======================================================
            ⑦ アコーディオン
        ====================================================== */}
        <section className="mb-16">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <button
              type="button"
              onClick={() => setAccordionOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-sm font-semibold text-white/50 hover:bg-white/7 transition"
            >
              <span>▼ 詳細・利用条件</span>
              <motion.span
                animate={{ rotate: accordionOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
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
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* ======================================================
            ⑧ CTA
        ====================================================== */}
        <section className="text-center">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <motion.button
              type="button"
              disabled={payBusy}
              onClick={handleCta}
              whileHover={
                !payBusy
                  ? {
                      scale: 1.04,
                      boxShadow:
                        selectedPlan === "5000"
                          ? "0 0 50px rgba(108,99,255,0.7), 0 0 100px rgba(108,99,255,0.3)"
                          : "0 0 30px rgba(255,255,255,0.2)",
                    }
                  : {}
              }
              whileTap={!payBusy ? { scale: 0.97 } : {}}
              transition={{ type: "spring", stiffness: 300 }}
              className="inline-flex items-center justify-center rounded-2xl px-12 py-4 text-base font-extrabold"
              style={{
                background:
                  selectedPlan === "5000"
                    ? "linear-gradient(135deg, #6C63FF, #00D4FF)"
                    : selectedPlan === "2000"
                    ? "#6C63FF"
                    : "rgba(255,255,255,0.12)",
                color: "#fff",
                boxShadow:
                  selectedPlan === "5000"
                    ? "0 0 35px rgba(108,99,255,0.45)"
                    : "none",
                opacity: payBusy ? 0.6 : 1,
                cursor: payBusy ? "not-allowed" : "pointer",
              }}
            >
              {ctaLabel}
            </motion.button>
            <p className="mt-3 text-xs text-white/25">先着 / 審査あり</p>
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
