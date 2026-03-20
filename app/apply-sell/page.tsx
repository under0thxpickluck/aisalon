"use client";
import { useState } from "react";

export default function ApplySellPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">💰 楽曲売却申請</h1>
      <p className="text-white/50 text-sm mb-8">
        生成した楽曲をLIFAI運営に売却申請できます。審査後にご連絡します。
      </p>

      {submitted ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
          <p className="text-green-400 font-bold text-lg mb-2">✅ 申請を受け付けました</p>
          <p className="text-white/60 text-sm">運営より3営業日以内にご連絡します。</p>
          <a href="/music2" className="block mt-6 text-white/40 text-sm">← 音楽生成に戻る</a>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">楽曲タイトル</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                placeholder="例：夜明けのメロディ"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">音楽ファイルURL（R2 URL）</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">希望売却価格（USDT）</label>
              <input
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                placeholder="例：50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">メモ・補足</label>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white h-24"
                placeholder="楽曲の特徴や使用イメージなど"
              />
            </div>
            <button
              onClick={() => setSubmitted(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm"
            >
              売却申請を送る
            </button>
          </div>
          <p className="text-white/30 text-xs text-center mt-4">
            ※申請後、運営が審査します。必ずしも購入するとは限りません。
          </p>
        </div>
      )}
    </div>
  );
}
