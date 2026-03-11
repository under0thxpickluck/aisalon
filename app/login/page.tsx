// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { setAuth, setAuthSecret } from "@/app/lib/auth"; // ✅ ここだけ追加

export default function LoginPage() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    setLoading(true);
    try {
      const trimmedId = id.trim();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmedId, code: pw }),
      }).then((r) => r.json()).catch(() => null);

      if (!res) {
        setErr("サーバーエラーが発生しました。しばらく待ってから再度お試しください。");
        return;
      }

      if (res.ok) {
        // ✅ ログイン状態を保存（localStorage）
        setAuth({
          status: "approved",
          id: trimmedId,
          token: res.token ?? pw, // ✅ ここだけ修正：tokenが無い場合はpwを入れる（壊さない保険）
        });

        // ✅ 追加：パスワード(code)は sessionStorage にだけ保存（ブラウザを閉じると消える）
        // /api/me など「本人専用情報」を引く時に使う
        setAuthSecret(pw);

        router.push("/top");
        return;
      }

      if (res.reason === "pending") {
        // ✅ pendingも保存（/pendingガードに使える）
        // ※ pending では secret を保存しない（まだ承認前）
        setAuth({ status: "pending", id: trimmedId });
        router.push("/pending");
        return;
      }

      setErr("IDまたはワンタイムコードが違います。");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !id.trim() || !pw;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* 🐱 背景に大きく猫ロゴ（薄く） */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-[0.14]">
        <div className="relative h-[520px] w-[520px] translate-y-[90px]">
          <Image
            src="/lifai.png"
            alt="LIFAI cat"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[480px] px-4 py-12">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← トップへ戻る
        </Link>

        <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          {/* タイトル */}
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight">
              LIFAI ログイン
            </div>
            <div className="mt-2 text-sm text-slate-500">
              発行されたIDとパスワードを入力してください
            </div>
          </div>

          {/* 入力フォーム */}
          <div className="mt-8 grid gap-4">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ログインID"
              autoComplete="username"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />

            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="パスワード"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) onSubmit();
              }}
            />

            {err && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {err}
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={disabled}
              className={[
                "mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                disabled
                  ? "bg-slate-200 text-slate-400"
                  : "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:opacity-95 active:scale-[0.99]",
              ].join(" ")}
            >
              {loading ? "確認中..." : "ログイン"}
            </button>

            <div className="text-center text-xs text-slate-400">
              不明な場合は代理店様へお問い合わせください。
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}