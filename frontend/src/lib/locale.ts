// Canonical "which Intl locale for this UI language" mapping. Only a 2-way
// split (ru vs everything-else → en-US) — matches the pattern already used
// ad-hoc in planet/transparency and qright/transparency before this file
// existed, and now in revenue/page.tsx + goalEta.ts. New code should import
// this instead of re-writing the `lang === "ru" ? "ru-RU" : "en-US"` ternary.
export type NumLang = "en" | "ru";

export function intlLocale(lang: NumLang): string {
  return lang === "ru" ? "ru-RU" : "en-US";
}

export function fmtNum(n: number, lang: NumLang, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(intlLocale(lang), opts);
}
