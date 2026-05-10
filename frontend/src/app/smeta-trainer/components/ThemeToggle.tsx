"use client";

import { useTheme } from "../lib/useTheme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`p-1 rounded hover:bg-slate-700/50 text-base leading-none ${className}`}
      title={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
