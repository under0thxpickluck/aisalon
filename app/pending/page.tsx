"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../lib/auth";

export default function PendingPage() {
  const router = useRouter();

  useEffect(() => {
    const a = getAuth();

    if (!a) {
      router.replace("/login");
      return;
    }

    if (a.status === "approved") {
      router.replace("/top");
      return;
    }

    // pending はここに留まる
  }, [router]);

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-[#070A12] dark:to-[#0b1022] text-slate-900 dark:text-white overflow-hidden">
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
        <div className="rounded-[28px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)]">
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight">
              申請確認中です
            </div>

            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
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
              className="flex w-full items-center justify-center rounded-2xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
              トップへ戻る
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">© LIFAI</div>
      </div>
    </main>
  );
}