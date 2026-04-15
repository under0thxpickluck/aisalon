"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/* ===== Storage ===== */
const STORAGE_KEY_5000 = "addval_5000_draft_v1";

type Draft5000 = {
  email: string;
  name: string;
  nameKana: string;
  ageBand: string;
  prefecture: string;
  city: string;
  job: string;
  refName: string;
  refId: string;
  applyId: string;
  plan: string;
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

function saveDraft5000(d: Draft5000) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY_5000, JSON.stringify(d));
}

/* ===== Data ===== */
const AGE_BANDS = [
  { value: "10s", label: "10代" }, { value: "20s", label: "20代" },
  { value: "30s", label: "30代" }, { value: "40s", label: "40代" },
  { value: "50s", label: "50代" }, { value: "60s", label: "60代〜" },
];

const JOBS = [
  { value: "company_employee", label: "会社員" },
  { value: "freelance", label: "フリーランス" },
  { value: "self_employed", label: "自営業" },
  { value: "management", label: "経営者" },
  { value: "student", label: "学生" },
  { value: "housework", label: "主婦・主夫" },
  { value: "part_time", label: "アルバイト・パート" },
  { value: "public_servant", label: "公務員" },
  { value: "engineer", label: "エンジニア" },
  { value: "creator", label: "クリエイター" },
  { value: "sales", label: "営業" },
  { value: "medical", label: "医療・福祉" },
  { value: "education", label: "教育" },
  { value: "other", label: "その他" },
];

const PREFS = [
  { value: "hokkaido", label: "北海道" }, { value: "aomori", label: "青森県" },
  { value: "iwate", label: "岩手県" }, { value: "miyagi", label: "宮城県" },
  { value: "akita", label: "秋田県" }, { value: "yamagata", label: "山形県" },
  { value: "fukushima", label: "福島県" }, { value: "ibaraki", label: "茨城県" },
  { value: "tochigi", label: "栃木県" }, { value: "gunma", label: "群馬県" },
  { value: "saitama", label: "埼玉県" }, { value: "chiba", label: "千葉県" },
  { value: "tokyo", label: "東京都" }, { value: "kanagawa", label: "神奈川県" },
  { value: "niigata", label: "新潟県" }, { value: "toyama", label: "富山県" },
  { value: "ishikawa", label: "石川県" }, { value: "fukui", label: "福井県" },
  { value: "yamanashi", label: "山梨県" }, { value: "nagano", label: "長野県" },
  { value: "gifu", label: "岐阜県" }, { value: "shizuoka", label: "静岡県" },
  { value: "aichi", label: "愛知県" }, { value: "mie", label: "三重県" },
  { value: "shiga", label: "滋賀県" }, { value: "kyoto", label: "京都府" },
  { value: "osaka", label: "大阪府" }, { value: "hyogo", label: "兵庫県" },
  { value: "nara", label: "奈良県" }, { value: "wakayama", label: "和歌山県" },
  { value: "tottori", label: "鳥取県" }, { value: "shimane", label: "島根県" },
  { value: "okayama", label: "岡山県" }, { value: "hiroshima", label: "広島県" },
  { value: "yamaguchi", label: "山口県" }, { value: "tokushima", label: "徳島県" },
  { value: "kagawa", label: "香川県" }, { value: "ehime", label: "愛媛県" },
  { value: "kochi", label: "高知県" }, { value: "fukuoka", label: "福岡県" },
  { value: "saga", label: "佐賀県" }, { value: "nagasaki", label: "長崎県" },
  { value: "kumamoto", label: "熊本県" }, { value: "oita", label: "大分県" },
  { value: "miyazaki", label: "宮崎県" }, { value: "kagoshima", label: "鹿児島県" },
  { value: "okinawa", label: "沖縄県" },
];

/* ===== Dark UI Components ===== */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "20px 20px 8px",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
        color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </section>
  );
}

function DarkField({
  label, required, value, onChange, placeholder, type = "text", error,
}: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  return (
    <div style={{ paddingBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{label}</span>
        {required && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: "rgba(0,212,255,0.12)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.3)",
          }}>必須</span>
        )}
      </div>
      <div style={{
        borderRadius: 10, border: hasError
          ? "1px solid rgba(255,100,100,0.6)"
          : focused ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.05)",
        padding: "12px 14px",
        boxShadow: focused && !hasError ? "0 0 0 3px rgba(0,212,255,0.08)" : "none",
        transition: "border 0.15s, box-shadow 0.15s",
      }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: "transparent", border: "none", outline: "none",
            fontSize: 15, fontWeight: 600, color: "#fff",
          }}
        />
      </div>
      {hasError && (
        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#ff6b6b" }}>{error}</div>
      )}
    </div>
  );
}

function DarkSelect({
  label, required, value, onChange, options, error,
}: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  return (
    <div style={{ paddingBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{label}</span>
        {required && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: "rgba(0,212,255,0.12)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.3)",
          }}>必須</span>
        )}
      </div>
      <div style={{
        borderRadius: 10, border: hasError
          ? "1px solid rgba(255,100,100,0.6)"
          : focused ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.05)",
        padding: "12px 14px",
        boxShadow: focused && !hasError ? "0 0 0 3px rgba(0,212,255,0.08)" : "none",
        transition: "border 0.15s, box-shadow 0.15s",
      }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: "transparent", border: "none", outline: "none",
            fontSize: 15, fontWeight: 600, color: value ? "#fff" : "rgba(255,255,255,0.35)",
            appearance: "none" as const,
          }}
        >
          <option value="" style={{ background: "#1a1f2e", color: "#fff" }}>選択してください</option>
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: "#1a1f2e", color: "#fff" }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {hasError && (
        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#ff6b6b" }}>{error}</div>
      )}
    </div>
  );
}

/* ===== Page ===== */
export default function Apply5000Page() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft5000>(EMPTY);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const d = loadDraft5000();
    // applyIdがなければ生成
    if (!d.applyId) {
      d.applyId = `5000_${Date.now()}`;
    }
    if (!d.plan) {
      d.plan = sessionStorage.getItem("5000_plan") || "5000";
    }
    // 紹介コードが未入力の場合、ランディングページで保存した値を補完
    if (!d.refId) {
      const storedRef = sessionStorage.getItem("5000_ref_code");
      if (storedRef) d.refId = storedRef;
    }
    saveDraft5000(d);
    setDraft(d);
  }, []);

  const set = (key: keyof Draft5000, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    saveDraft5000(next);
  };

  const errors = useMemo(() => ({
    email: !draft.email
      ? "必須です"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email)
      ? "メール形式が正しくありません"
      : "",
    name: !draft.name ? "必須です" : "",
    nameKana: !draft.nameKana ? "必須です" : "",
    ageBand: !draft.ageBand ? "必須です" : "",
    prefecture: !draft.prefecture ? "必須です" : "",
    city: !draft.city ? "必須です" : "",
    job: !draft.job ? "必須です" : "",
  }), [draft]);

  const canGoNext = !Object.values(errors).some(Boolean);

  function handleNext() {
    setTouched(true);
    if (canGoNext) router.push("/5000/confirm");
  }

  return (
    <>
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25) !important; }
      `}</style>
      <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", position: "relative" }}>
        {/* 背景グロー（/5000ページと統一） */}
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
            onClick={() => router.push("/5000")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
              padding: 0, marginBottom: 32, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            ← 戻る
          </button>

          {/* ヘッダー */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{
              display: "inline-block", padding: "4px 14px", borderRadius: 999,
              border: "1px solid rgba(0,212,255,0.35)", color: "#00D4FF",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16,
            }}>
              MEMBER APPLICATION
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0 }}>
              入会申請フォーム
            </h1>
            <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
              以下の項目をご入力の上、次へお進みください。
            </p>
          </div>

          {/* フォーム */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title="基本情報">
              <DarkField
                label="メールアドレス" required type="email"
                value={draft.email} onChange={v => set("email", v)}
                placeholder="your@email.com"
                error={touched ? errors.email : ""}
              />
              <DarkField
                label="お名前" required
                value={draft.name} onChange={v => set("name", v)}
                placeholder="山田 太郎"
                error={touched ? errors.name : ""}
              />
              <DarkField
                label="お名前（カタカナ）" required
                value={draft.nameKana} onChange={v => set("nameKana", v)}
                placeholder="ヤマダ タロウ"
                error={touched ? errors.nameKana : ""}
              />
            </Card>

            <Card title="プロフィール">
              <DarkSelect
                label="年齢帯" required
                value={draft.ageBand} onChange={v => set("ageBand", v)}
                options={AGE_BANDS}
                error={touched ? errors.ageBand : ""}
              />
              <DarkSelect
                label="都道府県" required
                value={draft.prefecture} onChange={v => set("prefecture", v)}
                options={PREFS}
                error={touched ? errors.prefecture : ""}
              />
              <DarkField
                label="市町村" required
                value={draft.city} onChange={v => set("city", v)}
                placeholder="例：渋谷区"
                error={touched ? errors.city : ""}
              />
              <DarkSelect
                label="職業" required
                value={draft.job} onChange={v => set("job", v)}
                options={JOBS}
                error={touched ? errors.job : ""}
              />
            </Card>

            <Card title="紹介情報（任意）">
              <DarkField
                label="紹介者名"
                value={draft.refName} onChange={v => set("refName", v)}
                placeholder="紹介者のお名前"
              />
              <DarkField
                label="紹介コード"
                value={draft.refId} onChange={v => set("refId", v)}
                placeholder="紹介コード"
              />
            </Card>

            {/* 次へボタン */}
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 12, border: "none",
                background: canGoNext
                  ? "linear-gradient(135deg, #6C63FF, #00D4FF)"
                  : "rgba(255,255,255,0.08)",
                color: canGoNext ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize: 16, fontWeight: 800, cursor: canGoNext ? "pointer" : "not-allowed",
                letterSpacing: "0.03em",
                boxShadow: canGoNext ? "0 0 30px rgba(108,99,255,0.3)" : "none",
                transition: "all 0.2s",
                marginTop: 4,
              }}
            >
              次へ確認する →
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
