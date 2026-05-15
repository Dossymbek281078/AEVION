"use client";

// Client-side language picker mirroring qrightServerI18n.pickLang.
// Reads ?lang= from URL first, then falls back to navigator.language.
// Defaults to "en" so SSR and first paint stay stable.
export type Lang = "en" | "ru";

export function pickLangClient(): Lang {
  if (typeof window === "undefined") return "en";
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("lang");
  if (fromQuery === "ru" || fromQuery === "en") return fromQuery;
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("ru")) return "ru";
  return "en";
}
