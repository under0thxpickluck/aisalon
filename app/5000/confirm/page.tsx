"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/* ===== Storage（apply/page.tsx と同じキー） ===== */
const STORAGE_KEY_5000 = "addval_5000_draft_v1";

type Draft5000 = {
  email: string; name: string; nameKana: string;
  ageBand: string; prefecture: string; city: string; job: string;
  refName: string; refId: string; applyId: string; plan: string;
};

const EMPTY: Draft5000 = {
  email: "", name: "", nameKana: "",
  ageBand: "", prefecture: "", city: "", job: "",
  refName: "", refId: "", applyId: "", plan: "",
};

function loadDraft5000(): Draft5000 {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_5000);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

/* ===== ラベルマップ ===== */
const AGE_BAND_LABEL: Record<string, string> = {
  "10s": "10代", "20s": "20代", "30s": "30代",
  "40s": "40代", "50s": "50代", "60s": "60代〜",
};

const JOB_LABEL: Record<string, string> = {
  company_employee: "会社員", freelance: "フリーランス", self_employed: "自営業",
  management: "経営者", student: "学生", housework: "主婦・主夫",
  part_time: "アルバイト・パート", public_servant: "公務員", engineer: "エンジニア",
  creator: "クリエイター", sales: "営業", medical: "医療・福祉",
  education: "教育", other: "その他",
};

const PREF_LABEL: Record<string, string> = {
  hokkaido: "北海道", aomori: "青森県", iwate: "岩手県", miyagi: "宮城県",
  akita: "秋田県", yamagata: "山形県", fukushima: "福島県", ibaraki: "茨城県",
  tochigi: "栃木県", gunma: "群馬県", saitama: "埼玉県", chiba: "千葉県",
  tokyo: "東京都", kanagawa: "神奈川県", niigata: "新潟県", toyama: "富山県",
  ishikawa: "石川県", fukui: "福井県", yamanashi: "山梨県", nagano: "長野県",
  gifu: "岐阜県", shizuoka: "静岡県", aichi: "愛知県", mie: "三重県",
  shiga: "滋賀県", kyoto: "京都府", osaka: "大阪府", hyogo: "兵庫県",
  nara: "奈良県", wakayama: "和歌山県", tottori: "鳥取県", shimane: "島根県",
  okayama: "岡山県", hiroshima: "広島県", yamaguchi: "山口県", tokushima: "徳島県",
  kagawa: "香川県", ehime: "愛媛県", kochi: "高知県", fukuoka: "福岡県",
  saga: "佐賀県", nagasaki: "長崎県", kumamoto: "熊本県", oita: "大分県",
  miyazaki: "宮崎県", kagoshima: "鹿児島県", okinawa: "沖縄県",
};

function label(map: Record<string, string>, v?: string) {
  if (!v) return "—";
  return map[v] ?? v;
}

/* ===== UI ===== */
function Row({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 12,
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", flexShrink: 0, minWidth: 120 }}>
        {title}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", textAlign: "right", wordBreak: "break-all" }}>
        {value || "—"}
      </span>
    </div>
  );
}

/* ===== Page ===== */
export default function Confirm5000Page() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft5000>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const d = loadDraft5000();
    // 必須項目が未入力のまま直接アクセスされた場合は戻す
    if (!d.email || !d.name || !d.nameKana || !d.ageBand || !d.prefecture || !d.city || !d.job) {
      router.replace("/5000/apply");
      return;
    }
    setDraft(d);
    setMounted(true);
  }, [router]);

  async function handleSubmit() {
    setErr(null);
    setLoading(true);
    try {
      // Step 1: フォームデータを GAS apply_5000 に送信
      const res = await fetch("/api/5000/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();

      if (!data?.ok) {
        setErr("送信に失敗しました。もう一度お試しください。");
        return;
      }

      // Step 2: NOWPayments invoice 作成
      const applyId = draft.applyId;
      const payRes = await fetch("/api/5000/nowpayments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply_id: applyId, plan: draft.plan }),
      });
      const payData = await payRes.json();

      if (!payData?.ok || !payData?.invoice_url) {
        setErr("決済リンクの取得に失敗しました。サポートにお問い合わせください。");
        return;
      }

      // Step 3: invoice URL 確定後に draft クリア（失敗時にリトライ可能とするため）
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY_5000);
      }

      // Step 4: apply_id を sessionStorage に保存してリダイレクト
      if (typeof window !== "undefined") {
        sessionStorage.setItem("5000_apply_id", applyId);
      }
      window.location.href = payData.invoice_url;
    } catch {
      setErr("送信に失敗しました。通信状況をご確認ください。");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted && !done) {
    return <main style={{ minHeight: "100vh", background: "#0A0A0A" }} />;
  }

  /* ===== 送信完了画面 ===== */
  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "0 24px", maxWidth: 440 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
            background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, boxShadow: "0 0 40px rgba(108,99,255,0.4)",
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
            申請を受け付けました
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, margin: 0 }}>
            審査完了後、ご登録のメールアドレスにご連絡いたします。<br />
            今しばらくお待ちください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", position: "relative" }}>
      {/* 背景グロー */}
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0,
        background: [
          "radial-gradient(ellipse 700px 500px at 5% 0%, rgba(108,99,255,0.08) 0%, transparent 60%)",
          "radial-gradient(ellipse 600px 400px at 100% 20%, rgba(0,212,255,0.06) 0%, transparent 60%)",
        ].join(","),
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto", padding: "48px 20px 80px" }}>
        {/* 戻るリンク */}
        <button
          onClick={() => router.push("/5000/apply")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
            padding: 0, marginBottom: 32, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          ← 修正する
        </button>

        {/* ヘッダー */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{
            display: "inline-block", padding: "4px 14px", borderRadius: 999,
            border: "1px solid rgba(0,212,255,0.35)", color: "#00D4FF",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16,
          }}>
            CONFIRMATION
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
            申請内容の確認
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
            以下の内容で申請します。よろしければ「申請して決済へ進む」をタップしてください。
          </p>
        </div>

        {/* 確認テーブル */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: "0 20px", marginBottom: 20,
        }}>
          <Row title="プラン" value={draft.plan ? `$${draft.plan} プラン` : "—"} />
          <Row title="メールアドレス" value={draft.email} />
          <Row title="お名前" value={draft.name} />
          <Row title="お名前（カタカナ）" value={draft.nameKana} />
          <Row title="年齢帯" value={label(AGE_BAND_LABEL, draft.ageBand)} />
          <Row title="都道府県" value={label(PREF_LABEL, draft.prefecture)} />
          <Row title="市町村" value={draft.city} />
          <Row title="職業" value={label(JOB_LABEL, draft.job)} />
          {draft.refName && <Row title="紹介者名" value={draft.refName} />}
          {draft.refId && <Row title="紹介コード" value={draft.refId} />}
        </div>

        {/* エラー */}
        {err && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.3)",
            color: "#ff8080", fontSize: 13, fontWeight: 600,
          }}>
            {err}
          </div>
        )}

        {/* 申請ボタン */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 12, border: "none",
            background: loading ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #6C63FF, #00D4FF)",
            color: loading ? "rgba(255,255,255,0.25)" : "#fff",
            fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.03em",
            boxShadow: loading ? "none" : "0 0 30px rgba(108,99,255,0.3)",
            transition: "all 0.2s",
          }}
        >
          {loading ? "処理中…" : "申請して決済へ進む →"}
        </button>
      </div>
    </main>
  );
}
