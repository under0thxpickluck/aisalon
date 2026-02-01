"use client";

import { toast } from "./useToast";

export function CopyField({ label, value }: { label: string; value: string }) {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      toast("コピーしました");
    } catch {
      toast("コピーに失敗しました（権限/HTTPSを確認）");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{label}</div>

        <button
          type="button"
          onClick={onCopy}
          className="relative z-10 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-xs font-extrabold text-white hover:opacity-95 active:scale-[0.99]"
        >
          コピー
        </button>
      </div>

      <div className="mt-3 select-all break-all rounded-xl bg-black/25 px-3 py-2 text-xs text-slate-100">
        {value}
      </div>
    </div>
  );
}
