"use client";

import Link from "next/link";

export default function NarasuCompletePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-extrabold text-slate-900">受付完了</h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            代理申請の受付が完了しました。<br />
            内容確認後、順次対応いたします。
          </p>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              代行費用については、運営より別途LINEにてご連絡いたします。<br />
              お問い合わせは公式LINEまでお気軽にどうぞ。
            </p>
            <a
              href="https://lin.ee/VPo2xOn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-600"
            >
              公式LINEで問い合わせ
            </a>
          </div>
          <Link
            href="/top"
            className="mt-4 block text-xs text-slate-400 hover:text-slate-600"
          >
            ← トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
