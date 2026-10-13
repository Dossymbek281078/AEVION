import type { PzLocale } from "../puzzleNormalize";

/** Язык по правилу 120: явный выбор (кука, ?lang) старше догадки по Accept-Language. */
export function yazykZaprosa(cookie: string | null, langParam: string | null, acceptLanguage: string | null): PzLocale {
  const ok = (v: string | null | undefined): PzLocale | null => (v === "ru" || v === "en" || v === "kk" ? v : v === "kz" ? "kk" : null);
  const m = /(?:^|;\s*)aevion_lang_v1=([a-z]{2})/.exec(cookie ?? "");
  return ok(langParam?.toLowerCase()) ?? ok(m?.[1]) ?? ok((acceptLanguage ?? "").split(",")[0]?.trim().slice(0, 2).toLowerCase()) ?? "en";
}

