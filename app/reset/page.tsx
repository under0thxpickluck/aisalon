"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPage() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setMsg(null);

    if (!pw || pw.length < 6) {
      setErr("パスワードは6文字以上");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "reset_failed");
      }

      setMsg("パスワード設定完了！ログインしてください。");
    } catch (e: any) {
      setErr(String(e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 bg-white shadow">

        <h1 className="text-xl font-bold mb-4">
          初回パスワード設定
        </h1>

        <p className="text-sm text-gray-600 mb-4">
          新しいパスワードを入力してください。
        </p>

        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="新しいパスワード"
          className="w-full border rounded p-2 mb-3"
        />

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-indigo-600 text-white rounded p-2 font-bold"
        >
          {loading ? "設定中..." : "パスワード設定"}
        </button>

        {msg && <p className="mt-3 text-green-600 text-sm">{msg}</p>}
        {err && <p className="mt-3 text-red-600 text-sm">{err}</p>}
      </div>
    </main>
  );
}