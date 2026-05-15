"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "aevion_bank_theme_v1";
type Theme = "light" | "dark";

function loadTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.querySelector(".aevion-bank-root") as HTMLElement | null;
  if (!root) return;
  if (theme === "dark") {
    root.setAttribute("data-bank-theme", "dark");
  } else {
    root.removeAttribute("data-bank-theme");
  }
}

export function ThemeStyles() {
  // CSS-filter approach: invert + hue-rotate the entire bank tree, then
  // un-invert anything that should keep its colour (images, SVGs, gradients
  // that already encode dark intent). This gives a fast "dark mode" without
  // touching every component's inline style — at the cost of perfect
  // colour fidelity. Documented as a v1.
  return (
    <style>{`
      .aevion-bank-root[data-bank-theme="dark"] {
        background: #0a0e1a;
        filter: invert(0.92) hue-rotate(180deg);
      }
      .aevion-bank-root[data-bank-theme="dark"] img,
      .aevion-bank-root[data-bank-theme="dark"] svg image,
      .aevion-bank-root[data-bank-theme="dark"] [data-no-invert],
      .aevion-bank-root[data-bank-theme="dark"] video {
        filter: invert(1) hue-rotate(180deg);
      }
      .aevion-bank-root[data-bank-theme="dark"] svg {
        /* Un-invert SVG charts so they stay readable */
        filter: invert(1) hue-rotate(180deg);
      }
    `}</style>
  );
}

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = loadTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
      title={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
      style={{
        position: "fixed",
        right: 16,
        top: 72,
        zIndex: 70,
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "none",
        background: theme === "dark" ? "#fde68a" : "#0f172a",
        color: theme === "dark" ? "#0f172a" : "#fde68a",
        fontSize: 18,
        cursor: "pointer",
        boxShadow: "0 6px 16px rgba(15,23,42,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
