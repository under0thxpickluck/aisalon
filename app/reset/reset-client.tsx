"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => sp.get("token") ?? "", [sp]);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async () => {
    setMsg(null);
    if (!token) return setMsg("token がありません（メールURLを確認）");
    if (!pw || pw.length < 8) return setMsg("パスワードは8文字以上にしてね");
    if (pw !== pw2) return setMsg("確認用パスワードが一致しません");

    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error ?? "reset failed");

      setMsg("設定完了！ログイン画面へ移動します…");
      setTimeout(() => router.push("/login"), 800);
    } catch (e: any) {
      setMsg(e?.message ?? "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white/80 p-6 shadow">
        <h1 className="text-xl font-bold">初回パスワード設定</h1>
        <p className="text-sm text-gray-600 mt-1">
          メールのリンクから開いた場合のみ設定できます。
        </p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="新しいパスワード（8文字以上）"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <input
            className="w-full rounded-xl border p-3"
            placeholder="確認用パスワード"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />

          <button
            className="w-full rounded-xl bg-black text-white p-3 disabled:opacity-50"
            disabled={loading}
            onClick={onSubmit}
          >
            {loading ? "送信中..." : "設定する"}
          </button>

          {msg && <div className="text-sm text-red-600">{msg}</div>}
        </div>
      </div>
    </div>
  );
}