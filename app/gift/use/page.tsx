"use client";
import Link from "next/link";

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

export default function GiftUsePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0B1220", color: "#EAF0FF" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: -10, pointerEvents: "none",
        background: "radial-gradient(ellipse 600px 400px at 20% -10%, rgba(124,58,237,0.12) 0%, transparent 60%)" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Link href="/gift" style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", padding: "6px 14px", fontSize: 12,
            fontWeight: 600, color: "rgba(234,240,255,0.65)", textDecoration: "none" }}>
            ← 戻る
          </Link>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(234,240,255,0.45)" }}>✨ GiftEPの使い道</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#EAF0FF", marginBottom: 6 }}>GiftEPで使えるもの</h1>
        <p style={{ fontSize: 12, color: "rgba(234,240,255,0.4)", marginBottom: 24 }}>
          GiftEPはLIFAI内の運営公式機能でのみ利用できます
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: "#0F1A2E",
              border: `1px solid ${f.available ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 20, padding: "18px 20px",
              opacity: f.available ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{f.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#EAF0FF" }}>{f.title}</p>
                    {f.available ? (
                      <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(124,58,237,0.25)",
                        color: "#A78BFA", borderRadius: 9999, padding: "2px 8px" }}>GiftEP利用可</span>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(255,255,255,0.06)",
                        color: "rgba(234,240,255,0.35)", borderRadius: 9999, padding: "2px 8px" }}>利用不可</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(234,240,255,0.5)", lineHeight: 1.6 }}>{f.desc}</p>
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
          fontSize: 11, color: "rgba(167,139,250,0.65)", lineHeight: 1.8 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>⚠ GiftEPの制限</p>
          <p>・マーケットでの購入・出品には使えません</p>
          <p>・ユーザー間取引に使えません</p>
          <p>・外部サービスへの移転はできません</p>
          <p>・換金・売買は永久BANの対象です</p>
        </div>

        <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}
