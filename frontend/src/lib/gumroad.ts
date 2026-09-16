/**
 * Gumroad — ссылки на РАЗОВЫЕ товары (гайды и книги). ЕДИНЫЙ источник правды по
 * permalink'ам Gumroad на фронте.
 *
 * ⚠️ 15.09.2026 — новая ценовая политика (слово основателя): подписка AEVION —
 * это СРОК доступа ко всей планете, оплата за срок вперёд через нашу кассу
 * (/pricing → /api/pricing/checkout/session). Подписки на Gumroad сняты с продажи:
 * All-Access (xpxzam), Constitution Pro (pyiaz) и Team (wjvquw). Их permalink'и
 * отсюда убраны, и дефолтного товара больше НЕТ: прежде любой незнакомый ключ
 * молча уводил покупателя в подписку All-Access, то есть в товар, который он не
 * выбирал, — теперь незнакомый ключ ведёт на страницу цен.
 *
 * Атрибуция выручки по товару в дашборде (/api/revenue/gumroad/*) работает ТОЛЬКО
 * если у товара СВОЙ permalink. Чтобы добавить разовый товар:
 *   1. Создать продукт в Gumroad → получить permalink (часть после /l/).
 *   2. Добавить строку в GUMROAD_PERMALINKS ниже (ключ = appId или `${appId}:${вариант}`).
 *   3. В Railway (backend) прописать обратный маппинг
 *      GUMROAD_APP_<PERMALINK_UPPER>=<appId> — его читает revenue-роут.
 */

export const GUMROAD_STORE = "https://aevion.gumroad.com/l";

/**
 * Куда ведёт ключ, которого нет в словаре. Не товар Gumroad, а страница цен:
 * там человек сам выбирает срок подписки или приложение. Молча продать ему
 * «что-нибудь по умолчанию» нельзя — именно так кнопки модулей годами вели в
 * подписку, которую он не выбирал.
 */
export const GUMROAD_FALLBACK_URL = "/pricing#tiers";

/**
 * Ключ → permalink. Приоритет совпадения: `${key}:${tier}` → `${key}` → `${tier}`.
 * Только разовые товары: подписок на Gumroad больше нет (см. шапку файла).
 */
export const GUMROAD_PERMALINKS: Record<string, string> = {
  // Заполнено 2026-07-26 по живому дашборду Gumroad; 15.09.2026 убраны подписки.
  qrenew: "kkiavh",           // The Anti-Grey Protocol (EN), разовая покупка
  "qrenew:ru": "tmuyxw",      // Протокол «Анти-седина» (RU), разовая покупка
  "gratitude-book": "ghvzq",  // Gratitude ∞ Forever Young — полный пакет
  // Модули через Gumroad не продаются вовсе: подписка и пять приложений
  // оформляются на /pricing (цены — `@/lib/termPricing`, карточки — `@/lib/products`).
};

/**
 * Своё ли это свойство словаря.
 *
 * Прямая индексация находит и унаследованное: GUMROAD_PERMALINKS["constructor"]
 * — это функция Object, она истинна, и она возвращалась ВМЕСТО permalink. Дальше
 * из неё собирался URL чекаута вида
 * `gumroad.com/l/function Object() { [native code] }?wanted=true`.
 */
const permalinkFor = (k: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(GUMROAD_PERMALINKS, k) ? GUMROAD_PERMALINKS[k] : undefined;

/** permalink товара или null, если такого разового товара на Gumroad нет. */
export function gumroadPermalink(opts: { key?: string; tier?: string } = {}): string | null {
  const { key, tier } = opts;
  return (key && tier ? permalinkFor(`${key}:${tier}`) : undefined)
    ?? (key ? permalinkFor(key) : undefined)
    ?? (tier ? permalinkFor(tier) : undefined)
    ?? null;
}

/**
 * Полный URL Gumroad-чекаута. ?wanted=true сразу открывает overlay-чекаут;
 * app/tier/period — для аналитики (referrer), на оплату не влияют.
 *
 * Незнакомый ключ → GUMROAD_FALLBACK_URL (страница цен), а не чужой товар.
 */
export function gumroadCheckoutUrl(opts: { key?: string; tier?: string; period?: string } = {}): string {
  const permalink = gumroadPermalink(opts);
  if (!permalink) return GUMROAD_FALLBACK_URL;
  const params = new URLSearchParams({ wanted: "true" });
  if (opts.key) params.set("app", opts.key);
  if (opts.tier) params.set("tier", opts.tier);
  if (opts.period) params.set("period", opts.period);
  return `${GUMROAD_STORE}/${permalink}?${params.toString()}`;
}
