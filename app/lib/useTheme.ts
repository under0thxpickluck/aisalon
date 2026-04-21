"use client";
import { useEffect, useState } from "react";

const THEME_KEY = "lifai_theme_v1";

export function useTheme() {
  const [isDark, setIsDark] = useState(true); // デフォルト: dark

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light") setIsDark(false);
  }, []);

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }

  return { isDark, toggleTheme };
}
