"use client";

import Image from "next/image";
import { useState } from "react";
import type { ImageHistoryItem } from "@/app/lib/image/image_types";

type Props = {
  items: ImageHistoryItem[];
};

const TYPE_LABEL: Record<string, string> = {
  generate: "生成",
  edit: "編集",
  jacket: "ジャケット",
};

export default function ImageHistoryGrid({ items }: Props) {
  const [selected, setSelected] = useState<ImageHistoryItem | null>(null);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#A8B3CF]/60">
        まだ生成履歴がありません
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-[#0d1a2e] focus:outline-none"
          >
            <Image
              src={item.image_url}
              alt={item.prompt}
              fill
              className="object-cover transition group-hover:scale-105"
              unoptimized
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition">
              <p className="truncate text-[10px] text-white">{item.prompt}</p>
            </div>
          </button>
        ))}
      </div>

      {/* モーダル */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setSelected(null)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 max-w-sm mx-auto -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0d1a2e] p-4 shadow-2xl">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl">
              <Image
                src={selected.image_url}
                alt={selected.prompt}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-[#A8B3CF]">
              <div className="flex justify-between">
                <span>種別</span>
                <span className="font-semibold text-[#EAF0FF]">{TYPE_LABEL[selected.type] ?? selected.type}</span>
              </div>
              <div className="flex justify-between">
                <span>消費BP</span>
                <span className="font-semibold text-[#EAF0FF]">{selected.bp_used} BP</span>
              </div>
              <div className="flex justify-between">
                <span>日時</span>
                <span className="font-semibold text-[#EAF0FF]">{new Date(selected.created_at).toLocaleString("ja-JP")}</span>
              </div>
              <p className="mt-2 leading-relaxed text-[#A8B3CF]/80">{selected.prompt}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full rounded-xl border border-white/10 py-2 text-sm text-[#A8B3CF] hover:bg-white/5"
            >
              閉じる
            </button>
          </div>
        </>
      )}
    </>
  );
}
