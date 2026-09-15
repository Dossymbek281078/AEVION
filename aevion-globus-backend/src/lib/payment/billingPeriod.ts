import { TERM_MONTHS, isTermTier, type TierId } from "../../data/pricing";

/**
 * Срок покупки и тариф выводятся ИЗ ССЫЛКИ ЗАКАЗА — одно правило на все кассы.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Правило жило в трёх копиях: своя функция у paybox,
 * такая же у paypal, встроенное выражение у gumroad. Четвёртая касса,
 * Lemon Squeezy, копии не получила и зашивала месячный период — то есть
 * годовая покупка записывалась месячной, и человек терял доступ через месяц
 * после того, как заплатил за год. Пока копий было три, отставание четвёртой
 * ничем не выдавало себя.
 *
 * С 15.09.2026 тариф — это СРОК (data/pricing.ts, TERM_*). Ссылки витрины:
 *
 *   tier_<ступень>              вся планета: tier_lite … tier_max
 *   app_<приложение>_<ступень>  отдельное приложение: app_cyberchess_pro
 *
 * Прежние ссылки (tier_lite_monthly, tier_full_annual, app_devhub) продолжают
 * пониматься: по ним уже могли купить, и продление придёт с ними же.
 */

/** Прежние слова тарифа → тариф новой лестницы. Всё, что было «всей экосистемой», — full. */
const LEGACY_TIER: Record<string, TierId> = {
  lite: "lite",
  medium: "medium",
  full: "full",
  planet: "full",
  pro: "full",
  business: "full",
  enterprise: "enterprise",
};

/** Срок покупки в месяцах: ступень лестницы, иначе прежнее слово периода. */
export function termMonthsForReference(ref: string): number {
  const r = ref.toLowerCase();
  if (r.startsWith("tier_") || r.startsWith("app_")) {
    const ступень = r.startsWith("tier_") ? r.slice(5) : r.slice(r.lastIndexOf("_") + 1);
    if (isTermTier(ступень)) return TERM_MONTHS[ступень];
  }
  return r.includes("annual") ? 12 : 1;
}

/**
 * Тариф по ссылке заказа — ТОЛЬКО когда ссылка нашего формата. Иначе null, и
 * решает вызывающий: у каждой кассы своя политика к чужим ссылкам (журнал,
 * Sentry, отказ). Подстрокой не ищем: «promo» содержит «pro».
 */
export function tierIdForReference(ref: string): TierId | null {
  const m = /^tier_([a-z]+)(?:_(monthly|annual))?$/.exec(ref.toLowerCase());
  if (!m) return null;
  const слово = m[1];
  if (!m[2]) return isTermTier(слово) ? слово : слово === "enterprise" ? "enterprise" : null;
  return Object.prototype.hasOwnProperty.call(LEGACY_TIER, слово) ? LEGACY_TIER[слово] : null;
}
