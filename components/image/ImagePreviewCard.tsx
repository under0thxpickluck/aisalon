"use client";

import Image from "next/image";

type Props = {
  imageUrl: string | null;
  loading: boolean;
};

export default function ImagePreviewCard({ imageUrl, loading }: Props) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d1a2e]">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-[#7C5CFF] border-t-transparent animate-spin" />
          <p className="text-sm text-[#A8B3CF]">生成中…</p>
        </div>
      )}

      {!loading && !imageUrl && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="text-4xl opacity-30">🖼️</span>
          <p className="text-sm text-[#A8B3CF]/60">
            会話を進めて「生成する」を押すと<br />ここに画像が表示されます
          </p>
        </div>
      )}

      {!loading && imageUrl && (
        <Image
          src={imageUrl}
          alt="生成された画像"
          fill
          className="object-cover"
          unoptimized
        />
      )}
    </div>
  );
}
