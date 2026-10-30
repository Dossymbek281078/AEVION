// Server-side i18n helper. Use from server components that need translated
// chrome on the cold render — /awards, /[id], /pitch and similar — without
// flashing English while the client provider hydrates.
//
// How locale is resolved (first match wins):
//   ?lang= / ?c=mail-* → path prefix → cookie `aevion_lang_v1` → first tag of
//   Accept-Language (unsupported → en) → fallback "en". See lib/serverLang.ts.
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

// Import from the pure data module — NOT from "./i18n", which is a "use client"
// boundary. Importing translations through that boundary returns an opaque
// client-reference stub on the server, which made tServer() throw
// "Cannot read properties of undefined (reading <key>)" for every SSR page
// that wasn't a static route (observed on /globus, /qbuild, /qtradeoffline,
// /aevion-ip-bureau, /awards on Vercel 2026-05-03).
import { interpolate, type Lang } from "./i18n-data";
import { serverLang } from "./serverLang";
// The server renders whichever language the visitor asked for, so it takes all
// of them. This import is what keeps i18n-all.ts out of the client bundle —
// nothing a client component imports may reach it.
import { translations } from "./i18n-all";

export type { Lang } from "./i18n-data";

/**
 * Язык SSR для страниц, у которых английский — родной. Правила выбора те же, что у
 * клиента и у serverLang(): ?lang= -> ?c=mail-* -> путь -> кука -> ПЕРВЫЙ тег
 * Accept-Language (чужой -> en). Отличие одно: без заголовка умолчание "en"
 * (у serverLang — "ru"). ?lang= и путь приезжают заголовками x-aevion-search /
 * x-aevion-pathname, которые ставит middleware.
 */
export async function getServerLang(): Promise<Lang> {
  return serverLang("en");
}

export function tServer(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const tbl = translations as unknown as Record<string, Record<string, string>>;
  const raw = tbl[lang]?.[key] ?? tbl["en"]?.[key] ?? key;
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
