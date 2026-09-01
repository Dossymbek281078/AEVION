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

export type BillingPeriod = "monthly" | "annual";

/**
 * Публичные тарифы: free / lite / medium / full / pro / enterprise.
 *   - lite   = 1 любой продукт на выбор ($19)
 *   - medium = куратор-бандл готовых апп ($29)
 *   - full   = все продукты ($49)
 *   - pro    = "Universe" — флагман, все продукты + расширенные лимиты ($149)
 * Годовая оплата = -2 месяца (×10).
 *
 * Числа здесь — ПЕРЕСКАЗ значений из TIERS ниже, и 13.08.2026 они разошлись:
 * цены снизили ($24/$39/$89/$249.99 → $19/$29/$49/$149), а шапку не тронули.
 * Живут они в `priceMonthly` каждого тарифа; если правите цену — правьте и эти
 * четыре числа, либо не пишите их здесь вовсе.
 *
 * Репрайсинг 2026-07-22 (см. docs/PRICING_STRATEGY_2026-07.md): платформенные
 * тарифы подняты так, чтобы Universe/Full/Medium стоили выше эквивалентной
 * одиночной AI-подписки (Claude Pro/Max, ChatGPT Plus/Pro) — AEVION даёт
 * несравнимо больше ценности одной подпиской. Отдельные же продукты с прямым
 * конкурентом (cyberchess, qcoreai-addon — см. MODULES_PRICING ниже) идут
 * ПРОТИВОПОЛОЖНЫМ курсом: ~50% ниже своего конкурента, чтобы отвоёвывать
 * пользователей поштучно, пока монетизация всей платформы идёт через bundle.
 *
 * `pro` ЖИВОЙ публичный тариф (id "pro", имя "Universe") — есть в TIERS ниже,
 * реально продаётся через checkout.ts, попадает в /pricing/[tierId]. Раньше
 * был deprecated-заглушкой без объекта тарифа, отсюда старое допущение "не в
 * публичном TIERS" — но объект давно добавлен, а комментарий не обновили.
 * Для гейтинга модулей normalizeTier() в lib/planGate.ts маппит его в `full`
 * (не в `lite` — это была реальная ошибка: $149.99-клиент получал бы доступ
 * уровня $19-Lite; исправлено 2026-07-22).
 *
 * `business` — DEPRECATED legacy-алиас без собственного объекта тарифа.
 * Оставлен в union, чтобы старые Gumroad-ссылки/вебхуки (provisioning.ts)
 * продолжали компилироваться. В TIERS его нет. Маппинг при провижининге:
 * business → full.
 */
export type TierId = "free" | "lite" | "medium" | "full" | "enterprise" | "pro" | "business";

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
  /** Цена в USD/мес при monthly. Для enterprise — null (по запросу). */
  priceMonthly: number | null;
  /** Эффективная цена/мес при annual (-16%). null для free и enterprise. */
  priceAnnualPerMonth: number | null;
  /** Полная сумма annual (12 × priceAnnualPerMonth, если есть). */
  priceAnnualTotal: number | null;
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


/** Годовая сумма = -2 месяца (платишь за 10, получаешь 12). */
const annualTotal = (m: number) => m * 10;
/**
 * Эффективная цена/мес при годовой оплате.
 *
 * ВАЖНО: аргумент здесь и у annualTotal — ОДНА И ТА ЖЕ месячная цена. 13.08.2026
 * цены снизили ($24/$39/$89/$249.99 → $19/$29/$49/$149), поправили priceMonthly
 * и annualTotal, а здесь остались старые числа — и каждый годовой план стал
 * выглядеть ДОРОЖЕ месячного: Lite показывал $20/мес при месячной цене $19,
 * Universe — $208 при $149. Та же карточка рядом обещала «2 месяца в подарок»
 * и «$190 в год», то есть противоречила сама себе тремя числами.
 * Сторож в tests/singlePriceSource.test.ts теперь этого не пропустит.
 */
const annualPerMonth = (m: number) => Math.round((m * 10) / 12);

export const TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Старт без барьеров — для тех, кто только знакомится с AEVION",
    priceMonthly: 0,
    priceAnnualPerMonth: 0,
    priceAnnualTotal: 0,
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
  {
    id: "lite",
    name: "Lite",
    tagline: "Один продукт AEVION на твой выбор",
    priceMonthly: 19,
    priceAnnualPerMonth: annualPerMonth(19),
    priceAnnualTotal: annualTotal(19),
    features: [
      "1 любой продукт AEVION на выбор",
      "Полный доступ к выбранному продукту",
      "QCoreAI: 2 000 000 токенов / месяц",
      "Сменить выбранный продукт — в кабинете",
      "Email-поддержка (24h SLA)",
      "Годовая оплата — 2 месяца в подарок",
    ],
    limits: {
      modules: 1,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: 25,
      llmTokensPerMonth: 2_000_000,
      premiumTokensPerMonth: 200_000, // 10% of the overall cap
      seats: 1,
      supportSlaHours: 24,
    },
    ctaLabel: "Выбрать Lite",
  },
  {
    id: "medium",
    name: "Medium",
    tagline: "Бандл готовых продуктов AEVION",
    priceMonthly: 29,
    priceAnnualPerMonth: annualPerMonth(29),
    priceAnnualTotal: annualTotal(29),
    features: [
      "10 готовых продуктов AEVION в одной подписке",
      "CyberChess, HealthAI, Multichat, QCoreAI, Smeta",
      "QAI, QLearn, QNews, QStore, QMedia",
      "QCoreAI: 10 000 000 токенов / месяц",
      "Email-поддержка (24h SLA)",
      "Годовая оплата — 2 месяца в подарок",
    ],
    limits: {
      modules: MEDIUM_BUNDLE.length,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: 100,
      llmTokensPerMonth: 10_000_000,
      premiumTokensPerMonth: 1_000_000, // 10% of the overall cap
      seats: 1,
      supportSlaHours: 24,
    },
    ctaLabel: "Перейти на Medium",
    highlight: true,
  },
  {
    id: "full",
    name: "Full",
    tagline: "Вся экосистема AEVION без ограничений",
    priceMonthly: 49,
    priceAnnualPerMonth: annualPerMonth(49),
    priceAnnualTotal: annualTotal(49),
    features: [
      "Все продукты AEVION (30+)",
      "QRight + QSign + IP Bureau (полный доступ)",
      "Финтех-стек: QTrade, QPayNet, QContract",
      "QCoreAI: 50 000 000 токенов / месяц",
      "Multichat Engine с агентами",
      "Приоритетная поддержка (8h SLA)",
      "Годовая оплата — 2 месяца в подарок",
    ],
    limits: {
      modules: null,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: null,
      llmTokensPerMonth: 50_000_000,
      premiumTokensPerMonth: 5_000_000, // 10% of the overall cap
      seats: 1,
      supportSlaHours: 8,
    },
    ctaLabel: "Получить всё",
  },
  {
    id: "pro",
    name: "Universe",
    tagline: "Всё AEVION в одном месте — флагман экосистемы (Apple-style)",
    priceMonthly: 149,
    priceAnnualPerMonth: annualPerMonth(149),
    priceAnnualTotal: annualTotal(149),
    features: [
      "Всё из Full + приоритетный доступ ко всем новым модулям",
      "QCoreAI: 200 000 000 токенов / месяц",
      "AEVION Agent — одно окно: текст или действие",
      "Оффлайн/локальные модели (приватность, $0 за токены)",
      "Ранний доступ к site-builder и агентским фичам",
      "Приоритетная поддержка (6h SLA)",
      "Больше, чем один любой AI-сервис на максимальном тарифе — потому что тут вся платформа AEVION, а не один продукт",
    ],
    limits: {
      modules: null,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: null,
      llmTokensPerMonth: 200_000_000,
      premiumTokensPerMonth: 20_000_000, // 10% of the overall cap
      seats: 1,
      supportSlaHours: 6,
    },
    ctaLabel: "Занять место во вселенной",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Для корпораций, банков и государственного сектора",
    priceMonthly: null,
    priceAnnualPerMonth: null,
    priceAnnualTotal: null,
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
//   - MEDIUM_BUNDLE (10)  → medium + full + enterprise
//   - все остальные       → full + enterprise (Full = вся экосистема)
//   - lite не перечисляется: это «1 любой на выбор», доступ хранится в подписке
export const MODULES_PRICING: ModulePrice[] = [
  // ===== CORE / PLATFORM =====
  {
    id: "globus",
    addonMonthly: 0,
    includedIn: ["free", "lite", "medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Центральная карта и портал экосистемы",
  },
  {
    id: "revenue-hub",
    addonMonthly: 0,
    includedIn: ["free", "lite", "medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Внутренний модуль монетизации (auth-gated, не plan-gated)",
  },
  {
    id: "ventures",
    addonMonthly: 0,
    includedIn: ["free", "lite", "medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Идея-Маркет: витрина бизнес-моделей + венчур AEVIA",
  },
  {
    id: "qcoreai",
    // ~50% below Claude Pro / ChatGPT Plus ($20/mo) as a standalone AI
    // subscription — penetration pricing against single-purpose AI rivals,
    // same logic applied to cyberchess below. See docs/PRICING_STRATEGY_2026-07.md.
    addonMonthly: 9.99,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "AI Core Engine: оркестрация агентов и LLM",
  },
  {
    id: "multichat-engine",
    addonMonthly: 19,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Параллельные подчатики и агенты под задачи",
  },
  {
    id: "qfusionai",
    addonMonthly: 29,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Гибридный движок поверх лучших AI-платформ",
  },

  // ===== IP / LEGAL =====
  {
    id: "qright",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "Регистрация цифровых объектов и подтверждение авторства",
  },
  {
    id: "qsign",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "Цифровая подпись и проверка целостности",
  },
  {
    id: "aevion-ip-bureau",
    addonMonthly: 29,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "Электронное бюро авторства + сертификаты",
  },

  // ===== FINTECH =====
  {
    id: "qtradeoffline",
    addonMonthly: 15,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Офлайн-сделки и платежи без интернета",
  },
  {
    id: "qpaynet-embedded",
    addonMonthly: 29,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Платёжное ядро для встраивания",
  },
  {
    id: "qmaskcard",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
    availability: "on_request",
    oneLiner: "Защищённая банковская карта (PCI-контур)",
  },
  {
    id: "veilnetx",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Privacy-крипто и приватная сеть",
  },

  // ===== CONSUMER PRODUCTS ===== (CyberChess/HealthAI входят в Medium)
  {
    id: "cyberchess",
    // ~50% below chess.com Diamond (~$20/mo monthly billing) — penetration
    // pricing against the direct single-purpose rival while it's still
    // building traction. See docs/PRICING_STRATEGY_2026-07.md.
    addonMonthly: 19,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Шахматная платформа нового поколения",
  },
  {
    id: "healthai",
    addonMonthly: 19,
    includedIn: ["medium", "full", "enterprise"],
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
    addonMonthly: 15,
    includedIn: ["medium", "full", "enterprise"],
    availability: "beta",
    oneLiner: "Протокол против седины: анализы → питание (информационно)",
  },
  {
    id: "qrenew",
    name: "QRenew — клеточное обновление",
    addonMonthly: 29,
    includedIn: ["medium", "full", "enterprise"],
    availability: "beta",
    oneLiner: "Клеточное обновление: биовозраст + стек (информационно)",
  },
  {
    id: "smeta-trainer",
    addonMonthly: 49,
    includedIn: ["medium", "full", "enterprise"],
    availability: "beta",
    oneLiner: "AI-тренажёр сметного дела РК",
  },
  {
    id: "qai",
    addonMonthly: 19,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "AI-ассистент общего назначения",
  },
  {
    id: "qlearn",
    addonMonthly: 15,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Платформа обучения с AI",
  },
  {
    id: "qnews",
    addonMonthly: 9,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Новости и AI-дайджест",
  },
  {
    id: "qstore",
    addonMonthly: 15,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Маркетплейс цифровых продуктов",
  },
  {
    id: "qmedia",
    addonMonthly: 15,
    includedIn: ["medium", "full", "enterprise"],
    availability: "live",
    oneLiner: "Медиа-хостинг и стриминг",
  },
  {
    id: "qlife",
    addonMonthly: 19,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Долголетие и анти-эйджинг сценарии",
  },
  {
    id: "qgood",
    addonMonthly: 15,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Психология и ментальное здоровье",
  },
  {
    id: "psyapp-deps",
    addonMonthly: 19,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Выход из зависимостей с поддержкой AI",
  },
  {
    id: "qpersona",
    addonMonthly: 29,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Цифровой аватар и персональный двойник",
  },
  {
    id: "kids-ai-content",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Детский AI-контент на нескольких языках",
  },
  {
    id: "voice-of-earth",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
    availability: "soon",
    oneLiner: "Контент-сериал «Голос Земли»",
  },

  // ===== MARKETPLACE / NETWORK =====
  {
    id: "qbuild",
    addonMonthly: 19,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "Рекрутинг-платформа и ATS",
  },
  {
    id: "startup-exchange",
    addonMonthly: 29,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Маркетплейс защищённых стартап-идей",
  },
  {
    id: "qventure",
    addonMonthly: 39,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "AI due-diligence: quant-скоринг + совет 4 ролей + стратегия входа",
  },
  {
    // Явная строка = поведение как у fallthrough planGate (full+enterprise),
    // ничего не меняет в доступе. addonMonthly:null (sales-only, PoC — не à-la-carte),
    // как у соседей veilnetx/qchaingov/z-tide. Закрывает audit:projects-pricing.
    id: "qskyway",
    addonMonthly: null,
    includedIn: [],
    availability: "beta",
    oneLiner: "Провайдер-независимые 3D-аэрокоридоры для аэротакси над цифровым двойником города",
  },
  {
    // Рендер стоит реальных денег ($0.13-0.30/с движка) — модуль платный
    // с первого дня: addon поверх Full, себестоимость×~3 на типовой фильм/мес.
    id: "qreal",
    addonMonthly: 29,
    includedIn: ["enterprise"],
    availability: "beta",
    oneLiner: "Полностью живое AI-видео без актёра: бриф → кадры → фильм с QC реализма и провенансом",
  },
  {
    id: "deepsan",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Анти-хаос приложение для продуктивности",
  },
  {
    id: "mapreality",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
    availability: "soon",
    oneLiner: "Карта реальных потребностей сообществ",
  },
  {
    id: "qevents",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "События, календарь и регистрации",
  },

  // ===== EXPERIMENTAL =====
  {
    id: "z-tide",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Энергия и эмоция как валюта (концепт)",
  },
  {
    id: "qcontract",
    addonMonthly: 19,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Самоуничтожающиеся смарт-документы",
  },
  {
    id: "shadownet",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
    availability: "soon",
    oneLiner: "Альтернативная приватная сеть (R&D)",
  },
  {
    id: "lifebox",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "beta",
    oneLiner: "Цифровой сейф для будущего",
  },
  {
    id: "constitution",
    addonMonthly: 9,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "AI-конституция и гражданские документы",
  },
  {
    id: "qchaingov",
    addonMonthly: null,
    includedIn: ["full", "enterprise"],
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
    // ПУСТОЙ намеренно, а не по недосмотру: в какие тарифы DevHub входит
    // bundle-ом — решение о составе пакетов, оно за основателем. Пустой
    // список означает «ни в какой тариф не обещан», то есть мы не обещаем
    // того, чего не решали. Проверено, что на выдачу доступа это не влияет:
    // isModuleEntitled() для full/enterprise возвращает true раньше, чем
    // читает includedIn, а для прочих тарифов прежнее запасное значение
    // ["full","enterprise"] давало ровно тот же ответ — false.
    includedIn: [],
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
export const BUNDLES: PricingBundle[] = [
  {
    id: "ip-suite",
    name: "IP Suite",
    description: "QRight + QSign + IP Bureau — полный контур цифровой собственности",
    modules: ["qright", "qsign", "aevion-ip-bureau"],
    priceMonthly: 29,
    // Пересчитано 14.08.2026 после сведения цены IP Bureau с кассой ($19 -> $29):
    // по частям стало $47, значит скидка на деле 38%, а не 20%.
    savingsPercent: 38,
  },
  {
    id: "ai-suite",
    name: "AI Suite",
    description: "QCoreAI + Multichat + Kids AI — единая AI-платформа",
    modules: ["qcoreai", "multichat-engine", "kids-ai-content"],
    // Recomputed 2026-07-22 after qcoreai's addonMonthly dropped to 9.99:
    // components now sum to 37.99 (9.99 + 19 + 9); 33 keeps a genuine ~13% bundle discount.
    priceMonthly: 33,
    savingsPercent: 13,
  },
  {
    id: "fintech-suite",
    name: "Fintech Suite",
    description: "QTradeOffline + QPayNet + QContract — финансовый стек",
    modules: ["qtradeoffline", "qpaynet-embedded", "qcontract"],
    // 14.08.2026: было $79 при заявленных -8%. К этому моменту цены свелись к
    // кассе (qpaynet $49 -> $29), и по частям стек стал стоить $63 — то есть
    // "скидка" превратилась в НАЦЕНКУ +25%. Хуже того, тариф Full за $49 прямо
    // перечисляет "Финтех-стек: QTrade, QPayNet, QContract", то есть сборка за
    // $79 давала МЕНЬШЕ за БОЛЬШЕ. Сборка обязана быть дешевле тарифа, который
    // её содержит, иначе это предложение, которое нельзя выбрать разумно.
    priceMonthly: 39,
    savingsPercent: 38,
  },
];

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
 *   - annualOnly=true, а period !== "annual"
 */
export function resolvePromoCode(
  raw: string | undefined,
  tierId: TierId,
  period: BillingPeriod = "monthly",
): { promo: PromoCode | null; reason?: string } {
  if (!raw) return { promo: null };
  const code = raw.trim().toUpperCase();
  const promo = PROMO_CODES.find((p) => p.code === code);
  if (!promo) return { promo: null, reason: "promo_not_found" };
  if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
    return { promo: null, reason: "promo_expired" };
  }
  if (promo.annualOnly && period !== "annual") {
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
  period: BillingPeriod;
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
  period?: BillingPeriod;
  currency?: CurrencyCode;
  promoCode?: string;
  /** Срок обязательства в месяцах: 24 и 36 дают ступень веера. */
  commitmentMonths?: number;
}): Quote {
  const period: BillingPeriod = input.period ?? "monthly";
  const currency: CurrencyCode = input.currency ?? "USD";
  const seats = Math.max(1, input.seats ?? 1);
  const tier = getTier(input.tierId);
  const lines: QuoteLine[] = [];
  const notes: string[] = [];

  if (!tier) {
    return {
      tierId: input.tierId,
      period,
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
      label: `Тариф ${tier.name} (${period === "annual" ? "годовая" : "месячная"} оплата)`,
      unitPrice: tierMonthly,
      qty: period === "annual" ? 12 : 1,
      total: period === "annual" ? tierMonthly * 12 : tierMonthly,
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
      qty: extraSeats * (period === "annual" ? 12 : 1),
      total: extraSeats * 5 * (period === "annual" ? 12 : 1),
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
  for (const mid of input.modules ?? []) {
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
      qty: period === "annual" ? 12 : 1,
      total: m.addonMonthly * (period === "annual" ? 12 : 1),
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  // 4) Годовая скидка = -2 месяца на тариф (не на seat/addon).
  //    tierLine.total = monthly × 12; priceAnnualTotal = monthly × 10 → скидка = 2 месяца.
  let discount = 0;
  if (period === "annual" && tier.id !== "enterprise") {
    const tierLine = lines.find((l) => l.kind === "tier");
    if (tierLine && tier.priceAnnualTotal != null) {
      discount = Math.max(0, tierLine.total - tier.priceAnnualTotal);
    }
  }

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
    const { promo, reason } = resolvePromoCode(input.promoCode, tier.id, period);
    if (promo) {
      const base = Math.max(0, subtotal - discount);
      const rawPromoUsd =
        promo.kind === "percent"
          ? Math.round((base * promo.amount) / 100)
          : Math.min(base, promo.amount * (period === "annual" ? 12 : 1));
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
    period,
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
