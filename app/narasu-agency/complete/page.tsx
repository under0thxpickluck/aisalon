// app/narasu-agency/complete/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuth } from "@/app/lib/auth";

type PayState = "select" | "ep_processing" | "ep_done" | "ep_error";

export default function NarasuCompletePage() {
  const [payState, setPayState] = useState<PayState>("select");
  const [epError, setEpError] = useState("");
  const [loginId, setLoginId] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const id =
      (auth as any)?.loginId ??
      (auth as any)?.login_id ??
      (auth as any)?.id ??
      "";
    setLoginId(id);
  }, []);

  async function handleEpPay() {
    if (!loginId) {
      setEpError("ログイン情報が取得できませんでした。再ログインしてください。");
      setPayState("ep_error");
      return;
    }
    setPayState("ep_processing");
    setEpError("");
    try {
      const res = await fetch("/api/narasu-agency/pay-ep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      });
      const data = await res.json();
      if (!data.ok) {
        const msg =
          data.error === "insufficient_ep"
            ? `EPが不足しています（現在 ${data.ep_balance ?? 0} EP）`
            : (data.error ?? "支払いに失敗しました");
        setEpError(msg);
        setPayState("ep_error");
      } else {
        setPayState("ep_done");
      }
    } catch {
      setEpError("通信エラーが発生しました。再度お試しください。");
      setPayState("ep_error");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-extrabold text-slate-900">申請を受け付けました</h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            内容確認後、順次対応いたします。<br />
            続けて代行費用のお支払いをお選びください。
          </p>

          {/* EP支払い完了 */}
          {payState === "ep_done" && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-bold text-emerald-700">300EP の支払いが完了しました！</p>
              <p className="mt-1 text-xs text-emerald-600">代理申請の手続きを進めます。完了次第ご連絡いたします。</p>
            </div>
          )}

          {/* 支払い選択 */}
          {(payState === "select" || payState === "ep_error") && (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-bold text-slate-500">お支払い方法を選択してください</p>

              {/* クレジット */}
              <a
                href="https://lin.ee/VPo2xOn"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-left transition hover:bg-sky-100"
              >
                <p className="text-sm font-extrabold text-sky-800">💳 クレジットカード払い</p>
                <p className="mt-0.5 text-xs text-sky-600">1,280円（税込）— 公式LINEにてお支払い手続きをご案内します</p>
              </a>

              {/* EP */}
              <button
                onClick={handleEpPay}
                className="block w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-left transition hover:bg-violet-100"
              >
                <p className="text-sm font-extrabold text-violet-800">💎 EPポイント払い</p>
                <p className="mt-0.5 text-xs text-violet-600">300EP消費 — 即時完了</p>
              </button>

              {epError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs text-rose-700">{epError}</p>
                </div>
              )}
            </div>
          )}

          {/* 処理中 */}
          {payState === "ep_processing" && (
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4">
              <p className="text-sm text-violet-700">EP支払い処理中…</p>
            </div>
          )}

          <Link
            href="/top"
            className="mt-6 block text-xs text-slate-400 hover:text-slate-600"
          >
            ← トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
