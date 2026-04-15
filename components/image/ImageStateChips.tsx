"use client";

import type { ImageChatState } from "@/app/lib/image/image_types";

const FIELDS: { key: keyof ImageChatState; label: string }[] = [
  { key: "character", label: "キャラクター" },
  { key: "hair", label: "髪型" },
  { key: "outfit", label: "服装" },
  { key: "emotion", label: "表情" },
  { key: "scene", label: "背景" },
  { key: "style", label: "画風" },
];

export default function ImageStateChips({ state }: { state: Partial<ImageChatState> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FIELDS.map(({ key, label }) => {
        const val = state[key] as string | undefined;
        return val ? (
          <span
            key={key}
            className="rounded-full bg-gradient-to-r from-[#7C5CFF]/40 to-[#3AA0FF]/40 border border-[#7C5CFF]/50 px-3 py-1 text-xs font-medium text-[#EAF0FF]"
          >
            {val}
          </span>
        ) : (
          <span
            key={key}
            className="rounded-full border border-dashed border-white/20 px-3 py-1 text-xs text-[#A8B3CF]/50"
          >
            {label}: 未設定
          </span>
        );
      })}
    </div>
  );
}
