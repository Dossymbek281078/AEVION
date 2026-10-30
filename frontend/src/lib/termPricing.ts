/**
 * Лестница сроков AEVION на сайте — слово основателя 15.09.2026.
 *
 * Тариф называет СРОК доступа ко всей планете: Lite 1 месяц, Medium 3, Pro 6,
 * Full 9, Max 12. Цена месяца всей планеты (с 19.10.2026): $250 / $225 / $200 /
 * $175 / $150 (PLANET_TERM_PRICE). Отдельно продаются только шахматы — $50 в год;
 * цены остальных модулей отменены (STANDALONE_APPS хранит базы для кассы и
 * старых подписок, гостю они не показываются).
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

/*
 * 🔴 19.10.2026 22:4x–22:5x, слово основателя: срочный план СПИСЫВАЕТСЯ
 * ПОМЕСЯЧНО при обязательстве на срок («$1800 сразу неподъёмно — соглашается
 * на годовую, платит ежемесячно»). totalUsd срока — сумма помесячных платежей.
 * Оплата всего срока вперёд — скидка к этой сумме: 3 мес −5 %, 6 −7,5 %,
 * 9 −10 %, 12 −12,5 % → 641.25 / 1110 / 1417.50 / 1575. Без срока (lite)
 * платить вперёд не за что — скидка 0.
 */
export const PLANET_PREPAY_DISCOUNT_PERCENT: Record<TermTier, number> = { lite: 0, medium: 5, pro: 7.5, full: 10, max: 12.5 };
/** До цента: 675 × 0.95 в двоичной дроби — 641.2499…, покупателю показываем 641.25. */
export function toCents(usd: number): number { return Math.round(usd * 100) / 100; }
/** Один платёж за весь срок вперёд, со скидкой; у срока без обязательства — цена месяца. */
export function planetPrepayTotal(term: TermTier): number {
  return toCents(planetTotal(term) * (1 - PLANET_PREPAY_DISCOUNT_PERCENT[term] / 100));
}
/** Сколько помесячных списаний несёт обязательство: 1 / 3 / 6 / 9 / 12. */
export function planetPaymentsCount(term: TermTier): number { return TERM_MONTHS[term]; }

/*
 * Досрочная отмена срочного плана — ИТОГ основателя 19.10 22:5x.
 * Прожитые дни оплачиваются по самой длинной ПРОЙДЕННОЙ ступени лесенки:
 * < 90 дн — $250/мес, 90–179 — $225, 180–269 — $200, 270–364 — $175;
 * месяц = 30 дней, год = 365. Дослужил срок — цена плана, пересчёта нет.
 * «Оплачено − наше» > 0 — возврат; < 0 — у помесячного доплата счётом
 * (касса сама не спишет), у оплаты вперёд доплаты нет.
 * Контрольные числа основателя: год вперёд 1575, 200 дн → наше 1333.33,
 * возврат 241.67; год помесячно, 120 дн, оплачено 600 → доплата 300.
 */
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 365;
/** С какого прожитого дня ступень считается пройденной. */
export const PLANET_LADDER_FROM_DAY: Record<TermTier, number> = { lite: 0, medium: 90, pro: 180, full: 270, max: DAYS_PER_YEAR };
export type PlanetBilling = "monthly" | "prepaid";
export interface PlanetEarlyCancellation {
  /** Ступень, по цене месяца которой посчитаны прожитые дни. */
  ladderTier: TermTier;
  rateUsdPerMonth: number;
  /** Сколько стоят прожитые дни. */
  ourUsd: number;
  refundUsd: number;
  surchargeUsd: number;
  /** Срок дослужен (или срока не было) — пересчёта нет. */
  finished: boolean;
}
/** Длина срока в днях: 30 / 90 / 180 / 270 / 365. */
export function planetTermDays(term: TermTier): number {
  return term === "max" ? DAYS_PER_YEAR : TERM_MONTHS[term] * DAYS_PER_MONTH;
}
/** Самая длинная ступень, чей порог дней пройден. */
export function planetLadderTierForDays(daysUsed: number): TermTier {
  let tier: TermTier = "lite";
  for (const t of TERM_TIERS) if (daysUsed >= PLANET_LADDER_FROM_DAY[t]) tier = t;
  return tier;
}
export function planetEarlyCancellation(input: { term: TermTier; billing: PlanetBilling; daysUsed: number; paidUsd: number }): PlanetEarlyCancellation {
  const { term, billing } = input;
  const daysUsed = Math.max(0, Math.floor(input.daysUsed));
  const paidUsd = toCents(Math.max(0, input.paidUsd));
  // Без срока обязательства нет, дослуженный срок пересчёту не подлежит.
  if (term === "lite" || daysUsed >= planetTermDays(term)) {
    return { ladderTier: term, rateUsdPerMonth: PLANET_TERM_PRICE[term], ourUsd: paidUsd, refundUsd: 0, surchargeUsd: 0, finished: true };
  }
  const ladderTier = planetLadderTierForDays(daysUsed);
  const rateUsdPerMonth = PLANET_TERM_PRICE[ladderTier];
  const ourUsd = toCents((daysUsed * rateUsdPerMonth) / DAYS_PER_MONTH);
  const diff = toCents(paidUsd - ourUsd);
  return {
    ladderTier,
    rateUsdPerMonth,
    ourUsd,
    refundUsd: diff > 0 ? diff : 0,
    surchargeUsd: diff < 0 && billing === "monthly" ? toCents(-diff) : 0,
    finished: false,
  };
}

export function isTermTier(id: string): id is TermTier {
  return (TERM_TIERS as readonly string[]).includes(id);
}

/** Цена месяца на ступени. Базы кратны 8 — всегда целые доллары. */
export function termPricePerMonth(base: number, term: TermTier): number {
  return base * TERM_FACTOR[term];
}

/** Платёж приложения за весь срок (у плана — сумма помесячных списаний, см. planetTotal). */
export function termTotal(base: number, term: TermTier): number {
  return termPricePerMonth(base, term) * TERM_MONTHS[term];
}

/**
 * Экономия срока плана против месяца без срока, в процентах: 0, 10, 20, 30, 40.
 * 🔴 20.10.2026: считалась из TERM_FACTOR (12.5/25/37.5/50), а строка карточки с
 * бэка — из цен плана (10/20/30/40); на карточке стояли ОБА числа. Теперь — из
 * лесенки плана PLANET_TERM_PRICE; зеркало бэкенда, сторож termPricingMatchesBackend.
 */
export function termSavingPercent(term: TermTier): number {
  return planetSavingPercent(term);
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

/**
 * 🔴 20.10.2026: сумма денег на витрине — ОДНА функция на все места. Целое —
 * без копеек с разделителем тысяч ru-RU («1 110», «1 575»); с центами — два знака
 * через точку («641.25», «1 417.50»), как в строках бэка. Прежде «вперёд одним
 * платежом: $641» округлял 641.25, а пункт списка ниже писал «$641.25».
 */
export function formatMoneyAmount(amount: number): string {
  const cents = Math.round(amount * 100);
  const whole = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100);
  const int = whole.toLocaleString("ru-RU");
  return frac === 0 ? int : `${int}.${String(frac).padStart(2, "0")}`;
}

/** Сумма в валюте витрины: в USD — до цента; в справочной конвертации — целая, как прежде. */
export function formatShopPrice(usd: number, symbol: string, rate: number): string {
  return `${symbol}${formatMoneyAmount(rate === 1 ? usd : Math.round(usd * rate))}`;
}
