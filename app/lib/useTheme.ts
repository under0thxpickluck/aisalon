"use client";
import { useState } from "react";

const THEME_KEY = "lifai_theme_v1";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(THEME_KEY) !== "light";
  });

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }

  return { isDark, toggleTheme };
}
