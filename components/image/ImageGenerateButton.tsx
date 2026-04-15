"use client";

type Props = {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  bpCost: number;
  label?: string;
};

export default function ImageGenerateButton({ onClick, loading, disabled, bpCost, label = "この内容で生成する" }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full rounded-2xl py-3.5 text-sm font-extrabold transition active:scale-95 ${
        disabled || loading
          ? "bg-[#1a2a4a] text-[#A8B3CF]/50 cursor-not-allowed"
          : "bg-gradient-to-br from-[#7C5CFF] to-[#3AA0FF] text-white shadow-[0_0_24px_rgba(124,92,255,.35)] hover:opacity-90"
      }`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          生成中…
        </span>
      ) : (
        <span>
          {label}
          {bpCost > 0 && <span className="ml-2 opacity-70 text-xs">({bpCost} BP)</span>}
        </span>
      )}
    </button>
  );
}
