/**
 * Лестница сроков AEVION на сайте — слово основателя 15.09.2026.
 *
 * Тариф называет СРОК доступа ко всей планете: Lite 1 месяц, Medium 3, Pro 6,
 * Full 9, Max 12. Цена месяца всей планеты: $400 / $350 / $300 / $250 / $200,
 * оплата за весь срок вперёд. Отдельно продаются только пять приложений — по той
 * же лестнице, со своей базой.
 *
 * Источник правды — бэкенд (aevion-globus-backend/src/data/pricing.ts, TERM_*,
 * STANDALONE_APPS). Здесь КОПИЯ для статических страниц, которым некогда ждать
 * /api/pricing; сторож src/lib/__tests__/termPricingMatchesBackend.test.ts
 * краснеет, если копия и источник разойдутся. Числа в тексты страниц не вписывать
 * руками — брать отсюда: три руки на одно число уже расходились (13.08.2026).
 *
 * Документ: Desktop/АЕВИОН/06-Витрина-цены-SEO/2026-09-15-ЦЕНОВАЯ-ПОЛИТИКА-тариф-это-срок.md
 */

export const TERM_TIERS = ["lite", "medium", "pro", "full", "max"] as const;
export type TermTier = (typeof TERM_TIERS)[number];

export const TERM_MONTHS: Record<TermTier, number> = { lite: 1, medium: 3, pro: 6, full: 9, max: 12 };
export const TERM_FACTOR: Record<TermTier, number> = { lite: 1, medium: 0.875, pro: 0.75, full: 0.625, max: 0.5 };
export const TERM_NAME: Record<TermTier, string> = { lite: "Lite", medium: "Medium", pro: "Pro", full: "Full", max: "Max" };

/**
 * Срок, который открывается у ПОКУПАТЕЛЯ по умолчанию на странице цен.
 *
 * 🔴 Заведено 07.10.2026: это число жило литералом в pricing/page.tsx
 * (`useState<TermTier>("lite")`), а денежная плашка DevHub подписывала кнопку
 * словом «Pro» и ценой $200/мес. По данным это Lite: у «pro» множитель 0.75,
 * то есть $150/мес и $900 за 6 месяцев. Покупатель читал «Оформить Pro» и
 * открывал Lite — то самое «обещание и списание расходятся». Теперь срок один
 * на обе поверхности, а сторож moneyPanelNamesWhatOpens сверяет подпись с
 * данными цен.
 */
export const СРОК_ПО_УМОЛЧАНИЮ: TermTier = "lite";

/** Цена месяца всей планеты на самом коротком сроке (Lite). */
/**
 * 🔴 19.10.2026 — слово основателя: ОДИН план «AEVION Планета», доступ ко всем
 * приложениям, цена месяца зависит от срока: 1 мес $250, 3 мес по $225, 6 по $200,
 * 9 по $175, 12 по $150. У плана СВОЯ лесенка (не TERM_FACTOR): 250×0.875 — не
 * целые доллары, и termPricePerMonth на этом бросает (инвариант «целый доллар»).
 * Числа — решение человека, записаны литералами; TERM_FACTOR остаётся для
 * отдельных приложений. Шахматы — отдельной карточкой $50/год.
 */
export const PLANET_TERM_PRICE: Record<TermTier, number> = { lite: 250, medium: 225, pro: 200, full: 175, max: 150 };
/** Цена одного месяца без срока (ступень lite); зеркало бэкенда, сторож termPricingMatchesBackend. */
export const PLANET_BASE_MONTHLY = 250;
export const CHESS_YEARLY_USD = 50;
export function planetPricePerMonth(term: TermTier): number { return PLANET_TERM_PRICE[term]; }
export function planetTotal(term: TermTier): number { return PLANET_TERM_PRICE[term] * TERM_MONTHS[term]; }
/** «от $…/мес» — месяц на самом длинном сроке. */
export function planetFromPerMonth(): number { return PLANET_TERM_PRICE.max; }
export function planetSavingPercent(term: TermTier): number { return Math.round((1 - PLANET_TERM_PRICE[term] / PLANET_TERM_PRICE.lite) * 1000) / 10; }

export function isTermTier(id: string): id is TermTier {
  return (TERM_TIERS as readonly string[]).includes(id);
}

/** Цена месяца на ступени. Базы кратны 8 — всегда целые доллары. */
export function termPricePerMonth(base: number, term: TermTier): number {
  return base * TERM_FACTOR[term];
}

/** Платёж за весь срок вперёд. */
export function termTotal(base: number, term: TermTier): number {
  return termPricePerMonth(base, term) * TERM_MONTHS[term];
}

/** Экономия ступени против помесячной оплаты, в процентах: 0, 12.5, 25, 37.5, 50. */
export function termSavingPercent(term: TermTier): number {
  return Math.round((1 - TERM_FACTOR[term]) * 1000) / 10;
}

export interface StandaloneApp {
  /** Что пишет вебхук в AppSubscription и что уходит в кассу полем `app`. */
  slug: string;
  /** id модуля в реестре (appId в каталоге products.ts). */
  moduleId: string;
  name: string;
  /** Цена месяца на Lite (1 месяц). */
  baseMonthly: number;
  /**
   * 🔴 19.10.2026, слово основателя: продаётся ТОЛЬКО на 12 месяцев за эту сумму
   * (шахматы $50/год). Зеркало бэкенда (data/pricing.ts): appSellableTerms даёт
   * один срок max, appTermTotal на другом — null.
   */
  yearOnlyUsd?: number;
}

export const STANDALONE_APPS: StandaloneApp[] = [
  { slug: "cyberchess", moduleId: "cyberchess", name: "CyberChess", baseMonthly: 24, yearOnlyUsd: CHESS_YEARLY_USD },
  { slug: "multichat", moduleId: "multichat-engine", name: "Multichat", baseMonthly: 40 },
  { slug: "qventure", moduleId: "qventure", name: "QVenture", baseMonthly: 80 },
  { slug: "ip_bureau", moduleId: "aevion-ip-bureau", name: "IP Bureau", baseMonthly: 32 },
  { slug: "devhub", moduleId: "devhub", name: "DevHub", baseMonthly: 200 },
  // 20.09.2026: цена есть у каждого модуля запуска. Копия обязана совпадать с
  // бэкендом — сторож termPricingMatchesBackend краснеет при расхождении.
  { slug: "qright", moduleId: "qright", name: "QRight", baseMonthly: 24 },
  { slug: "qsign", moduleId: "qsign", name: "QSign", baseMonthly: 24 },
  { slug: "startup_exchange", moduleId: "startup-exchange", name: "Startup Exchange", baseMonthly: 40 },
  { slug: "qskyway", moduleId: "qskyway", name: "QSkyway", baseMonthly: 16 },
];

/** Сроки, на которые приложение продаётся: у годового — один `max`. */
export function appSellableTerms(app: Pick<StandaloneApp, "yearOnlyUsd">): TermTier[] {
  return app.yearOnlyUsd != null ? ["max"] : [...TERM_TIERS];
}

/** Платёж за срок у приложения; null — на этом сроке не продаётся. */
export function appTermTotal(app: Pick<StandaloneApp, "baseMonthly" | "yearOnlyUsd">, term: TermTier): number | null {
  if (app.yearOnlyUsd != null) return term === "max" ? app.yearOnlyUsd : null;
  return termTotal(app.baseMonthly, term);
}

/** Срок, который реально покупается у приложения при выбранном на витрине сроке. */
export function appTermFor(app: Pick<StandaloneApp, "yearOnlyUsd">, chosen: TermTier): TermTier {
  return app.yearOnlyUsd != null ? "max" : chosen;
}

/** По slug, id модуля или короткому id витрины ("bureau" → IP Bureau). */
export function standaloneApp(id: string): StandaloneApp | null {
  const key = id === "bureau" ? "aevion-ip-bureau" : id === "multichat" ? "multichat-engine" : id;
  return STANDALONE_APPS.find((a) => a.slug === id || a.moduleId === key) ?? null;
}

/** Самая низкая цена месяца, какую можно назвать честно, — «от $X/мес» (срок Max). */
export function fromPricePerMonth(base: number): number {
  return termPricePerMonth(base, "max");
}
