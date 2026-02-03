"use client";

import { useEffect, useState } from "react";

const KEY = "lifai_invest_gate_ok_v1";

// ✅ ここを好きなパスワードに
const INVEST_PASSWORD = "lifai2026";

export default function InvestGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "1") setOk(true);
    } catch {}
  }, []);

  function login() {
    if (input === INVEST_PASSWORD) {
      setOk(true);
      setError(false);
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
    } else {
      setError(true);
    }
  }

  function logout() {
    setOk(false);
    setInput("");
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  // SSR/CSR差分ガード
  if (!mounted) return null;

  if (!ok) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="text-xs font-bold text-neutral-500">LIFAI</div>
            <h1 className="mt-2 text-xl font-extrabold text-neutral-900">
              🔒 出資者様専用ページ
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              パスワードを入力してください
            </p>
          </div>

          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="パスワード"
            className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
          />

          {error ? (
            <p className="mt-2 text-sm text-rose-600">パスワードが違います</p>
          ) : null}

          <button
            type="button"
            onClick={login}
            className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 transition"
          >
            入室
          </button>

          <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
            ※このロックは「簡易」方式です（同端末のローカルストレージに保持）。
          </p>
        </div>
      </main>
    );
  }

  // ✅ ログイン後表示
  return (
    <>
      <div className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <div className="text-xs font-semibold text-neutral-700">
            🔓 出資者様専用（閲覧中）
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            ログアウト
          </button>
        </div>
      </div>

      {children}
    </>
  );
}
