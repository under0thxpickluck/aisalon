"use client";
import { useState } from "react";
import Link from "next/link";
import InputPanel from "./components/InputPanel";
import PreviewPanel from "./components/PreviewPanel";

type PlanData = {
  plan_id: string;
  data: {
    recommended_angle: string;
    sellability_score: number;
    suggested_price_yen: number;
    target_persona: string;
    title_candidates: string[];
    outline: { heading: string; purpose: string; target_length: number }[];
  };
};

type ArticleData = {
  markdown: string;
  sections: { heading: string; body_markdown: string; is_paid: boolean }[];
  note_description: string;
  x_post: string;
  line_copy: string;
};

export default function NoteGeneratorPage() {
  const [step, setStep] = useState<"input" | "plan" | "article">("input");
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGeneratePlan(formValues: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/note/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      const json = await res.json();
      if (json.ok) {
        setPlanData(json);
        setStep("plan");
      } else {
        setError(json.error || "企画生成に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateArticle(
    planId: string,
    selectedTitle: string,
    outline: { heading: string; purpose: string; target_length: number }[]
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/note/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          selected_title: selectedTitle,
          outline,
          tone: "note売れ筋風",
          length: 8000,
          paywall_mode: "intro_free_main_paid",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setArticleData(json.data);
        setStep("article");
      } else {
        setError(json.error || "本文生成に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/top" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
            ← LIFAIに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">note記事ジェネレーター</h1>
          <p className="text-sm text-gray-500 mt-1">テーマを入力するだけで、売れるnote記事を自動生成します</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-180px)]">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${step === "input" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                {step === "input" ? "STEP 1" : step === "plan" ? "STEP 2" : "完了"}
              </span>
              <span className="text-sm font-semibold text-gray-700">
                {step === "input" ? "記事の設定" : step === "plan" ? "企画・タイトル選択" : "生成完了"}
              </span>
              {step !== "input" && (
                <button
                  onClick={() => { setStep("input"); setPlanData(null); setArticleData(null); }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  最初からやり直す
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <InputPanel
                step={step}
                planData={planData}
                loading={loading}
                onGeneratePlan={handleGeneratePlan}
                onGenerateArticle={handleGenerateArticle}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-hidden flex flex-col">
            <p className="text-sm font-semibold text-gray-700 mb-4">プレビュー</p>
            <div className="flex-1 overflow-hidden flex flex-col">
              <PreviewPanel
                step={step}
                planData={planData}
                articleData={articleData}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
