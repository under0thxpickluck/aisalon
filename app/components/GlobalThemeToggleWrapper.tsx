"use client";
import { useTheme } from "@/app/lib/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export function GlobalThemeToggleWrapper() {
  const { isDark, toggleTheme } = useTheme();
  return <ThemeToggle isDark={isDark} onToggle={toggleTheme} />;
}
