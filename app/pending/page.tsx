"use client";

import Link from "next/link";
import Image from "next/image";

export default function PendingPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 overflow-hidden">

      {/* 🐱 下にうっすら悩み猫 */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-[0.08]">
        <div className="relative h-[460px] w-[460px] translate-y-[80px]">
          <Image
            src="/arere.png"
            alt="confused cat"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[520px] px-4 py-16">

        <div className="rounded-[28px] border border-slate-200 bg-white p-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)]">

          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight">
              申請確認中です
            </div>

            <div className="mt-4 text-sm text-slate-500 leading-relaxed">
              現在、内容を確認しております。<br />
              通常 24時間以内 に承認されますので、<br />
              少々お待ちください。
            </div>
          </div>

          <div className="mt-10 grid gap-3">
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:opacity-95 active:scale-[0.99]"
            >
              ログイン画面へ
            </Link>

            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              トップへ戻る
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400">
          © LIFAI
        </div>
      </div>
    </main>
  );
}
