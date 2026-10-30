/** Языки писем платформы. Умолчание сайта — ru. */
export type MailLang = "ru" | "en" | "kk";

function норм(raw: unknown): MailLang | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (t === "ru" || t === "en" || t === "kk") return t;
  if (t === "kz") return "kk";
  return null;
}

/**
 * Язык письма: явное поле `lang` тела (ru|en|kk) → первый тег Accept-Language
 * (kz → kk; неподдерживаемый → en) → без всего ru. Явное, но неверное `lang`
 * игнорируется и решает заголовок.
 */
export function resolveMailLang(bodyLang: unknown, acceptLanguage: unknown): MailLang {
  const явный = норм(bodyLang);
  if (явный) return явный;
  const h = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  if (typeof h !== "string" || !h.trim()) return "ru";
  const первый = h.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (!первый || первый === "*") return "ru";
  return норм(первый) ?? "en";
}
