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
 * Публичные тарифы: free / lite / medium / full / enterprise.
 *   - lite   = 1 любой продукт на выбор ($19)
 *   - medium = куратор-бандл готовых апп ($29)
 *   - full   = все продукты ($49)
 * Годовая оплата = -2 месяца (×10).
 *
 * `pro` / `business` — DEPRECATED legacy-алиасы. Оставлены в union, чтобы
 * мёртвые провайдеры (paddle.ts, lemonSqueezyWebhook.ts) и старые Gumroad-ссылки
 * продолжали компилироваться. В публичном списке TIERS их нет. Маппинг при
 * провижининге: pro → lite, business → full.
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
  /** Кол-во QRight-объектов / месяц */
  qrightObjectsPerMonth: number | null;
  /** Кол-во QSign-операций / день */
  qsignOpsPerDay: number | null;
  /** LLM-токены / месяц (QCoreAI / Multichat) */
  llmTokensPerMonth: number | null;
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

/** Курсы для отображения на фронте (фиксированные, обновляются вручную). */
export const CURRENCY_RATES: Record<CurrencyCode, { rate: number; symbol: string; label: string }> = {
  USD: { rate: 1, symbol: "$", label: "US Dollar" },
  EUR: { rate: 0.92, symbol: "€", label: "Euro" },
  KZT: { rate: 470, symbol: "₸", label: "Kazakhstani Tenge" },
  RUB: { rate: 92, symbol: "₽", label: "Russian Ruble" },
};

/** Годовая сумма = -2 месяца (платишь за 10, получаешь 12). */
const annualTotal = (m: number) => m * 10;
/** Эффективная цена/мес при годовой оплате. */
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
      seats: 1,
      supportSlaHours: 8,
    },
    ctaLabel: "Получить всё",
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
    id: "qcoreai",
    addonMonthly: 29,
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
    addonMonthly: 19,
    includedIn: ["full", "enterprise"],
    availability: "live",
    oneLiner: "Электронное патентное бюро + сертификаты",
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
    addonMonthly: 49,
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
  {
    id: "smeta-trainer",
    addonMonthly: 19,
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
];

/**
 * Промо-коды. Применяются на subtotal сметы.
 * - kind='percent' → скидка в процентах
 * - kind='fixed' → фикс в USD
 * - validUntil ISO дата (опционально)
 * - maxUses null = без ограничений (counter не ведём здесь — это GTM-список)
 * - tiers — на каких тарифах применим (пустой массив = на всех платных)
 */
export interface PromoCode {
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  description: string;
  validUntil?: string;
  tiers?: TierId[];
  maxUses?: number | null;
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
    description: "Команды — $100 на Full",
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
    savingsPercent: 20,
  },
  {
    id: "ai-suite",
    name: "AI Suite",
    description: "QCoreAI + Multichat + Kids AI — единая AI-платформа",
    modules: ["qcoreai", "multichat-engine", "kids-ai-content"],
    priceMonthly: 49,
    savingsPercent: 12,
  },
  {
    id: "fintech-suite",
    name: "Fintech Suite",
    description: "QTradeOffline + QPayNet + QContract — финансовый стек",
    modules: ["qtradeoffline", "qpaynet-embedded", "qcontract"],
    priceMonthly: 79,
    savingsPercent: 8,
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
}

export function buildQuote(input: {
  tierId: TierId;
  modules?: string[];
  seats?: number;
  period?: BillingPeriod;
  currency?: CurrencyCode;
  promoCode?: string;
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

  // 5) Промо-код применяется на (subtotal - discount)
  let promoApplied: AppliedPromo | null = null;
  let promoUsd = 0;
  if (input.promoCode) {
    const { promo, reason } = resolvePromoCode(input.promoCode, tier.id);
    if (promo) {
      const base = Math.max(0, subtotal - discount);
      promoUsd =
        promo.kind === "percent"
          ? Math.round((base * promo.amount) / 100)
          : Math.min(base, promo.amount * (period === "annual" ? 12 : 1));
      const rate = CURRENCY_RATES[currency].rate;
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

  const totalUSD = Math.max(0, subtotal - discount - promoUsd);
  const rate = CURRENCY_RATES[currency].rate;

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
    discount: Math.round((discount + promoUsd) * rate * 100) / 100,
    total: Math.round(totalUSD * rate * 100) / 100,
    notes,
    promo: promoApplied,
  };
}
