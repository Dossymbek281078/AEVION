// Language metadata and helpers — small, and safe for any page to import.
//
// The translated strings do NOT live here any more. Until 10.08.2026 this file
// also held all eleven dictionaries in one object, and the client provider
// imports it, so every page of the platform downloaded every language: 1.3 MB
// of the 2.5 MB a page must load before it can answer a tap, measured with
// scripts/page-weight.mjs. They now live one language per file in i18n-lang/;
// the client takes `en` for the first render and fetches the visitor's language
// on demand (i18n.tsx), the server takes all of them at once (i18n-all.ts).
//
// This file stays separate from i18n.tsx because that file uses "use client",
// which makes non-component exports become opaque "client reference" stubs when
// imported from a server component — that failure looked like "Cannot read
// properties of undefined (reading <key>)" inside tServer().

export type Lang = "en" | "ru" | "kk" | "de" | "fr" | "es" | "zh" | "ja" | "ar" | "pt" | "tr";

export const LANGS: Lang[] = ["ru", "en", "kk", "de", "fr", "es", "zh", "ja", "ar", "pt", "tr"];

export const LANG_FLAG: Record<Lang, string> = {
  en: "🇺🇸", ru: "🇷🇺", kk: "🇰🇿", de: "🇩🇪", fr: "🇫🇷",
  es: "🇪🇸", zh: "🇨🇳", ja: "🇯🇵", ar: "🇸🇦", pt: "🇧🇷", tr: "🇹🇷",
};

export const LANG_SHORT: Record<Lang, string> = {
  en: "EN", ru: "RU", kk: "KZ", de: "DE", fr: "FR",
  es: "ES", zh: "ZH", ja: "JA", ar: "AR", pt: "PT", tr: "TR",
};

export const LANG_FULL: Record<Lang, string> = {
  en: "English",
  ru: "Русский",
  kk: "Қазақша",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  zh: "中文",
  ja: "日本語",
  ar: "العربية",
  pt: "Português",
  tr: "Türkçe",
};

// RTL languages
export const LANG_RTL: Partial<Record<Lang, true>> = { ar: true };

export const LANG_COOKIE = "aevion_lang_v1";

/**
 * How many keys each language actually has, generated 10.08.2026 alongside
 * src/lib/i18n-lang/*.ts.
 *
 * The language switcher shows coverage, and it used to count the keys of the
 * live dictionary — which meant importing all eleven of them just to draw a
 * percentage. These numbers cost nothing and say the same thing. Regenerate
 * them with scripts/splitI18n.mjs when a language grows.
 */
/*
 * Числа поправлены вручную 31.08.2026 при сборке к 10.09 — и это отступление
 * от нормы, поэтому объясняю.
 *
 * Обычно их пишет scripts/splitI18n.mjs, читая модуль, который экспортирует
 * ВЕСЬ словарь. После разбиения такого модуля больше нет: здесь остались
 * только служебные данные. При сведении веток я переносил новые ключи в
 * i18n-lang/*.ts программно (32 ключа QSkyway, 2 платёжных, 2 честных
 * формулировки про сертификацию), и константа отстала от файлов.
 *
 * Числа взяты подсчётом УНИКАЛЬНЫХ ключей в самих файлах, а не прикидкой:
 * ru 7385, en 7385, kk 7344. По ним langCoverage.ts показывает человеку
 * полноту перевода — то есть отставшая константа занижала бы её молча.
 */
export const LANG_KEY_COUNT: Record<Lang, number> = {
  ru: 7392,
  en: 7392,
  kk: 7351,
  de: 134,
  fr: 134,
  es: 134,
  zh: 134,
  ja: 134,
  ar: 134,
  pt: 134,
  tr: 134,
};

export function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let r = s;
  for (const [k, v] of Object.entries(vars)) {
    r = r.split(`{${k}}`).join(String(v));
  }
  return r;
}
