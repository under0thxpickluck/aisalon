"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import { LoadingCat } from "@/components/LoadingCat";
import { useTheme } from "@/app/lib/useTheme";

type TxRecord = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: string;
  expiry_date: string;
  status: string;
  note: string;
};

type Tab = "received" | "sent" | "expired";

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

export default function GiftHistoryPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const C = isDark ? C_DARK : C_LIGHT;
  const [tab, setTab] = useState<Tab>("received");
  const [sent, setSent] = useState<TxRecord[]>([]);
  const [received, setReceived] = useState<TxRecord[]>([]);
  const [expired, setExpired] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";

    fetch("/api/gift/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, code }),
      cache: "no-store",
    })
      .then(r => r.json())
      .catch(() => ({ ok: false }))
      .then((data: any) => {
        if (data.ok) {
          setSent(data.sent || []);
          setReceived(data.received || []);
          setExpired(data.expired || []);
        } else {
          setError(data.error || "取得に失敗しました");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const tabs: { key: Tab; label: string; data: TxRecord[] }[] = [
    { key: "received", label: "受け取った", data: received },
    { key: "sent",     label: "贈った",     data: sent },
    { key: "expired",  label: "失効",       data: expired },
  ];

  const current = tabs.find(t => t.key === tab)!;
  const statusColor = (s: string) => s === "expired" ? C.textDim : C.accent;

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
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>📋 GiftEP履歴</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, borderRadius: 12, border: "1px solid",
                borderColor: tab === t.key ? "rgba(167,139,250,0.5)" : C.border,
                background: tab === t.key ? "rgba(124,58,237,0.15)" : C.bg,
                padding: "8px", fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? C.accent : C.textMuted, cursor: "pointer" }}>
              {t.label}
              <span style={{ marginLeft: 4, fontSize: 10 }}>({t.data.length})</span>
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}><LoadingCat fullscreen={false} /></div>}
        {error && <p style={{ fontSize: 13, color: C.error }}>{error}</p>}

        {!loading && current.data.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontSize: 13, color: C.textDim }}>
              {tab === "received" ? "受け取ったGiftEPはありません" :
               tab === "sent" ? "贈ったGiftEPはありません" : "失効したGiftEPはありません"}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {current.data.map(tx => (
            <div key={tx.id} className="bg-white dark:bg-[#0F1A2E] border border-slate-200 dark:border-white/[0.07]" style={{
              borderRadius: 20, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                    {tab === "sent" ? `→ ${tx.to_user}` : `← ${tx.from_user}`}
                  </p>
                  {tx.note && <p style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>"{tx.note}"</p>}
                  <p style={{ fontSize: 10, color: C.textDim }}>
                    {new Date(tx.created_at).toLocaleString("ja-JP")}
                    {" "}·{" "}
                    {tx.status === "expired" ? "失効済" : `有効期限: ${tx.expiry_date}`}
                  </p>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: statusColor(tx.status), flexShrink: 0 }}>
                  {tx.amount.toLocaleString()}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>GiftEP</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: C.textGhost }}>© LIFAI</div>
      </div>
    </main>
  );
}
