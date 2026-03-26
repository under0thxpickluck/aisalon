"use client";
import { useState } from "react";

type ArticleData = {
  markdown: string;
  sections: { heading: string; body_markdown: string; is_paid: boolean }[];
  note_description: string;
  x_post: string;
  line_copy: string;
};

type Props = {
  step: "input" | "plan" | "article";
  planData: unknown;
  articleData: ArticleData | null;
};

export default function PreviewPanel({ step, articleData }: Props) {
  const [activeTab, setActiveTab] = useState<"preview" | "description" | "sns">("preview");
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (step === "input") {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        左のフォームからnote記事を生成してください
      </div>
    );
  }

  if (step === "plan") {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        タイトルを選択して本文を生成してください
      </div>
    );
  }

  if (!articleData) return null;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-1 border-b border-gray-200 pb-2">
        {(["preview", "description", "sns"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "preview" ? "本文プレビュー" : tab === "description" ? "説明文" : "SNS投稿"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "preview" && (
          <div className="prose prose-sm max-w-none">
            {articleData.sections.map((s, i) => (
              <div key={i} className={`mb-6 ${s.is_paid ? "relative" : ""}`}>
                {s.is_paid && i === articleData.sections.findIndex((sec) => sec.is_paid) && (
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 border-t border-dashed border-amber-400" />
                    <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">ここから有料</span>
                    <div className="flex-1 border-t border-dashed border-amber-400" />
                  </div>
                )}
                <h2 className="text-base font-bold text-gray-800 mb-2">{s.heading}</h2>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{s.body_markdown}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "description" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-semibold text-gray-600">note説明文（140字以内）</p>
                <button
                  onClick={() => copyText(articleData.note_description, "desc")}
                  className="text-xs text-purple-500 hover:text-purple-700"
                >
                  {copied === "desc" ? "コピー済み" : "コピー"}
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{articleData.note_description}</p>
              <p className="text-xs text-gray-400 mt-2 text-right">{articleData.note_description.length}字</p>
            </div>
          </div>
        )}

        {activeTab === "sns" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-semibold text-gray-600">X（Twitter）投稿文</p>
                <button
                  onClick={() => copyText(articleData.x_post, "x")}
                  className="text-xs text-purple-500 hover:text-purple-700"
                >
                  {copied === "x" ? "コピー済み" : "コピー"}
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{articleData.x_post}</p>
              <p className="text-xs text-gray-400 mt-2 text-right">{articleData.x_post.length}字</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-semibold text-gray-600">LINE告知文</p>
                <button
                  onClick={() => copyText(articleData.line_copy, "line")}
                  className="text-xs text-purple-500 hover:text-purple-700"
                >
                  {copied === "line" ? "コピー済み" : "コピー"}
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{articleData.line_copy}</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => copyText(articleData.markdown, "md")}
        className="w-full py-2.5 rounded-xl border border-purple-300 text-purple-600 font-semibold text-sm hover:bg-purple-50 transition-all"
      >
        {copied === "md" ? "コピー済み！" : "Markdownをコピー"}
      </button>
    </div>
  );
}
