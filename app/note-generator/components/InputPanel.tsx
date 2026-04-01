"use client";
import { useState } from "react";

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

type Props = {
  step: "input" | "plan" | "article";
  planData: PlanData | null;
  loading: boolean;
  onGeneratePlan: (values: Record<string, unknown>) => void;
  onGenerateArticle: (planId: string, selectedTitle: string, outline: { heading: string; purpose: string; target_length: number }[]) => void;
};

const FORMAT_OPTIONS = ["ハウツー記事", "体験談・実録", "まとめ・比較", "インタビュー風", "事例紹介"];
const TONE_OPTIONS = ["丁寧・親しみやすい", "カジュアル・フレンドリー", "専門的・解説調", "note売れ筋風"];
const EXPERTISE_OPTIONS = ["初心者向け", "中級者向け", "上級者向け"];
const PAYWALL_OPTIONS = [
  { value: "intro_free_main_paid", label: "導入無料・本文有料" },
  { value: "half_free", label: "前半無料・後半有料" },
  { value: "all_free", label: "全文無料" },
];

export default function InputPanel({ step, planData, loading, onGeneratePlan, onGenerateArticle }: Props) {
  const [form, setForm] = useState({
    theme: "",
    format: FORMAT_OPTIONS[0],
    persona: "",
    tone: TONE_OPTIONS[0],
    length: 6000,
    expertise: EXPERTISE_OPTIONS[0],
    paywall_mode: "intro_free_main_paid",
    extra_keywords: "",
  });
  const [selectedTitle, setSelectedTitle] = useState("");

  function update(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmitPlan(e: React.FormEvent) {
    e.preventDefault();
    const keywords = form.extra_keywords
      ? form.extra_keywords.split(/[,、\s]+/).filter(Boolean)
      : [];
    onGeneratePlan({ ...form, extra_keywords: keywords });
  }

  function handleSubmitArticle() {
    if (!planData || !selectedTitle) return;
    onGenerateArticle(planData.plan_id, selectedTitle, planData.data.outline);
  }

  if (step === "plan" && planData) {
    const d = planData.data;
    return (
      <div className="flex flex-col gap-4 overflow-y-auto">
        <div className="rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-4">
          <p className="text-xs text-purple-600 font-semibold mb-1">おすすめの切り口</p>
          <p className="text-sm text-gray-800">{d.recommended_angle}</p>
        </div>

        <div className="flex gap-3 text-center">
          <div className="flex-1 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">売れやすさスコア</p>
            <p className="text-2xl font-bold text-purple-600">{d.sellability_score}<span className="text-sm text-gray-400">/10</span></p>
          </div>
          <div className="flex-1 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">提案価格</p>
            <p className="text-2xl font-bold text-green-600">¥{d.suggested_price_yen.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">対象ペルソナ</p>
          <p className="text-sm text-gray-700">{d.target_persona}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 font-semibold mb-3">タイトル候補（1つ選んでください）</p>
          <div className="flex flex-col gap-2">
            {d.title_candidates.map((t, i) => (
              <button
                key={i}
                onClick={() => setSelectedTitle(t)}
                className={`text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                  selectedTitle === t
                    ? "border-purple-500 bg-purple-50 text-purple-800 font-semibold"
                    : "border-gray-200 hover:border-purple-300 text-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">見出し構成</p>
          <ol className="flex flex-col gap-2">
            {d.outline.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-purple-500 font-bold min-w-[20px]">{i + 1}.</span>
                <div>
                  <p className="font-semibold text-gray-800">{o.heading}</p>
                  <p className="text-xs text-gray-500">{o.purpose}（約{o.target_length}字）</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={handleSubmitArticle}
          disabled={loading || !selectedTitle}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm disabled:opacity-40"
        >
          {loading ? "生成中…" : "本文を生成する"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitPlan} className="flex flex-col gap-4 overflow-y-auto">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">テーマ <span className="text-red-400">*</span></label>
        <input
          value={form.theme}
          onChange={(e) => update("theme", e.target.value)}
          placeholder="例: 副業で月5万稼ぐ方法"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">コンテンツ形式</label>
        <select value={form.format} onChange={(e) => update("format", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
          {FORMAT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">対象読者 <span className="text-red-400">*</span></label>
        <input
          value={form.persona}
          onChange={(e) => update("persona", e.target.value)}
          placeholder="例: 副業を始めたい会社員"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          required
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600 block mb-1">文章スタイル</label>
          <select value={form.tone} onChange={(e) => update("tone", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
            {TONE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600 block mb-1">専門性</label>
          <select value={form.expertise} onChange={(e) => update("expertise", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
            {EXPERTISE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">想定文字数: {form.length.toLocaleString()}字</label>
        <input
          type="range"
          min={2000}
          max={12000}
          step={1000}
          value={form.length}
          onChange={(e) => update("length", Number(e.target.value))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>2,000字</span><span>12,000字</span>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">有料化モード</label>
        <div className="flex flex-col gap-2">
          {PAYWALL_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="paywall_mode"
                value={o.value}
                checked={form.paywall_mode === o.value}
                onChange={() => update("paywall_mode", o.value)}
                className="accent-purple-500"
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">入れたいキーワード（任意・カンマ区切り）</label>
        <input
          value={form.extra_keywords}
          onChange={(e) => update("extra_keywords", e.target.value)}
          placeholder="例: ChatGPT, 時短, 初心者"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm disabled:opacity-40"
      >
        {loading ? "企画生成中…" : "企画を生成する（150BP）"}
      </button>
    </form>
  );
}
