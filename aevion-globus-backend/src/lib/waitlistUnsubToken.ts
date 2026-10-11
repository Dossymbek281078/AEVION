import crypto from "node:crypto";

/**
 * Ссылка отписки для писем списка ожидания и её проверка — 21.08.2026.
 *
 * ЗАЧЕМ. До этого дня в каждом письме-подтверждении стояла ссылка
 * `aevion.app/constitution/waitlist/unsubscribe?email=…`, которой НЕ СУЩЕСТВОВАЛО:
 * ни страницы, ни ручки — проверено пробой, 404 наравне с заведомо выдуманным
 * адресом. То есть отписаться было нельзя ни одним способом, а рабочая отписка в
 * платформе есть только у других модулей и по другому принципу (`/api/<модуль>/
 * unsubscribe?token=…`). Смоук проверял именно её и был зелёным — проверка была,
 * но не для того списка.
 *
 * ПОЧЕМУ ТОКЕН, А НЕ ПРОСТО АДРЕС. По ссылке с одним лишь `?email=` любой желающий
 * отписал бы чужой адрес, зная его. Токен — HMAC от адреса на серверном секрете:
 * подделать нельзя, хранить ничего не нужно, ссылка живёт столько же, сколько
 * секрет.
 *
 * ЕСЛИ СЕКРЕТА НЕТ. Не выдумываем запасной и не отправляем ссылку, которая молча не
 * сработает: `unsubscribeUrl` вернёт null, письмо напишет адрес почты для отписки
 * вручную, а ручка ответит 503 с той же просьбой. Отписка, которая делает вид, что
 * сработала, хуже её отсутствия.
 */

const FALLBACK_CONTACT = "yahiin1978@gmail.com";

function secret(): string | null {
  const s = (process.env.WAITLIST_UNSUB_SECRET || process.env.AUTH_JWT_SECRET || "").trim();
  return s.length >= 16 ? s : null;
}

/** Есть ли чем подписывать ссылки. Ручка и письма спрашивают это ДО работы. */
export function unsubConfigured(): boolean {
  return secret() !== null;
}

/** Адрес для отписки вручную, когда автоматическая недоступна. */
export function unsubContact(): string {
  return process.env.WAITLIST_UNSUB_CONTACT || FALLBACK_CONTACT;
}

/** Токен отписки: HMAC от НОРМАЛИЗОВАННОГО адреса, 32 hex-символа. */
export function unsubToken(email: string): string | null {
  const s = secret();
  if (!s) return null;
  const normalized = String(email).trim().toLowerCase();
  return crypto.createHmac("sha256", s).update(`unsub:${normalized}`).digest("hex").slice(0, 32);
}

/**
 * МЕТКА АДРЕСА ДЛЯ ЖУРНАЛА — вместо самого адреса.
 *
 * Зачем. Журнал процесса видит каждый, у кого есть доступ к панели Railway, и
 * адреса подписчиков там быть не должно: это чужие персональные данные, а не
 * наши отладочные строки. Метка стабильна (один адрес — одна метка), поэтому
 * по ней можно СВЕРИТЬ подозреваемый адрес, но нельзя прочитать список.
 *
 * 🔴 Приставка `log:` отличается от `unsub:` НАМЕРЕННО, и это главное свойство
 * здесь. Если бы метка считалась тем же способом, что токен, она совпала бы с
 * ним — и любой, кто видит журнал, мог бы отписать человека по его же метке.
 * Разные приставки делают это невозможным, и на это есть отдельная проверка.
 *
 * Нет секрета — метка всё равно не адрес: берём sha256 без ключа. Слабее
 * (адрес из короткого списка подобрать можно), но лучше открытого адреса, и
 * повод настроить секрет остаётся виден по приставке `log-nokey:`.
 */
export function меткаДляЖурнала(email: string): string {
  const normalized = String(email).trim().toLowerCase();
  const s = secret();
  if (!s) {
    return "log-nokey:" + crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  }
  return "log:" + crypto.createHmac("sha256", s).update(`log:${normalized}`).digest("hex").slice(0, 12);
}

/**
 * Сверка токена. Сравнение постоянного времени: обычное `===` на секретах
 * подсказывает длину совпадающего префикса тому, кто умеет мерить время.
 */
export function verifyUnsubToken(email: string, token: unknown): boolean {
  const expected = unsubToken(email);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
  } catch {
    return false;
  }
}

/** Готовая ссылка для письма. null — если подписывать нечем (см. шапку). */
export function unsubscribeUrl(email: string, base = "https://api.aevion.app"): string | null {
  const t = unsubToken(email);
  if (!t) return null;
  const e = encodeURIComponent(String(email).trim().toLowerCase());
  return `${base.replace(/\/+$/, "")}/api/constitution/waitlist/unsubscribe?email=${e}&t=${t}`;
}
