// app/narasu-agency/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NARASU_GATE_PASSWORD } from "@/lib/narasu-agency/constants";
import { setGatePassed } from "@/lib/narasu-agency/storage";

export default function NarasuGatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === NARASU_GATE_PASSWORD) {
      setGatePassed();
      router.push("/narasu-agency/terms");
    } else {
      setError("パスワードが違います");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">代理申請フォーム（テスト公開）</h1>
          <p className="mt-2 text-sm text-slate-600">現在は限定公開中です。パスワードを入力してください。</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="パスワードを入力"
                autoComplete="off"
              />
              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              確認する
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
