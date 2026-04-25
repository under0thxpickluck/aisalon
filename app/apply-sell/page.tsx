"use client";
import { useEffect, useState } from "react";
import { getAuth } from "@/app/lib/auth";

export default function ApplySellPage() {
  const [loginId,   setLoginId]   = useState("");
  const [title,     setTitle]     = useState("");
  const [musicUrl,  setMusicUrl]  = useState("");
  const [priceUsd,  setPriceUsd]  = useState("20");
  const [memo,      setMemo]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    const auth = getAuth();
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      "";
    setLoginId(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId) { setError("ログインが必要です"); return; }
    if (!title.trim()) { setError("楽曲タイトルを入力してください"); return; }
    if (!musicUrl.trim()) { setError("音楽ファイルURLを入力してください"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/apply-sell/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, title, musicUrl, priceUsd, memo }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setError(data.error || "送信に失敗しました。もう一度お試しください。");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">💰 楽曲売却申請</h1>
      <p className="text-white/50 text-sm mb-8">
        生成した楽曲をLIFAI運営に売却申請できます。審査後にご連絡します。
      </p>

      {submitted ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
          <p className="text-green-400 font-bold text-lg mb-2">✅ 申請を受け付けました</p>
          <p className="text-white/60 text-sm">
            ご利用ありがとうございます。24時間〜48時間以内に売却申請の可否の返答が行われます。今しばらくお待ちください。
          </p>
          <a href="/music2" className="block mt-6 text-white/40 text-sm">← 音楽生成に戻る</a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">楽曲タイトル <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-purple-500 focus:outline-none"
                placeholder="例：夜明けのメロディ"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">音楽ファイルURL <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={musicUrl}
                onChange={e => setMusicUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-purple-500 focus:outline-none"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">希望売却価格（EP）</label>
              <div className="mb-1 text-xs text-amber-400">現在の相場：20 EP</div>
              <input
                type="number"
                value={priceUsd}
                onChange={e => setPriceUsd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-purple-500 focus:outline-none"
                placeholder="例：20"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">メモ・補足</label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-purple-500 focus:outline-none h-24"
                placeholder="楽曲の特徴や使用イメージなど"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm disabled:opacity-50"
            >
              {submitting ? "送信中…" : "売却申請を送る"}
            </button>
          </div>
          <p className="text-white/30 text-xs text-center mt-4">
            ※申請後、運営が審査します。必ずしも購入するとは限りません。
          </p>
        </form>
      )}
    </div>
  );
}
