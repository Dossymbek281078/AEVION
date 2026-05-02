// Server-side i18n helper. Use from server components that need translated
// chrome on the cold render — /awards, /[id], /pitch and similar — without
// flashing English while the client provider hydrates.
//
// How locale is resolved (first match wins):
//   1. cookie `aevion_lang_v1` (set by the client I18nProvider when the user
//      picks a language in the UI)
//   2. Accept-Language header (kk/kz → kk, ru → ru, otherwise en)
//   3. fallback "en"
//
// The cookie is written by client setLang() — once the user clicks a language
// switcher anywhere in the app, every subsequent SSR render serves their
// language without a flash.
//
// Usage:
//
//   import { getServerT } from "@/lib/i18n-server";
//   export default async function AwardsPage() {
//     const { t, lang } = await getServerT();
//     return <h1>{t("awards.h1")}</h1>;
//   }

import { cookies, headers } from "next/headers";
import { LANG_COOKIE, interpolate, translations, type Lang } from "./i18n";

export type { Lang } from "./i18n";

function isLang(x: unknown): x is Lang {
  return x === "en" || x === "ru" || x === "kk";
}

function parseAcceptLanguage(al: string): Lang | null {
  const lower = al.toLowerCase();
  // Pick the *first* recognised tag rather than scanning the whole list — most
  // browsers send the user's preferred locale first.
  const parts = lower.split(",");
  for (const part of parts) {
    const tag = part.trim().split(";")[0]?.trim();
    if (!tag) continue;
    if (tag.startsWith("kk") || tag.startsWith("kz")) return "kk";
    if (tag.startsWith("ru")) return "ru";
    if (tag.startsWith("en")) return "en";
  }
  return null;
}

export async function getServerLang(): Promise<Lang> {
  try {
    const c = await cookies();
    const v = c.get(LANG_COOKIE)?.value;
    if (isLang(v)) return v;
  } catch {
    /* ignore — cookies() can throw outside a request scope */
  }

  try {
    const h = await headers();
    const al = h.get("accept-language") || "";
    const fromHeader = parseAcceptLanguage(al);
    if (fromHeader) return fromHeader;
  } catch {
    /* ignore */
  }

  return "en";
}

export function tServer(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = translations[lang]?.[key] ?? translations.en[key] ?? key;
  return interpolate(raw, vars);
}

export async function getServerT(): Promise<{
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
}> {
  const lang = await getServerLang();
  return {
    lang,
    t: (key, vars) => tServer(lang, key, vars),
  };
}
