"use client";

import Image from "next/image";
import { useState } from "react";
import ImageGenerateButton from "./ImageGenerateButton";

type Props = {
  originalUrl: string;
  onEdit: (instruction: string) => Promise<void>;
  loading: boolean;
  resultUrl: string | null;
};

export default function ImageEditPanel({ originalUrl, onEdit, loading, resultUrl }: Props) {
  const [instruction, setInstruction] = useState("");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* 元画像 */}
        <div>
          <p className="mb-1.5 text-xs text-[#A8B3CF]">元の画像</p>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10">
            <Image src={originalUrl} alt="元画像" fill className="object-cover" unoptimized />
          </div>
        </div>

        {/* 結果 */}
        <div>
          <p className="mb-1.5 text-xs text-[#A8B3CF]">編集後</p>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1a2e]">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 rounded-full border-4 border-[#7C5CFF] border-t-transparent animate-spin" />
              </div>
            )}
            {!loading && resultUrl && (
              <Image src={resultUrl} alt="編集後" fill className="object-cover" unoptimized />
            )}
            {!loading && !resultUrl && (
              <div className="flex h-full items-center justify-center">
                <span className="text-2xl opacity-20">✏️</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 編集指示 */}
      <div>
        <p className="mb-1.5 text-xs text-[#A8B3CF]">編集の指示を入力 (+30BP)</p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="例: 髪を赤くして、背景を夕焼けにしてください"
          rows={3}
          className="w-full resize-none rounded-xl bg-[#0d1a2e] border border-white/10 px-3 py-2 text-sm text-[#EAF0FF] placeholder-[#A8B3CF]/40 outline-none focus:ring-1 focus:ring-[#7C5CFF]"
        />
      </div>

      <ImageGenerateButton
        onClick={() => onEdit(instruction)}
        loading={loading}
        disabled={!instruction.trim()}
        bpCost={30}
        label="編集を適用する"
      />
    </div>
  );
}
