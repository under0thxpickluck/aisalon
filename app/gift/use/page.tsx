"use client";
import Link from "next/link";
import { useTheme } from "@/app/lib/useTheme";

const FEATURES = [
  {
    icon: "🎵",
    title: "Music Boost",
    desc: "あなたの楽曲を企業向け配信ネットワークに掲載。GiftEPで優先枠を獲得できます。",
    href: "/music-boost",
    available: true,
  },
  {
    icon: "⚙️",
    title: "ワークフロー",
    desc: "LIFAI内のワークフローコンテンツで利用できます。",
    href: "/top",
    available: true,
  },
  {
    icon: "🛒",
    title: "マーケット",
    desc: "マーケットでのご利用はできません。マーケットはEP・BPのみ対応しています。",
    href: null,
    available: false,
  },
];

const C_DARK = {
  text:      "#EAF0FF",
  textMed:   "rgba(234,240,255,0.7)",
  textSub:   "rgba(234,240,255,0.6)",
  textMuted: "rgba(234,240,255,0.45)",
  textDim:   "rgba(234,240,255,0.35)",
  textFaint: "rgba(234,240,255,0.25)",
  textGhost: "rgba(234,240,255,0.2)",
  accent:    "#A78BFA",
  accentSub: "rgba(167,139,250,0.7)",
  border:    "rgba(255,255,255,0.08)",
  borderSub: "rgba(255,255,255,0.05)",
  bg:        "rgba(255,255,255,0.04)",
  bgSub:     "rgba(255,255,255,0.07)",
  error:     "#FCA5A5",
};

const C_LIGHT = {
  text:      "#0f172a",
  textMed:   "#334155",
  textSub:   "#475569",
  textMuted: "#64748b",
  textDim:   "#94a3b8",
  textFaint: "#94a3b8",
  textGhost: "#cbd5e1",
  accent:    "#7c3aed",
  accentSub: "#6d28d9",
  border:    "#e2e8f0",
  borderSub: "#f1f5f9",
  bg:        "#f8fafc",
  bgSub:     "#f1f5f9",
  error:     "#b91c1c",
};

export default function GiftUsePage() {
  const { isDark } = useTheme();
  const C = isDark ? C_DARK : C_LIGHT;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B1220] dark:text-[#EAF0FF]">
      <div className="pointer-events-none fixed inset-0 -z-10 dark:block hidden" style={{
        background: "radial-gradient(ellipse 600px 400px at 20% -10%, rgba(124,58,237,0.12) 0%, transparent 60%)" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Link href="/gift" style={{ borderRadius: 14, border: `1px solid ${C.border}`,
            background: C.bg, padding: "6px 14px", fontSize: 12,
            fontWeight: 600, color: C.textSub, textDecoration: "none" }}>
            ← 戻る
          </Link>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>✨ GiftEPの使い道</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>GiftEPで使えるもの</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 24 }}>
          GiftEPはLIFAI内の運営公式機能でのみ利用できます
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FEATURES.map(f => (
            <div key={f.title}
              className={`bg-white dark:bg-[#0F1A2E] ${f.available ? "border-violet-300 dark:border-violet-500/30" : "border-slate-200 dark:border-white/[0.06]"} border`}
              style={{
              borderRadius: 20, padding: "18px 20px",
              opacity: f.available ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{f.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{f.title}</p>
                    {f.available ? (
                      <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(124,58,237,0.25)",
                        color: C.accent, borderRadius: 9999, padding: "2px 8px" }}>GiftEP利用可</span>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, background: C.bgSub,
                        color: C.textDim, borderRadius: 9999, padding: "2px 8px" }}>利用不可</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
                {f.available && f.href && (
                  <Link href={f.href} style={{ flexShrink: 0, borderRadius: 12,
                    background: "linear-gradient(90deg,#6366F1,#A78BFA)",
                    padding: "8px 16px", fontSize: 11, fontWeight: 700,
                    color: "#fff", textDecoration: "none" }}>
                    使う →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, borderRadius: 16, border: "1px solid rgba(167,139,250,0.15)",
          background: "rgba(124,58,237,0.05)", padding: "14px 16px",
          fontSize: 11, color: C.accentSub, lineHeight: 1.8 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>⚠ GiftEPの制限</p>
          <p>・マーケットでの購入・出品には使えません</p>
          <p>・ユーザー間取引に使えません</p>
          <p>・外部サービスへの移転はできません</p>
          <p>・換金・売買は永久BANの対象です</p>
        </div>

        <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: C.textGhost }}>© LIFAI</div>
      </div>
    </main>
  );
}
