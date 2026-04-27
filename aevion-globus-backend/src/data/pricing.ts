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

export type TierId = "free" | "pro" | "business" | "enterprise";

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

const annual = (m: number) => Math.round(m * 12 * 0.84); // -16% годовая скидка

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
    id: "pro",
    name: "Pro",
    tagline: "Для индивидуальных создателей и фрилансеров",
    priceMonthly: 19,
    priceAnnualPerMonth: Math.round((19 * 12 * 0.84) / 12),
    priceAnnualTotal: annual(19),
    features: [
      "До 5 модулей в подписке",
      "QRight: безлимит объектов",
      "QSign: 50 операций / день",
      "QCoreAI: 5 000 000 токенов / месяц",
      "AEVION IP Bureau базовый",
      "Email-поддержка (24h SLA)",
    ],
    limits: {
      modules: 5,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: 50,
      llmTokensPerMonth: 5_000_000,
      seats: 1,
      supportSlaHours: 24,
    },
    ctaLabel: "Перейти на Pro",
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    tagline: "Для команд и продуктовых студий",
    priceMonthly: 99,
    priceAnnualPerMonth: Math.round((99 * 12 * 0.84) / 12),
    priceAnnualTotal: annual(99),
    features: [
      "Все 27 модулей AEVION",
      "QRight + IP Bureau (полный доступ)",
      "QSign: безлимит",
      "QCoreAI: 50 000 000 токенов / месяц",
      "Multichat Engine с агентами",
      "До 5 пользователей (seats)",
      "Командные роли и аудит-лог",
      "Приоритетная поддержка (8h SLA)",
    ],
    limits: {
      modules: null,
      qrightObjectsPerMonth: null,
      qsignOpsPerDay: null,
      llmTokensPerMonth: 50_000_000,
      seats: 5,
      supportSlaHours: 8,
    },
    ctaLabel: "Купить Business",
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
export const MODULES_PRICING: ModulePrice[] = [
  // ===== CORE / PLATFORM =====
  {
    id: "globus",
    addonMonthly: 0,
    includedIn: ["free", "pro", "business", "enterprise"],
    availability: "live",
    oneLiner: "Центральная карта и портал экосистемы",
  },
  {
    id: "qcoreai",
    addonMonthly: 29,
    includedIn: ["business", "enterprise"],
    availability: "beta",
    oneLiner: "AI Core Engine: оркестрация агентов и LLM",
  },
  {
    id: "multichat-engine",
    addonMonthly: 19,
    includedIn: ["business", "enterprise"],
    availability: "soon",
    oneLiner: "Параллельные подчатики и агенты под задачи",
  },
  {
    id: "qfusionai",
    addonMonthly: null,
    includedIn: ["enterprise"],
    availability: "on_request",
    oneLiner: "Гибридный движок поверх лучших AI-платформ",
  },

  // ===== IP / LEGAL =====
  {
    id: "qright",
    addonMonthly: 9,
    includedIn: ["pro", "business", "enterprise"],
    availability: "live",
    oneLiner: "Регистрация цифровых объектов и подтверждение авторства",
  },
  {
    id: "qsign",
    addonMonthly: 9,
    includedIn: ["pro", "business", "enterprise"],
    availability: "live",
    oneLiner: "Цифровая подпись и проверка целостности",
  },
  {
    id: "aevion-ip-bureau",
    addonMonthly: 19,
    includedIn: ["business", "enterprise"],
    availability: "live",
    oneLiner: "Электронное патентное бюро + сертификаты",
  },

  // ===== FINTECH =====
  {
    id: "qtradeoffline",
    addonMonthly: 15,
    includedIn: ["business", "enterprise"],
    availability: "beta",
    oneLiner: "Офлайн-сделки и платежи без интернета",
  },
  {
    id: "qpaynet-embedded",
    addonMonthly: 49,
    includedIn: ["enterprise"],
    availability: "soon",
    oneLiner: "Платёжное ядро для встраивания",
  },
  {
    id: "qmaskcard",
    addonMonthly: null,
    includedIn: ["enterprise"],
    availability: "on_request",
    oneLiner: "Защищённая банковская карта (PCI-контур)",
  },
  {
    id: "veilnetx",
    addonMonthly: null,
    includedIn: [],
    availability: "soon",
    oneLiner: "Privacy-крипто и приватная сеть",
  },

  // ===== CONSUMER PRODUCTS =====
  {
    id: "cyberchess",
    addonMonthly: 0,
    includedIn: ["free", "pro", "business", "enterprise"],
    availability: "live",
    oneLiner: "Шахматная платформа нового поколения (бесплатно)",
  },
  {
    id: "healthai",
    addonMonthly: 19,
    includedIn: ["business", "enterprise"],
    availability: "soon",
    oneLiner: "Персональный AI-доктор (информационно)",
  },
  {
    id: "qlife",
    addonMonthly: 19,
    includedIn: ["enterprise"],
    availability: "soon",
    oneLiner: "Долголетие и анти-эйджинг сценарии",
  },
  {
    id: "qgood",
    addonMonthly: 15,
    includedIn: ["business", "enterprise"],
    availability: "soon",
    oneLiner: "Психология и ментальное здоровье",
  },
  {
    id: "psyapp-deps",
    addonMonthly: 19,
    includedIn: ["enterprise"],
    availability: "soon",
    oneLiner: "Выход из зависимостей с поддержкой AI",
  },
  {
    id: "qpersona",
    addonMonthly: 29,
    includedIn: ["enterprise"],
    availability: "soon",
    oneLiner: "Цифровой аватар и персональный двойник",
  },
  {
    id: "kids-ai-content",
    addonMonthly: 9,
    includedIn: ["pro", "business", "enterprise"],
    availability: "soon",
    oneLiner: "Детский AI-контент на нескольких языках",
  },
  {
    id: "voice-of-earth",
    addonMonthly: null,
    includedIn: [],
    availability: "soon",
    oneLiner: "Контент-сериал «Голос Земли»",
  },

  // ===== MARKETPLACE / NETWORK =====
  {
    id: "startup-exchange",
    addonMonthly: 29,
    includedIn: ["business", "enterprise"],
    availability: "soon",
    oneLiner: "Маркетплейс защищённых стартап-идей",
  },
  {
    id: "deepsan",
    addonMonthly: 9,
    includedIn: ["pro", "business", "enterprise"],
    availability: "soon",
    oneLiner: "Анти-хаос приложение для продуктивности",
  },
  {
    id: "mapreality",
    addonMonthly: null,
    includedIn: [],
    availability: "soon",
    oneLiner: "Карта реальных потребностей сообществ",
  },

  // ===== EXPERIMENTAL =====
  {
    id: "z-tide",
    addonMonthly: null,
    includedIn: [],
    availability: "soon",
    oneLiner: "Энергия и эмоция как валюта (концепт)",
  },
  {
    id: "qcontract",
    addonMonthly: 19,
    includedIn: ["business", "enterprise"],
    availability: "soon",
    oneLiner: "Самоуничтожающиеся смарт-документы",
  },
  {
    id: "shadownet",
    addonMonthly: null,
    includedIn: [],
    availability: "soon",
    oneLiner: "Альтернативная приватная сеть (R&D)",
  },
  {
    id: "lifebox",
    addonMonthly: 9,
    includedIn: ["pro", "business", "enterprise"],
    availability: "soon",
    oneLiner: "Цифровой сейф для будущего",
  },
  {
    id: "qchaingov",
    addonMonthly: null,
    includedIn: [],
    availability: "soon",
    oneLiner: "DAO-управление экосистемой",
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

export interface Quote {
  tierId: TierId;
  period: BillingPeriod;
  currency: CurrencyCode;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string[];
}

export function buildQuote(input: {
  tierId: TierId;
  modules?: string[];
  seats?: number;
  period?: BillingPeriod;
  currency?: CurrencyCode;
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

  // 3) Add-on модули
  for (const mid of input.modules ?? []) {
    const m = getModulePrice(mid);
    if (!m) {
      notes.push(`Модуль "${mid}" не найден`);
      continue;
    }
    if (m.includedIn.includes(tier.id)) continue; // уже в тарифе
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
  // 4) Скидка 16% на тариф при annual (не на seat/addon)
  let discount = 0;
  if (period === "annual" && tier.id !== "enterprise") {
    const tierLine = lines.find((l) => l.kind === "tier");
    if (tierLine) {
      discount = Math.round(tierLine.total * 0.16);
    }
  }
  const totalUSD = Math.max(0, subtotal - discount);
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
    discount: Math.round(discount * rate * 100) / 100,
    total: Math.round(totalUSD * rate * 100) / 100,
    notes,
  };
}
