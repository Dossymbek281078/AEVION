/**
 * Gumroad — единственный живой процессинг (Paddle/Stripe/LemonSqueezy не прошли
 * KYC и мертвы). ЕДИНЫЙ источник правды по permalink'ам продуктов на фронте.
 *
 * Атрибуция выручки по приложению/бандлу в дашборде (/api/revenue/gumroad/*)
 * работает ТОЛЬКО если у продукта СВОЙ permalink. Пока заведён один продукт
 * (xpxzam) — все кнопки ведут в него и в дашборде всё падает в "platform".
 *
 * Чтобы развести выручку по приложениям:
 *   1. Создать продукт в Gumroad → получить permalink (часть после /l/).
 *   2. Добавить строку в GUMROAD_PERMALINKS ниже (ключ = appId/bundleId или
 *      `${appId}:${tier}`).
 *   3. В Railway (backend) прописать обратный маппинг
 *      GUMROAD_APP_<PERMALINK_UPPER>=<appId> — его читает revenue-роут.
 */

export const GUMROAD_STORE = "https://aevion.gumroad.com/l";
export const GUMROAD_DEFAULT_PERMALINK = "xpxzam";

/**
 * Ключ → permalink. Приоритет совпадения: `${key}:${tier}` → `${key}` → `${tier}`.
 * key = appId | bundleId | "platform" | "all-access".
 * Раскомментировать/добавлять по мере создания продуктов в Gumroad.
 */
export const GUMROAD_PERMALINKS: Record<string, string> = {
  // "all-access":      "xpxzam",
  // "cyberchess:pro":  "aevion-cyberchess-pro",
  // "healthai:pro":    "aevion-healthai-pro",
};

export function gumroadPermalink(opts: { key?: string; tier?: string } = {}): string {
  const { key, tier } = opts;
  if (key && tier && GUMROAD_PERMALINKS[`${key}:${tier}`]) return GUMROAD_PERMALINKS[`${key}:${tier}`];
  if (key && GUMROAD_PERMALINKS[key]) return GUMROAD_PERMALINKS[key];
  if (tier && GUMROAD_PERMALINKS[tier]) return GUMROAD_PERMALINKS[tier];
  return GUMROAD_DEFAULT_PERMALINK;
}

/**
 * Полный URL Gumroad-чекаута. ?wanted=true сразу открывает overlay-чекаут;
 * app/tier/period — для аналитики (referrer), на оплату не влияют.
 */
export function gumroadCheckoutUrl(opts: { key?: string; tier?: string; period?: string } = {}): string {
  const permalink = gumroadPermalink(opts);
  const params = new URLSearchParams({ wanted: "true" });
  if (opts.key) params.set("app", opts.key);
  if (opts.tier) params.set("tier", opts.tier);
  if (opts.period) params.set("period", opts.period);
  return `${GUMROAD_STORE}/${permalink}?${params.toString()}`;
}
