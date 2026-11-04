import crypto from "node:crypto";

/**
 * Согласие на письма с новостями и предложениями (4.11.2026).
 *
 * До этого дня при регистрации согласия не спрашивали, и «тёплого» списка для
 * рассылки о ценах не было: регистрация аккаунта — не согласие на рассылку.
 * Теперь согласие — отдельная галочка, по умолчанию ВЫКЛЮЧЕНА; хранится флаг
 * `marketingConsent` и дата последнего изменения `marketingConsentAt`.
 *
 * Отписка по ссылке из письма — как у списка ожидания (lib/waitlistUnsubToken.ts):
 * токен — HMAC адреса на серверном секрете, хранить ничего не нужно. Приставка
 * `mkt:` отличается от `unsub:` намеренно: токен списка ожидания не должен
 * отписывать от рассылки аккаунта, и наоборот.
 *
 * Нет секрета — ссылку не выдумываем: marketingUnsubscribeUrl вернёт null, а
 * ручка ответит 503. Отписка, которая делает вид, что сработала, хуже её отсутствия.
 */

function secret(): string | null {
  const s = (process.env.WAITLIST_UNSUB_SECRET || process.env.AUTH_JWT_SECRET || "").trim();
  return s.length >= 16 ? s : null;
}

/** Строго `true`: строка "true", 1 и отсутствие поля — это НЕ согласие. */
export function parseMarketingConsent(body: unknown): boolean {
  return (body as { marketingConsent?: unknown } | null | undefined)?.marketingConsent === true;
}

export function marketingUnsubConfigured(): boolean {
  return secret() !== null;
}

export function marketingToken(email: string): string | null {
  const s = secret();
  if (!s) return null;
  const normalized = String(email).trim().toLowerCase();
  return crypto.createHmac("sha256", s).update(`mkt:${normalized}`).digest("hex").slice(0, 32);
}

export function verifyMarketingToken(email: string, token: unknown): boolean {
  const expected = marketingToken(email);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
  } catch {
    return false;
  }
}

/** Ссылка отписки для КАЖДОГО письма рассылки; null — если подписывать нечем. */
export function marketingUnsubscribeUrl(email: string, base = "https://api.aevion.app"): string | null {
  const t = marketingToken(email);
  if (!t) return null;
  const e = encodeURIComponent(String(email).trim().toLowerCase());
  return `${base.replace(/\/+$/, "")}/api/auth/marketing/unsubscribe?email=${e}&t=${t}`;
}
