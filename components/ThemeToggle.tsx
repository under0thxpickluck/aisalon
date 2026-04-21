"use client";

type Props = { isDark: boolean; onToggle: () => void };

export function ThemeToggle({ isDark, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      className={`fixed top-4 right-4 z-30 w-9 h-9 rounded-full flex items-center justify-center text-base transition shadow-md ${
        isDark
          ? "bg-white/10 hover:bg-white/20 text-white"
          : "bg-white border border-gray-200 hover:bg-gray-100 text-gray-700"
      }`}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
