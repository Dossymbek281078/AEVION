"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "aevion-smeta-theme-v1";

export type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
}

/**
 * Toggle темы. Class .dark ставится на <html>, что активирует @custom-variant dark
 * в Tailwind v4. Тема сохраняется в localStorage и восстанавливается при mount.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "dark" || saved === "light") {
        setThemeState(saved);
        applyTheme(saved);
      }
    } catch {}
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
