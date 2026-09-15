import { computeFan, fanTotalUsd, capTotalDiscount, type AppliedFan } from "./discounts";
/**
 * AEVION Pricing — единый источник тарифов и матрицы модулей.
 *
 * Структура:
 *   - tiers: 4 тарифа (free / pro / business / enterprise) с лимитами и фичами
 *   - modules: матрица per-module add-on цен (для покупки модулей à la carte)
 *   - currencies: курсы для конвертации (USD как базовая)
 *   - bundles: готовые сборки нескольких модулей со скидкой
 *
 * Все цены — в USD/мес, если не указано иное. Ежегодная оплата = -16% (2 месяца бесплатно).
 *
 * ВАЖНО: данные синхронизированы со списком 27 модулей в src/data/projects.ts.
 *        Добавил поле `availability` чтобы фронт показывал "скоро" / "по запросу".
 */

export type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";

/**
 * Публичные тарифы: free / lite / medium / pro / full / max / enterprise.
 * С 15.09.2026 платный тариф — это СРОК доступа ко всей планете:
 * lite 1 мес, medium 3, pro 6, full 9, max 12 (лестница TERM_* ниже).
 * Цен здесь намеренно нет: 13.08.2026 пересказ цен в этой шапке уже разошёлся
 * с TIERS. Числа живут только в TERM_* и PLANET_BASE_MONTHLY.
 *
 * `business` — DEPRECATED legacy-алиас без собственного объекта тарифа, нужен
 * старым ссылкам Gumroad (provisioning.ts). В TIERS его нет; выдаётся как full.
 */
export type TierId = "free" | "lite" | "medium" | "pro" | "full" | "max" | "enterprise" | "business";

/** Модули, входящие в Medium-бандл (готовые consumer/prosumer-апп). */
export const MEDIUM_BUNDLE: string[] = [
  "cyberchess",
  "healthai",
  "multichat-engine",
  "qcoreai",
  "smeta-trainer",
  "qai",
  "qlearn",
  "qnews",
  "qstore",
  "qmedia",
];

export type ModuleAvailability = "live" | "beta" | "soon" | "on_request";

export interface TierLimits {
  /** Кол-во активных модулей в подписке (null = без ограничений) */
  modules: number | null;
  /**
   * Кол-во QRight-объектов / месяц.
   *
   * ⚠️ ВИТРИННОЕ ЧИСЛО: на 10.08.2026 его не читает НИ ОДИН участок кода.
   * Проверено сплошным поиском по бэкенду — поле встречается только здесь и
   * в ответе `/api/pricing`, откуда попадает в буллеты тарифов и в FAQ.
   * Роут `routes/qright.ts` никакого месячного потолка не проверяет.
   */
  qrightObjectsPerMonth: number | null;
  /**
   * Кол-во QSign-операций / день.
   *
   * ⚠️ Ровно та же история: показывается покупателю, но не enforce'ится.
   * Направление расхождения безопасное для клиента — он получает БОЛЬШЕ
   * обещанного, а не меньше, поэтому это не срочный баг. Но написано здесь,
   * чтобы следующий читатель не решил, будто лимит уже работает: из семи
   * полей TierLimits пять читаются кодом (modules и seats — в checkout.ts,
   * llmTokensPerMonth и premiumTokensPerMonth — в lib/qcoreQuota.ts, причём
   * под env-флагами QCOREAI_TIER_QUOTA / QCOREAI_PREMIUM_QUOTA), а эти два —
   * нет. supportSlaHours — обещание человеку, а не код, и это нормально.
   *
   * Включать enforcement здесь не стали: это продуктовое решение (кому и
   * когда начать отказывать), а не техническая правка.
   */
  qsignOpsPerDay: number | null;
  /** LLM-токены / месяц (QCoreAI / Multichat) */
  llmTokensPerMonth: number | null;
  /**
   * Суб-лимит токенов / месяц ТОЛЬКО на премиум/топовые модели (isPremiumModel
   * в services/qcoreai/pricing.ts — вывод ≥$5/1M). null = нет отдельного
   * суб-лимита (весь llmTokensPerMonth можно тратить на любые модели).
   * Добавлено 2026-07-22: llmTokensPerMonth сам по себе не защищает от того,
   * что весь месячный пакет уйдёт на самую дорогую модель в парке — см.
   * docs/PRICING_STRATEGY_2026-07.md.
   */
  premiumTokensPerMonth: number | null;
  /** Кол-во пользовательских мест */
  seats: number | null;
  /** SLA в часах ответа поддержки */
  supportSlaHours: number | null;
}

export interface PricingTier {
  id: TierId;
  name: string;
  tagline: string;
  /** Цена месяца на этом сроке, USD. Для enterprise — null (по запросу). */
  priceMonthly: number | null;
  /** Срок доступа в месяцах (lite 1 … max 12). null — у free и enterprise срока нет. */
  termMonths: number | null;
  /** Платёж за весь срок вперёд = priceMonthly × termMonths. */
  priceTermTotal: number | null;
  /** Что входит — короткие буллеты. */
  features: string[];
  /** Жёсткие лимиты для квот / биллинга. */
  limits: TierLimits;
  /** Подписи к CTA-кнопке. */
  ctaLabel: string;
  /** Подсветить "популярный" тариф. */
  highlight?: boolean;
}

export interface ModulePrice {
  /** id из data/projects.ts */
  id: string;
  /** Цена add-on в USD/мес поверх любого тарифа (null = недоступен sales-only) */
  addonMonthly: number | null;
  /** Включён ли модуль bundle-ом в указанные тарифы (без отдельной оплаты) */
  includedIn: TierId[];
  availability: ModuleAvailability;
  /** Короткое value-предложение для прайс-листа (1 строка) */
  oneLiner: string;
  /**
   * Человеческое название — ТОЛЬКО для модулей, которых нет в `data/projects.ts`.
   *
   * Обычно имя берётся из реестра проектов (см. routes/pricing.ts). Но если
   * модуля там нет, прежний запасной путь подставлял голый `id`, и покупатель
   * видел в выпадающем списке тарифа Lite строку вроде «qmelanin» вместо
   * названия. Замер 20.08.2026 на живом проде: 2 модуля из 43.
   *
   * Правильное решение — завести их в реестр, но это меняет ПУБЛИЧНОЕ число
   * модулей платформы (41 в реестре против 43 в прайсе), а такое решение
   * продуктовое, не техническое. Пока его нет, имя живёт здесь.
   */
  name?: string;
}

export interface PricingBundle {
  id: string;
  name: string;
  description: string;
  modules: string[];
  /** Цена/мес при monthly */
  priceMonthly: number;
  /** Скидка vs сумма по addonMonthly (информационно для UI) */
  savingsPercent: number;
}

/**
 * Максимальная доля subtotal, которую может снять ОДИН промо-код — платформенный
 * потолок, а не решение про конкретный код. Защищает от того, что fixed-скидка
 * (умножается на 12 для annual — см. checkout.ts/buildQuote) обнулит/почти
 * обнулит тариф целиком просто потому, что его цена оказалась ниже суммы
 * скидки (нашли на TEAM100 −$100 против Full $89/890 → $49/490 после переоценки — оба periода ≥ него).
 * ⚠️ После переоценки 13.08.2026 тот же −$100 обнулил бы месячный Full
 * целиком (цена $49), то есть потолок ниже стал нужнее, а не наоборот.
 */
export const MAX_PROMO_DISCOUNT_RATIO = 0.5;

/**
 * Тарифы Конституции. Живут ЗДЕСЬ, а не в маршруте оплаты.
 *
 * До 13.08.2026 `routes/constitutionCheckout.ts` держал собственную таблицу
 * `{ pro: 9, team: 49 }`. Итого цена Конституции существовала в трёх местах:
 * этот прайс (модуль `constitution`, $9), таблица маршрута и панель магазина.
 * Три источника одного числа расходятся молча — сегодня этот класс сработал
 * трижды за день, поэтому таблицу свели сюда.
 *
 * `pro` обязан совпадать с ценой модуля `constitution` в MODULES_PRICING:
 * это один и тот же товар, проданный двумя путями. Совпадение проверяется
 * тестом, а не надеждой.
 */
export const CONSTITUTION_TIERS = {
  pro: { name: "Constitution Pro", priceUsd: 9 },
  team: { name: "Constitution Team", priceUsd: 49 },
} as const;

export type ConstitutionTier = keyof typeof CONSTITUTION_TIERS;

/** Подпись с ценой — чтобы её тоже не собирали руками в каждом месте. */
export function constitutionTierLabel(tier: ConstitutionTier): string {
  const t = CONSTITUTION_TIERS[tier];
  return `${t.name} · $${t.priceUsd}/mo`;
}

// Веерные скидки живут отдельным файлом: лестницы — это данные о продажах, а не
// про арифметику счёта, и меняются они чаще формулы.

/** Курсы для отображения на фронте (фиксированные, обновляются вручную). */
export const CURRENCY_RATES: Record<CurrencyCode, { rate: number; symbol: string; label: string }> = {
  USD: { rate: 1, symbol: "$", label: "US Dollar" },
  EUR: { rate: 0.92, symbol: "€", label: "Euro" },
  KZT: { rate: 470, symbol: "₸", label: "Kazakhstani Tenge" },
  RUB: { rate: 92, symbol: "₽", label: "Russian Ruble" },
};

/**
 * Курс валюты, который нельзя увести в NaN.
 *
 * `CURRENCY_RATES[currency]` находит и унаследованное: для "constructor" это
 * функция Object, и `.rate` у неё undefined — смета уходила клиенту БЕЗ ЦИФР
 * (HTTP 200, пустые total и subtotal). Живой прод отвечал так 28.07.2026.
 *
 * Проверка в маршруте /api/pricing/quote уже стоит, и другого вызывающего у
 * buildQuote сегодня нет. Но она стоит ДАЛЕКО от расчёта, а buildQuote
 * экспортирован: следующий вызывающий получит NaN молча. Курс берётся здесь,
 * значит и защита должна жить здесь.
 */
export function currencyRate(currency: string): number {
  return Object.prototype.hasOwnProperty.call(CURRENCY_RATES, currency)
    ? CURRENCY_RATES[currency as CurrencyCode].rate
    : CURRENCY_RATES.USD.rate;
}


/**
 * ЛЕСТНИЦА СРОКОВ — слово основателя 15.09.2026.
 *
 * Тариф называет СРОК доступа, а не набор модулей: любой платный тариф открывает
 * всю планету AEVION, тарифы различаются только сроком и ценой месяца. Оплата —
 * за весь срок вперёд, продление на тот же срок. Иначе Medium превращался бы в
 * «$350 за один месяц и отмена», то есть дешевле Lite за тот же месяц.
 *
 * Та же лестница у каждого приложения, которое продаётся отдельно
 * (STANDALONE_APPS ниже). Документ с обоснованием:
 * Desktop/АЕВИОН/06-Витрина-цены-SEO/2026-09-15-ЦЕНОВАЯ-ПОЛИТИКА-тариф-это-срок.md
 */
export const TERM_TIERS = ["lite", "medium", "pro", "full", "max"] as const;
export type TermTier = (typeof TERM_TIERS)[number];

export const TERM_MONTHS: Record<TermTier, number> = { lite: 1, medium: 3, pro: 6, full: 9, max: 12 };

/** Доля базовой цены месяца на ступени: у планеты это 400 / 350 / 300 / 250 / 200. */
export const TERM_FACTOR: Record<TermTier, number> = { lite: 1, medium: 0.875, pro: 0.75, full: 0.625, max: 0.5 };

export const TERM_NAME: Record<TermTier, string> = { lite: "Lite", medium: "Medium", pro: "Pro", full: "Full", max: "Max" };

/** Цена месяца всей планеты на самом коротком сроке (Lite). */
export const PLANET_BASE_MONTHLY = 400;

export function isTermTier(id: string): id is TermTier {
  return (TERM_TIERS as readonly string[]).includes(id);
}

/**
 * Цена месяца на ступени лестницы.
 *
 * Базы выбраны кратными 8, и на каждой ступени выходят целые доллары. Нецелое
 * число здесь — ошибка ДАННЫХ (кто-то поставил базу не кратной 8), а не повод
 * округлять: округление молча разводит витрину и кассу на центы.
 */
export function termPricePerMonth(base: number, term: TermTier): number {
  const v = base * TERM_FACTOR[term];
  if (!Number.isInteger(v)) throw new Error(`term price is not whole dollars: ${base} x ${TERM_FACTOR[term]}`);
  return v;
}

/** Платёж за весь срок вперёд. */
export function termTotal(base: number, term: TermTier): number {
  return termPricePerMonth(base, term) * TERM_MONTHS[term];
}

/** «3 месяца», «6 месяцев» — для подписей. */
export function monthsLabelRu(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} месяц`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} месяца`;
  return `${n} месяцев`;
}

/**
 * Приложения, которые продаются ОТДЕЛЬНО от планеты. Больше — ничего: каждое
 * лишнее отдельное приложение снижает причину брать планету целиком.
 *
 * `slug` — то, что вебхук пишет в AppSubscription (совпадает с прежними
 * `ip_bureau` и `devhub`, чтобы уже выданные права не потерялись).
 *
 * Проверка «планета выгоднее всегда» — tests/termPricingLadder.test.ts: сумма пяти
 * приложений на любой ступени дороже планеты на той же ступени.
 */
export interface StandaloneApp {
  slug: string;
  moduleId: string;
  name: string;
  baseMonthly: number;
}

export const STANDALONE_APPS: StandaloneApp[] = [
  { slug: "cyberchess", moduleId: "cyberchess", name: "CyberChess", baseMonthly: 24 },
  { slug: "multichat", moduleId: "multichat-engine", name: "Multichat", baseMonthly: 40 },
  { slug: "qventure", moduleId: "qventure", name: "QVenture", baseMonthly: 80 },
  { slug: "ip_bureau", moduleId: "aevion-ip-bureau", name: "IP Bureau", baseMonthly: 80 },
  { slug: "devhub", moduleId: "devhub", name: "DevHub", baseMonthly: 200 },
];

export function standaloneApp(slugOrModuleId: string): StandaloneApp | null {
  return STANDALONE_APPS.find((a) => a.slug === slugOrModuleId || a.moduleId === slugOrModuleId) ?? null;
}

/**
 * Месячная квота токенов одинакова на всех сроках: срок меняет цену месяца, а не
 * объём. Планета работает на моделях Anthropic, и Max за $200/мес стоит столько же,
 * сколько их подписка Max, — без месячного потолка длинный тариф уходит в минус.
 */
const PLANET_LIMITS: TierLimits = {
  modules: null,
  qrightObjectsPerMonth: null,
  qsignOpsPerDay: null,
  llmTokensPerMonth: 50_000_000,
  premiumTokensPerMonth: 5_000_000, // 10% of the overall cap
  seats: 1,
  supportSlaHours: 8,
};

function planetTier(id: TermTier, extra: Partial<PricingTier> = {}): PricingTier {
  const months = TERM_MONTHS[id];
  const perMonth = termPricePerMonth(PLANET_BASE_MONTHLY, id);
  const total = perMonth * months;
  const savingPct = Math.round((1 - TERM_FACTOR[id]) * 1000) / 10;
  return {
    id,
    name: TERM_NAME[id],
    tagline: `Вся планета AEVION на ${monthsLabelRu(months)}`,
    priceMonthly: perMonth,
    termMonths: months,
    priceTermTotal: total,
    features: [
      "Все продукты AEVION в одной подписке",
      "DevHub, Multichat, IP Bureau, CyberChess, QVenture и остальные модули",
      "QCoreAI: 50 000 000 токенов / месяц",
      months === 1 ? `$${total} за месяц` : `$${total} за ${monthsLabelRu(months)} — $${perMonth} в месяц`,
      savingPct > 0 ? `Экономия ${savingPct}% против помесячной оплаты` : "Без обязательств дольше месяца",
      "Приоритетная поддержка (8h SLA)",
    ],
    limits: { ...PLANET_LIMITS },
    ctaLabel: `Выбрать ${TERM_NAME[id]}`,
    ...extra,
  };
}

export const TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Старт без барьеров — для тех, кто только знакомится с AEVION",
    priceMonthly: 0,
    termMonths: null,
    priceTermTotal: 0,
    features: [
      "1 активный модуль на выбор",
      "QRight: до 10 объектов / месяц",
      "QSign: 1 подпись в день",
      "QCoreAI: 100 000 токенов / месяц",
      "Доступ к публичному Globus",
      "Сообщество и базовая документация",
    ],
    limits: {
      modules: 1,
      qrightObjectsPerMonth: 10,
      qsignOpsPerDay: 1,
      llmTokensPerMonth: 100_000,
      premiumTokensPerMonth: null, // tiny overall cap already bounds worst-case exposure
      seats: 1,
      supportSlaHours: null,
    },
    ctaLabel: "Начать бесплатно",
  },
  planetTier("lite"),
  planetTier("medium"),
  planetTier("pro"),
  planetTier("full"),
  planetTier("max", { highlight: true }),
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Для корпораций, банков и государственного сектора",
    priceMonthly: null,
    termMonths: null,
    priceTermTotal: null,
    features: [
      "Выделенная инфраструктура (on-prem / VPC)",
      "SOC2 / ISO27001 пакет (по запросу)",
      "Безлимитные seats и токены",
      "Индивидуальные SLA до 1 часа",
      "Customer Success менеджер",
      "Roadmap-влияние и кастом-фичи",
      "Юридические NDA / DPA / MSA",
    ],
    limits: {
      modules: null,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: null,
      llmTokensPerMonth: null,
      premiumTokensPerMonth: null,
      seats: null,
      supportSlaHours: 1,
    },
    ctaLabel: "Связаться с продажами",
  },
];

/**
 * Per-module add-on прайс. Покупается поверх любого тарифа,
 * если конкретный модуль не входит в `includedIn`.
 */
// includedIn-схема новой модели:
//   - globus              → free + все (публичный портал)
//   - все остальные       → любой платный срок (lite…max) + enterprise:
//     тариф — это срок, а не набор модулей (15.09.2026)
/**
 * Цена надстройки = база лестницы отдельного приложения. Только STANDALONE_APPS:
 * у остальных модулей addonMonthly = null — отдельно они не продаются (15.09.2026).
 */
function appBase(moduleId: string): number {
  const app = standaloneApp(moduleId);
  if (!app) throw new Error(`not a standalone app: ${moduleId}`);
  return app.baseMonthly;
}

export const MODULES_PRICING: ModulePrice[] = [
  // ===== CORE / PLATFORM =====
  {
    id: "globus",
    addonMonthly: 0,
    includedIn: ["free", "lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Центральная карта и портал экосистемы",
  },
  {
    id: "revenue-hub",
    addonMonthly: 0,
    includedIn: ["free", "lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Внутренний модуль монетизации (auth-gated, не plan-gated)",
  },
  {
    id: "ventures",
    addonMonthly: 0,
    includedIn: ["free", "lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Идея-Маркет: витрина бизнес-моделей + венчур AEVIA",
  },
  {
    id: "qcoreai",
    // ~50% below Claude Pro / ChatGPT Plus ($20/mo) as a standalone AI
    // subscription — penetration pricing against single-purpose AI rivals,
    // same logic applied to cyberchess below. See docs/PRICING_STRATEGY_2026-07.md.
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "AI Core Engine: оркестрация агентов и LLM",
  },
  {
    id: "multichat-engine",
    addonMonthly: appBase("multichat-engine"),
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Параллельные подчатики и агенты под задачи",
  },
  {
    id: "qfusionai",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Гибридный движок поверх лучших AI-платформ",
  },

  // ===== IP / LEGAL =====
  {
    id: "qright",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Регистрация цифровых объектов и подтверждение авторства",
  },
  {
    id: "qsign",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Цифровая подпись и проверка целостности",
  },
  {
    id: "aevion-ip-bureau",
    addonMonthly: appBase("aevion-ip-bureau"),
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Электронное бюро авторства + сертификаты",
  },

  // ===== FINTECH =====
  {
    id: "qtradeoffline",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Офлайн-сделки и платежи без интернета",
  },
  {
    id: "qpaynet-embedded",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Платёжное ядро для встраивания",
  },
  {
    id: "qmaskcard",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "on_request",
    oneLiner: "Защищённая банковская карта (PCI-контур)",
  },
  {
    id: "veilnetx",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Privacy-крипто и приватная сеть",
  },

  // ===== CONSUMER PRODUCTS ===== (CyberChess/HealthAI входят в Medium)
  {
    id: "cyberchess",
    // ~50% below chess.com Diamond (~$20/mo monthly billing) — penetration
    // pricing against the direct single-purpose rival while it's still
    // building traction. See docs/PRICING_STRATEGY_2026-07.md.
    addonMonthly: appBase("cyberchess"),
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Шахматная платформа нового поколения",
  },
  {
    id: "healthai",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Персональный AI-доктор (информационно)",
  },
  // ⚠️ ЭТИ ДВЕ ПОЗИЦИИ ПРОДАЮТСЯ ДВАЖДЫ, В РАЗНЫХ ФОРМАХ. Найдено 10.08.2026;
  // на них же указывает информационная строка `npm run audit:projects-pricing`
  // («2 модуля есть в MODULES_PRICING, но не в projects.ts»).
  //
  // Здесь они — ЕЖЕМЕСЯЧНЫЕ add-on'ы: qmelanin $15/мес, qrenew $19/мес.
  // А в каталоге товаров (frontend/src/lib/products.ts, цены сверены с живым
  // дашбордом Gumroad 26.07.2026) те же бренды продаются РАЗОВО: «The Anti-Grey
  // Protocol» $19 (EN, permalink kkiavh) и «Протокол Анти-седина» $9 (RU,
  // tmuyxw) — это PDF-гайды, кнопки на /qrenew и /qmelanin.
  //
  // Для покупателя разница невидима, а цена почти совпадает: добавив qrenew на
  // /pricing, он платит $19 КАЖДЫЙ месяц; купив с /qrenew — $19 ОДИН раз.
  // Ни одна из страниц про это не говорит.
  //
  // Не трогаю: чем должны быть эти два продукта — подпиской или разовым
  // гайдом — это решение об упаковке, а не техническая правка. Когда решение
  // будет, лишнюю форму надо убрать, а не оставлять обе.
  {
    id: "qmelanin",
    name: "QMelanin — протокол против седины",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Протокол против седины: анализы → питание (информационно)",
  },
  {
    id: "qrenew",
    name: "QRenew — клеточное обновление",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Клеточное обновление: биовозраст + стек (информационно)",
  },
  {
    id: "smeta-trainer",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "AI-тренажёр сметного дела РК",
  },
  {
    id: "qai",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "AI-ассистент общего назначения",
  },
  {
    id: "qlearn",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Платформа обучения с AI",
  },
  {
    id: "qnews",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Новости и AI-дайджест",
  },
  {
    id: "qstore",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Маркетплейс цифровых продуктов",
  },
  {
    id: "qmedia",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Медиа-хостинг и стриминг",
  },
  {
    id: "qlife",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Долголетие и анти-эйджинг сценарии",
  },
  {
    id: "qgood",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Психология и ментальное здоровье",
  },
  {
    id: "psyapp-deps",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Выход из зависимостей с поддержкой AI",
  },
  {
    id: "qpersona",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Цифровой аватар и персональный двойник",
  },
  {
    id: "kids-ai-content",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Детский AI-контент на нескольких языках",
  },
  {
    id: "voice-of-earth",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "soon",
    oneLiner: "Контент-сериал «Голос Земли»",
  },

  // ===== MARKETPLACE / NETWORK =====
  {
    id: "qbuild",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Рекрутинг-платформа и ATS",
  },
  {
    id: "startup-exchange",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Маркетплейс защищённых стартап-идей",
  },
  {
    id: "qventure",
    addonMonthly: appBase("qventure"),
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "AI due-diligence: quant-скоринг + совет 4 ролей + стратегия входа",
  },
  {
    // 14.09.2026 цену назначил основатель: $19/мес отдельно и в составе
    // Full и Enterprise — та же форма, что у остальных платных модулей.
    // До этого стояло addonMonthly:null, includedIn:[] (sales-only, PoC), и
    // купить модуль было нельзя ничем. Стены это не включает: qskyway нет в
    // PAYWALL_MODULES (проверено на проде 14.09).
    id: "qskyway",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Провайдер-независимые 3D-аэрокоридоры для аэротакси над цифровым двойником города",
  },
  {
    // Рендер стоит реальных денег ($0.13-0.30/с движка) — модуль платный
    // с первого дня: addon поверх Full, себестоимость×~3 на типовой фильм/мес.
    id: "qreal",
    addonMonthly: null,
    includedIn: ["enterprise"],
    availability: "beta",
    oneLiner: "Полностью живое AI-видео без актёра: бриф → кадры → фильм с QC реализма и провенансом",
  },
  {
    id: "deepsan",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Анти-хаос приложение для продуктивности",
  },
  {
    id: "mapreality",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "soon",
    oneLiner: "Карта реальных потребностей сообществ",
  },
  {
    id: "qevents",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "События, календарь и регистрации",
  },

  // ===== EXPERIMENTAL =====
  {
    id: "z-tide",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Энергия и эмоция как валюта (концепт)",
  },
  {
    id: "qcontract",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Самоуничтожающиеся смарт-документы",
  },
  {
    id: "shadownet",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "soon",
    oneLiner: "Альтернативная приватная сеть (R&D)",
  },
  {
    id: "lifebox",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "Цифровой сейф для будущего",
  },
  {
    id: "constitution",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "AI-конституция и гражданские документы",
  },
  {
    id: "qchaingov",
    addonMonthly: null,
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "beta",
    oneLiner: "DAO-управление экосистемой",
  },
  {
    // DevHub Studio Pro. До 31.08.2026 модуля здесь не было вовсе, и это
    // расходились ДВА наших собственных каталога: на /apps он продаётся
    // ($149/мес, LemonSqueezy, касса отвечает 302 при 404 у выдуманного
    // товара — проверено 31.08.2026), а на /pricing его не существовало.
    // Покупатель, сравнивающий цены на странице с названием «цены», самый
    // дорогой модуль платформы там не находил.
    //
    // Цена и название взяты из frontend/src/lib/products.ts, где они уже
    // приняты и опубликованы, — здесь ничего не решается заново.
    id: "devhub",
    // ЦЕНА ЗДЕСЬ НАМЕРЕННО null, хотя модуль стоит $149/мес на /apps.
    //
    // Положительная цена делает модуль выбираемым в калькуляторе как
    // надстройку (frontend/src/app/pricing/page.tsx фильтрует по
    // addonMonthly > 0), а касса цен считает его через buildQuote. Оплата
    // прошла бы — а доступа человек НЕ получил бы: DevHub определяет тариф
    // только по таблице «почта → тариф» (getUserTierChecked в
    // routes/devhub.ts) и подписку платформы не читает вовсе. Проверено
    // 31.08.2026 чтением обоих путей.
    //
    // То есть цена в этой строке — это кнопка «заплати и не получи».
    // Пока DevHub не признаёт isModuleEntitled(), модуль показывается на
    // /pricing без цены надстройки: человек видит, что он есть и живой, а
    // покупает там, где выдача работает. Связь закреплена сторожем
    // devhubAddonOnlyWhenEntitled в tests/.
    addonMonthly: null,
    // РЕШЕНО ОСНОВАТЕЛЕМ 14.09.2026: DevHub входит в Full; routes/devhub.ts признаёт
    // isModuleEntitled(). Цену надстройки к Lite/Medium основатель НЕ назначал —
    // addonMonthly остаётся null. Текст ниже — след прежнего состояния.
    // ПУСТОЙ намеренно, а не по недосмотру: в какие тарифы DevHub входит
    // bundle-ом — решение о составе пакетов, оно за основателем. Пустой
    // список означает «ни в какой тариф не обещан», то есть мы не обещаем
    // того, чего не решали. Проверено, что на выдачу доступа это не влияет:
    // isModuleEntitled() для full/enterprise возвращает true раньше, чем
    // читает includedIn, а для прочих тарифов прежнее запасное значение
    // ["full","enterprise"] давало ровно тот же ответ — false.
    includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
    availability: "live",
    oneLiner: "Браузерная IDE на движке VS Code: генерация кода и публикация",
    // Модуля НЕТ в data/projects.ts, поэтому имя обязано быть здесь — иначе
    // сработает описанный выше запасной путь и в списке тарифа Lite
    // человек увидит строку вместо названия (замер 20.08.2026, 2 модуля).
    name: "DevHub Studio Pro",
  },
];

/**
 * Промо-коды. Применяются на subtotal сметы.
 * - kind='percent' → скидка в процентах
 * - kind='fixed' → фикс в USD (на monthly — умножается на 12 для annual, см. checkout.ts)
 * - validUntil ISO дата (опционально)
 * - maxUses null = без ограничений (counter не ведём здесь — это GTM-список)
 * - tiers — на каких тарифах применим (пустой массив = на всех платных)
 * - annualOnly — промо применим только при годовой оплате (напр. флагманские
 *   годовые акции). NOTE: fixed-скидка сама умножается на 12 для annual (см.
 *   checkout.ts) — annualOnly НЕ защищает от обнуления тарифа, только
 *   ограничивает период применения. Обнуление предотвращает отдельный
 *   потолок в checkout.ts/buildQuote (не более MAX_PROMO_DISCOUNT_RATIO от
 *   subtotal) — см. там. Найдено 2026-07-23: TEAM100 (−$100 fixed) обнулял
 *   Full целиком в обоих периодах (89 и 890×12=1200 — оба ≥ subtotal) —
 *   баг существовал и до репрайсинга (тоже обнулял monthly Full при старой
 *   цене $49), просто не был замечен раньше.
 */
export interface PromoCode {
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  description: string;
  validUntil?: string;
  tiers?: TierId[];
  maxUses?: number | null;
  annualOnly?: boolean;
}

export const PROMO_CODES: PromoCode[] = [
  {
    code: "AEVION20",
    kind: "percent",
    amount: 20,
    description: "Запуск GTM — 20% на любой платный тариф",
    validUntil: "2026-12-31T23:59:59Z",
  },
  {
    code: "STARTUP50",
    kind: "percent",
    amount: 50,
    description: "Стартапам в первый год — 50% на Lite",
    validUntil: "2026-12-31T23:59:59Z",
    tiers: ["lite"],
  },
  {
    code: "EARLYBIRD",
    kind: "percent",
    amount: 30,
    description: "Ранние пользователи — 30% на любой платный тариф",
    validUntil: "2026-06-30T23:59:59Z",
  },
  {
    code: "FRIEND10",
    kind: "fixed",
    amount: 10,
    description: "Реферальный — $10 в первый месяц",
  },
  {
    code: "TEAM100",
    kind: "fixed",
    amount: 100,
    description: "Команды — до $100 на Full (не более 50% от суммы заказа)",
    tiers: ["full"],
  },
];

/** Сборки модулей со скидкой — для GTM-лендинга. */
// Наборы модулей со скидкой сняты 15.09.2026: любой платный срок открывает все
// модули, а отдельно продаются только STANDALONE_APPS. Набор поверх этого
// стал бы третьей ценой одного и того же доступа.
export const BUNDLES: PricingBundle[] = [];

/** Утилита: получить тариф по id (или null) */
export function getTier(id: string): PricingTier | null {
  return TIERS.find((t) => t.id === id) ?? null;
}

/** Утилита: получить цену модуля по id */
export function getModulePrice(id: string): ModulePrice | null {
  return MODULES_PRICING.find((m) => m.id === id) ?? null;
}

/**
 * Получить активный промо-код по строке. Возвращает null, если код:
 *   - не существует
 *   - истёк (validUntil < now)
 *   - не применим к данному тарифу (tiers задан и tier не входит)
 *   - annualOnly=true, а тариф короче 12 месяцев (не max)
 */
export function resolvePromoCode(
  raw: string | undefined,
  tierId: TierId,
): { promo: PromoCode | null; reason?: string } {
  if (!raw) return { promo: null };
  const code = raw.trim().toUpperCase();
  const promo = PROMO_CODES.find((p) => p.code === code);
  if (!promo) return { promo: null, reason: "promo_not_found" };
  if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
    return { promo: null, reason: "promo_expired" };
  }
  if (promo.annualOnly && tierId !== "max") {
    return { promo: null, reason: "promo_annual_only" };
  }
  if (promo.tiers && promo.tiers.length > 0 && !promo.tiers.includes(tierId)) {
    return { promo: null, reason: "promo_tier_mismatch" };
  }
  return { promo };
}

/**
 * Расчёт сметы: тариф + список модулей + период + кол-во seats.
 * Возвращает { subtotal, discount, total, lines }.
 *
 * Логика:
 *   1. База тарифа (monthly) × 12 × 0.84 если annual.
 *   2. Дополнительные seats × 5 USD (свыше базовых лимитов тарифа, кроме enterprise).
 *   3. Add-on модули, если не входят в includedIn тарифа.
 *   4. Скидка 16% накатывается только на тариф (не на per-seat / add-on).
 */
export interface QuoteLine {
  kind: "tier" | "addon" | "seat" | "bundle";
  label: string;
  unitPrice: number;
  qty: number;
  total: number;
}

export interface AppliedPromo {
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  description: string;
  /** Сумма применённой скидки в выбранной валюте */
  applied: number;
}

export interface Quote {
  tierId: TierId;
  /** Срок тарифа в месяцах; null — free, enterprise, неизвестный тариф. */
  termMonths: number | null;
  currency: CurrencyCode;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string[];
  /** null = промо не применён или невалиден; reason — в notes[] */
  promo: AppliedPromo | null;
  /** Ступени веера, каждая отдельной строкой: за что именно дана скидка. */
  fans: AppliedFan[];
  /** Сколько скидки срезал общий потолок (0 = не срезал). */
  discountCappedBy: number;
}

export function buildQuote(input: {
  tierId: TierId;
  modules?: string[];
  seats?: number;
  currency?: CurrencyCode;
  promoCode?: string;
  /** Срок обязательства в месяцах: 24 и 36 дают ступень веера. */
  commitmentMonths?: number;
}): Quote {
  const termMonths = getTier(input.tierId)?.termMonths ?? null;
  const months = termMonths ?? 1;
  const currency: CurrencyCode = input.currency ?? "USD";
  const seats = Math.max(1, input.seats ?? 1);
  const tier = getTier(input.tierId);
  const lines: QuoteLine[] = [];
  const notes: string[] = [];

  if (!tier) {
    return {
      tierId: input.tierId,
      termMonths,
      currency,
      lines: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      notes: [`Tier "${input.tierId}" not found`],
      promo: null,
      fans: [],
      discountCappedBy: 0,
    };
  }

  // 1) База
  const tierMonthly = tier.priceMonthly ?? 0;
  if (tier.id === "enterprise") {
    notes.push("Enterprise — итоговая цена согласовывается отдельно");
  } else if (tierMonthly > 0) {
    lines.push({
      kind: "tier",
      label: `Тариф ${tier.name} — ${monthsLabelRu(months)} вперёд`,
      unitPrice: tierMonthly,
      qty: months,
      total: tierMonthly * months,
    });
  }

  // 2) Доп seats (поверх базовых лимитов тарифа). Свыше — $5/seat/мес
  const baseSeats = tier.limits.seats ?? 1;
  const extraSeats = Math.max(0, seats - baseSeats);
  if (extraSeats > 0 && tier.id !== "enterprise") {
    lines.push({
      kind: "seat",
      label: `Дополнительные пользователи (${extraSeats} × $5/мес)`,
      unitPrice: 5,
      qty: extraSeats * months,
      total: extraSeats * 5 * months,
    });
  }

  // 3) Add-on модули.
  //
  // Lite = «1 продукт на выбор» с полным доступом к нему. Модуль(и), покрытые
  // module-лимитом Lite, НЕ тарифицируются как add-on — иначе двойной счёт
  // (Lite + qsign дал бы $19 + $9 = $28 вместо $19). Логика зеркалит
  // routes/checkout.ts, чтобы quote == итоговый charge.
  const freeChoiceSlots = tier.id === "lite" ? (tier.limits.modules ?? 0) : 0;
  let usedChoiceSlots = 0;
  // ОДИН МОДУЛЬ ТАРИФИЦИРУЕТСЯ ОДИН РАЗ.
  //
  // Замер 04.09.2026: lite [qsign] стоил $19, а lite [qsign, qsign] — $28,
  // ровно столько же, сколько за два РАЗНЫХ модуля. То есть повтор в списке
  // продавался как второй продукт, хотя это тот же самый. Список приходит из
  // тела запроса и ничем не ограничен (`routes/checkout.ts`), поэтому
  // достаточно, чтобы он собрался с повтором — например, при восстановлении
  // выбора или двойном нажатии.
  //
  // Инвариант принадлежит РАСЧЁТУ, а не вызывающим: иначе каждый новый
  // вызывающий обязан помнить о нём сам, а забывший продаст повтор снова.
  // Заодно это выравнивает расчёт с записью: `lib/payment/customData`
  // отбрасывает повторы, и без дедупликации здесь мы брали бы деньги за
  // два, а записывали один.
  const модулиБезПовторов = Array.from(new Set(input.modules ?? []));
  for (const mid of модулиБезПовторов) {
    const m = getModulePrice(mid);
    if (!m) {
      notes.push(`Модуль "${mid}" не найден`);
      continue;
    }
    if (m.includedIn.includes(tier.id)) continue; // уже в тарифе
    if (usedChoiceSlots < freeChoiceSlots) {
      usedChoiceSlots++;
      notes.push(`Модуль ${m.id} включён в Lite (1 продукт на выбор)`);
      continue;
    }
    if (m.addonMonthly === null) {
      notes.push(`Модуль "${mid}" доступен только по запросу (Enterprise / Sales)`);
      continue;
    }
    if (m.addonMonthly === 0) continue;
    lines.push({
      kind: "addon",
      label: `Модуль ${m.id}`,
      unitPrice: m.addonMonthly,
      qty: months,
      total: m.addonMonthly * months,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  // 4) Отдельной «годовой» скидки больше нет (15.09.2026): выгода длинного срока
  //    уже в цене месяца на лестнице (TERM_FACTOR), вторая скидка удвоила бы её.
  let discount = 0;

  // 5) Веер: ступени за объём модулей, мест и срок обязательства. Считается
  //    ПОСЛЕ годовой скидки и ДО промо-кода: годовая — свойство тарифа, веер —
  //    награда за объём, промо — разовый повод. Каждая ступень возвращается
  //    отдельной строкой, чтобы покупатель видел, за что именно ему скидка.
  const moduleLines = lines.filter((l) => l.kind === "addon");
  const seatLines = lines.filter((l) => l.kind === "seat");
  const fans = computeFan({
    modulesUsd: moduleLines.reduce((x, l) => x + l.total, 0),
    moduleCount: moduleLines.length,
    seatsUsd: seatLines.reduce((x, l) => x + l.total, 0),
    seatCount: seats,
    commitmentMonths: input.commitmentMonths,
    subtotalUsd: subtotal,
  });
  const fanUsd = fanTotalUsd(fans);
  discount += fanUsd;

  // 6) Промо-код применяется на (subtotal - discount)
  let promoApplied: AppliedPromo | null = null;
  let promoUsd = 0;
  if (input.promoCode) {
    const { promo, reason } = resolvePromoCode(input.promoCode, tier.id);
    if (promo) {
      const base = Math.max(0, subtotal - discount);
      const rawPromoUsd =
        promo.kind === "percent"
          ? Math.round((base * promo.amount) / 100)
          : Math.min(base, promo.amount * months);
      promoUsd = Math.min(rawPromoUsd, base * MAX_PROMO_DISCOUNT_RATIO);
      const rate = currencyRate(currency);
      promoApplied = {
        code: promo.code,
        kind: promo.kind,
        amount: promo.amount,
        description: promo.description,
        applied: Math.round(promoUsd * rate * 100) / 100,
      };
    } else {
      const map: Record<string, string> = {
        promo_not_found: "Промо-код не найден",
        promo_expired: "Промо-код истёк",
        promo_tier_mismatch: "Промо-код не применим к этому тарифу",
      };
      notes.push(map[reason ?? ""] ?? `Промо-код невалиден: ${input.promoCode}`);
    }
  }

  // 7) Потолок на СУММУ всех скидок. Каждая ступень по отдельности выглядит
  //    скромно, а вместе с промо-кодом они способны отдать товар почти даром —
  //    и по одной цифре итога это не заметить.
  const capped = capTotalDiscount(subtotal, discount + promoUsd);
  const totalUSD = Math.max(0, subtotal - capped.applied);
  if (capped.cappedBy > 0) {
    notes.push(`Скидки срезаны потолком: −$${capped.cappedBy} сверх допустимого`);
  }
  const rate = currencyRate(currency);

  return {
    tierId: tier.id,
    termMonths,
    currency,
    lines: lines.map((l) => ({
      ...l,
      unitPrice: Math.round(l.unitPrice * rate * 100) / 100,
      total: Math.round(l.total * rate * 100) / 100,
    })),
    subtotal: Math.round(subtotal * rate * 100) / 100,
    discount: Math.round(capped.applied * rate * 100) / 100,
    total: Math.round(totalUSD * rate * 100) / 100,
    notes,
    promo: promoApplied,
    fans: fans.map((f) => ({
      ...f,
      baseUsd: Math.round(f.baseUsd * rate * 100) / 100,
      amountUsd: Math.round(f.amountUsd * rate * 100) / 100,
    })),
    discountCappedBy: Math.round(capped.cappedBy * rate * 100) / 100,
  };
}
