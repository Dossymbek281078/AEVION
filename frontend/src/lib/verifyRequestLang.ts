// Язык письма подтверждения почты. Бэк принимает `lang` только ru|en|kk;
// иное значение не отправляем — тогда он выберет язык по Accept-Language.
export type VerifyLang = "ru" | "en" | "kk";

export function verifyRequestLang(lang: unknown): VerifyLang | undefined {
  return lang === "ru" || lang === "en" || lang === "kk" ? lang : undefined;
}

/** Тело POST /api/auth/email/verify/request: `{ lang }` или без тела. */
export function verifyRequestBody(lang: unknown): { headers: Record<string, string>; body?: string } {
  const l = verifyRequestLang(lang);
  return l ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: l }) } : { headers: {} };
}
