// components/NarasuBalanceCheckModal.tsx
// narasu代理申請の入口で「必要BP/EPが足りているか」を先に確認してもらうモーダル。
// 入力を最後までさせてから残高不足で止まる、という事態を防ぐのが目的。
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "@/app/lib/auth";
import { NARASU_BP_COST, NARASU_EP_COST } from "@/lib/narasu-agency/constants";

type LoadState = "loading" | "loaded" | "error";

export function NarasuBalanceCheckModal({ onConfirm }: { onConfirm: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [bp, setBp] = useState(0);
  const [ep, setEp] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const auth = getAuth();
        const id =
          (auth as any)?.id ||
          (auth as any)?.loginId ||
          (auth as any)?.login_id ||
          "";
        if (!id) {
          if (alive) setState("error");
          return;
        }
        const r = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, group: (auth as any)?.group || "" }),
        });
        const data: any = await r.json().catch(() => ({ ok: false }));
        if (!alive) return;
        if (!data.ok) {
          setState("error");
          return;
        }
        setBp(Number(data.bp || 0));
        setEp(Number(data.ep || 0));
        setState("loaded");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bpOk = state === "loaded" && bp >= NARASU_BP_COST;
  const epOk = state === "loaded" && ep >= NARASU_EP_COST;
  const canPay = bpOk || epOk;

  const rowCls =
    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="text-center">
          <div className="text-3xl">💰</div>
          <h2 className="mt-2 text-lg font-extrabold text-slate-900">
            最初にポイント残高をご確認ください
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            narasu代理申請は、申請内容の入力が終わったあとに
            <span className="font-bold">BPまたはEPでのお支払い</span>
            が必要です。
            <br />
            入力の前に、必要な数が足りているかご確認ください。
          </p>
        </div>

        <div className="mt-5 space-y-2">
          {/* BP */}
          <div
            className={`${rowCls} ${
              state === "loaded"
                ? bpOk
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div>
              <p className="text-sm font-extrabold text-slate-800">🔷 BP払い</p>
              <p className="text-xs text-slate-500">
                必要 {NARASU_BP_COST.toLocaleString()} BP
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400">現在の残高</p>
              <p className="text-sm font-extrabold text-slate-800">
                {state === "loading" ? "確認中…" : state === "error" ? "—" : `${bp.toLocaleString()} BP`}
              </p>
              {state === "loaded" && (
                <p className={`text-[10px] font-bold ${bpOk ? "text-emerald-600" : "text-rose-600"}`}>
                  {bpOk
                    ? "足りています"
                    : `あと ${(NARASU_BP_COST - bp).toLocaleString()} BP`}
                </p>
              )}
            </div>
          </div>

          {/* EP */}
          <div
            className={`${rowCls} ${
              state === "loaded"
                ? epOk
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div>
              <p className="text-sm font-extrabold text-slate-800">💎 EP払い</p>
              <p className="text-xs text-slate-500">
                必要 {NARASU_EP_COST.toLocaleString()} EP
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400">現在の残高</p>
              <p className="text-sm font-extrabold text-slate-800">
                {state === "loading" ? "確認中…" : state === "error" ? "—" : `${ep.toLocaleString()} EP`}
              </p>
              {state === "loaded" && (
                <p className={`text-[10px] font-bold ${epOk ? "text-emerald-600" : "text-rose-600"}`}>
                  {epOk
                    ? "足りています"
                    : `あと ${(NARASU_EP_COST - ep).toLocaleString()} EP`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 判定メッセージ */}
        {state === "loaded" && (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-xs leading-relaxed ${
              canPay
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {canPay
              ? "どちらかのお支払いが可能です。そのままお進みください。"
              : "現在の残高では、BP払い・EP払いのどちらもお支払いいただけません。先にBPを追加してから、あらためてお申し込みください。"}
          </div>
        )}
        {state === "error" && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
            残高を自動で確認できませんでした。お手数ですが、マイページで現在のBP・EPをご確認のうえお進みください。
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={state === "loading"}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            確認しました（申請へ進む）
          </button>
          <button
            onClick={() => router.push("/membership")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            足りなかった（BPを追加する）
          </button>
        </div>
      </div>
    </div>
  );
}
