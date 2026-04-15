"use client";

import type { ImagePreviewCost } from "@/app/lib/image/image_types";

type Props = {
  cost: ImagePreviewCost | null;
  balance: number;
};

export default function ImageCostBox({ cost, balance }: Props) {
  if (!cost) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d1a2e] p-4 text-sm text-[#A8B3CF]">
        会話を進めると消費BPが表示されます
      </div>
    );
  }

  const sufficient = balance >= cost.totalBp;
  const { breakdown } = cost;

  return (
    <div className={`rounded-2xl border p-4 text-sm ${sufficient ? "border-[#3AA0FF]/30 bg-[#0d1a2e]" : "border-[#FF6B6B]/40 bg-[#1a0d0d]"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#A8B3CF] mb-3">消費予定BP</p>
      <p className={`text-2xl font-extrabold mb-3 ${sufficient ? "text-[#3AA0FF]" : "text-[#FF6B6B]"}`}>
        {cost.totalBp} BP
      </p>

      <div className="space-y-1 text-xs text-[#A8B3CF]">
        <div className="flex justify-between"><span>基本料金</span><span>{breakdown.base} BP</span></div>
        {breakdown.turn > 0 && <div className="flex justify-between"><span>会話量</span><span>{breakdown.turn} BP</span></div>}
        {breakdown.text > 0 && <div className="flex justify-between"><span>文字量</span><span>{breakdown.text} BP</span></div>}
        {breakdown.style > 0 && <div className="flex justify-between"><span>スタイル</span><span>+{breakdown.style} BP</span></div>}
        {breakdown.hq > 0 && <div className="flex justify-between"><span>高品質</span><span>+{breakdown.hq} BP</span></div>}
        {breakdown.edit > 0 && <div className="flex justify-between"><span>編集補正</span><span>+{breakdown.edit} BP</span></div>}
      </div>

      <div className="mt-3 border-t border-white/10 pt-3 flex justify-between text-xs">
        <span className="text-[#A8B3CF]">現在残高</span>
        <span className={`font-bold ${sufficient ? "text-[#EAF0FF]" : "text-[#FF6B6B]"}`}>{balance} BP</span>
      </div>

      {!sufficient && (
        <p className="mt-2 text-xs font-semibold text-[#FF6B6B]">BPが不足しています</p>
      )}

      <div className="mt-3 space-y-0.5 text-xs text-[#A8B3CF]/50">
        <p>生成失敗時はBP返却</p>
        <p>生成前に最終確認されます</p>
      </div>
    </div>
  );
}
