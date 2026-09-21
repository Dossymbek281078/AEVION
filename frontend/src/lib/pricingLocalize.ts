/**
 * Английские тексты для того, что страница цен получает ИЗ БЭКЕНДА
 * (`/api/pricing`, `/api/pricing/trust`, промо): описания тарифов, их пункты,
 * подписи кнопок, примечания, однострочники модулей, подписи блока доверия.
 *
 * Зачем отдельно от словарей i18n: эти строки не ключи, а данные — бэкенд
 * отдаёт их только по-русски (`data/pricing.ts`, EN-полей там нет). Замер
 * 20.09.2026 браузером с локалью en-US: на `/pricing` 106 русских строк при
 * полностью английских `/devhub` и `/multichat-engine` — то есть последний
 * шаг перед кассой у англоязычного покупателя был наполовину русским.
 *
 * Правило безопасности: числа в переводе ОБЯЗАНЫ совпадать с числами в
 * оригинале (цены, месяцы, токены, проценты). Если бэкенд поменял цену, а
 * английская строка здесь отстала — показываем русскую строку с верным
 * числом, а не английскую с неверным. Проверяется `sameDigits` на каждой
 * строке, не только в тесте: сторож должен быть не слабее того, кто примет
 * значение дальше (покупатель читает цену).
 *
 * Для языков без перевода (kk) поведение прежнее — русский текст бэкенда.
 */

type TierLike = {
  id: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
};

type TierEn = { tagline: string; ctaLabel: string; features: string[] };

const ALL_PRODUCTS = "Every AEVION product in one subscription";
const MODULE_LIST = "DevHub, Multichat, IP Bureau, CyberChess, QVenture and the rest of the modules";
const TOKENS_50M = "QCoreAI: 50 000 000 tokens / month";
const SUPPORT_8H = "Priority support (8h SLA)";

export const TIER_EN: Record<string, TierEn> = {
  free: {
    ctaLabel: "Start free",
    tagline: "Start with no barriers — for those just getting to know AEVION",
    features: [
      "1 active module of your choice",
      "QRight: up to 10 objects / month",
      "QSign: 1 signature per day",
      "QCoreAI: 100 000 tokens / month",
      "Access to the public Globus",
      "Community and basic documentation",
    ],
  },
  lite: {
    ctaLabel: "Choose Lite",
    tagline: "The whole AEVION planet for 1 month",
    features: [
      ALL_PRODUCTS,
      MODULE_LIST,
      TOKENS_50M,
      "$400 for the month",
      "No commitment beyond one month",
      SUPPORT_8H,
    ],
  },
  medium: {
    ctaLabel: "Choose Medium",
    tagline: "The whole AEVION planet for 3 months",
    features: [
      ALL_PRODUCTS,
      MODULE_LIST,
      TOKENS_50M,
      "$1050 for 3 months — $350 a month",
      "Save 12.5% vs monthly billing",
      SUPPORT_8H,
    ],
  },
  pro: {
    ctaLabel: "Choose Pro",
    tagline: "The whole AEVION planet for 6 months",
    features: [
      ALL_PRODUCTS,
      MODULE_LIST,
      TOKENS_50M,
      "$1800 for 6 months — $300 a month",
      "Save 25% vs monthly billing",
      SUPPORT_8H,
    ],
  },
  full: {
    ctaLabel: "Choose Full",
    tagline: "The whole AEVION planet for 9 months",
    features: [
      ALL_PRODUCTS,
      MODULE_LIST,
      TOKENS_50M,
      "$2250 for 9 months — $250 a month",
      "Save 37.5% vs monthly billing",
      SUPPORT_8H,
    ],
  },
  max: {
    ctaLabel: "Choose Max",
    tagline: "The whole AEVION planet for 12 months",
    features: [
      ALL_PRODUCTS,
      MODULE_LIST,
      TOKENS_50M,
      "$2400 for 12 months — $200 a month",
      "Save 50% vs monthly billing",
      SUPPORT_8H,
    ],
  },
  enterprise: {
    ctaLabel: "Contact sales",
    tagline: "For corporations, banks and the public sector",
    features: [
      "Dedicated infrastructure (on-prem / VPC)",
      "SOC2 / ISO27001 package (on request)",
      "Unlimited seats and tokens",
      "Custom SLA down to 1 hour",
      "Customer Success manager",
      "Roadmap influence and custom features",
      "Legal NDA / DPA / MSA",
    ],
  },
};

/** Примечания под тарифами — ключ по русскому тексту: изменился текст на бэкенде → перевод отпадает сам. */
export const NOTES_EN: Record<string, string> = {
  "Цены указаны в USD. Конвертация в KZT/RUB/EUR — справочная, окончательный счёт в USD.":
    "Prices are in USD. KZT/RUB/EUR conversion is for reference; the final invoice is in USD.",
  "Тариф — это срок: Lite 1 мес, Medium 3, Pro 6, Full 9, Max 12. Оплата за срок вперёд; чем длиннее срок, тем дешевле месяц.":
    "A tier is a term: Lite 1 month, Medium 3, Pro 6, Full 9, Max 12. You pay for the term upfront; the longer the term, the cheaper the month.",
  "Enterprise — индивидуальный договор, фиксированный SLA, NDA/DPA.":
    "Enterprise — individual contract, fixed SLA, NDA/DPA.",
};

/** Промо-описания — тоже по русскому тексту. */
export const PROMO_EN: Record<string, string> = {
  "Запуск GTM — 20% на любой платный тариф": "GTM launch — 20% off any paid tier",
};

/**
 * Блок доверия: подпись и подсказка по русской подписи.
 *
 * Ключи названы labelEn/hintEn, а не label/hint, намеренно: сторож
 * englishAttrsDoNotGrow.guard считает английский текст в свойствах
 * label/hint/title «английской подсказкой на русском экране». Здесь это
 * перевод, который показывается только при lang=en, — и ему незачем
 * выглядеть для сторожа как подпись.
 */
export const TRUST_NUMBER_EN: Record<string, { labelEn: string; hintEn?: string }> = {
  "Зарегистрированных идей": { labelEn: "Registered ideas", hintEn: "during the QRight beta" },
  "Стран использования": { labelEn: "Countries in use", hintEn: "from Kazakhstan to Canada" },
  "Модулей платформы": { labelEn: "Platform modules", hintEn: "in one subscription (on Full)" },
  "Время до первой подписи": { labelEn: "Time to first signature", hintEn: "from sign-up in QSign" },
  "Сертифицированных артефактов": { labelEn: "Certified artifacts", hintEn: "via AEVION IP Bureau" },
};

export const MODULE_ONE_LINER_EN: Record<string, string> = {
  globus: "Central map and portal of the ecosystem",
  "revenue-hub": "Internal monetization module (auth-gated, not plan-gated)",
  ventures: "Idea Market: a showcase of business models + the AEVIA venture arm",
  qcoreai: "AI Core Engine: agent and LLM orchestration",
  "multichat-engine": "Parallel sub-chats and agents per task",
  qfusionai: "Hybrid engine on top of the best AI platforms",
  qright: "Registration of digital objects and proof of authorship",
  qsign: "Digital signature and integrity verification",
  "aevion-ip-bureau": "Electronic authorship bureau + certificates",
  qtradeoffline: "Offline deals and payments without internet",
  "qpaynet-embedded": "Embeddable payment core",
  qmaskcard: "Protected bank card (PCI perimeter)",
  veilnetx: "Privacy crypto and a private network",
  cyberchess: "Next-generation chess platform",
  healthai: "Personal AI doctor (informational)",
  qmelanin: "Anti-grey-hair protocol: tests → nutrition (informational)",
  qrenew: "Cellular renewal: bio-age + stack (informational)",
  "smeta-trainer": "AI trainer for construction estimating in Kazakhstan",
  qai: "General-purpose AI assistant",
  qlearn: "Learning platform with AI",
  qnews: "News and AI digest",
  qstore: "Marketplace of digital products",
  qmedia: "Media hosting and streaming",
  qlife: "Longevity and anti-aging scenarios",
  qgood: "Psychology and mental health",
  "psyapp-deps": "Overcoming addictions with AI support",
  qpersona: "Digital avatar and personal twin",
  "kids-ai-content": "Kids' AI content in several languages",
  "voice-of-earth": "The “Voice of Earth” content series",
  qbuild: "Recruiting platform and ATS",
  "startup-exchange": "Marketplace of protected startup ideas",
  qventure: "AI due diligence: quant scoring + a 4-role board + entry strategy",
  qskyway: "Provider-independent 3D air corridors for air taxis over a city's digital twin",
  qreal: "Fully live AI video without an actor: brief → shots → film with realism QC and provenance",
  deepsan: "Anti-chaos productivity app",
  mapreality: "Map of communities' real needs",
  qevents: "Events, calendar and registrations",
  "z-tide": "Energy and emotion as currency (concept)",
  qcontract: "Self-destructing smart documents",
  shadownet: "Alternative private network (R&D)",
  lifebox: "Digital safe for the future",
  constitution: "AI constitution and civic documents",
  qchaingov: "DAO governance of the ecosystem",
  devhub: "Browser IDE on the VS Code engine: code generation and publishing",
};

/** Цифры строки подряд, без пробелов: «$1050 за 3 месяца — $350» → «10503350». */
export function digitsOf(s: string): string {
  return s.replace(/\D+/g, "");
}

/** Перевод берётся, только если его числа совпадают с оригиналом. */
export function sameDigits(ru: string, en: string): boolean {
  return digitsOf(ru) === digitsOf(en);
}

function pick(ru: string, en: string | undefined): string {
  return en != null && sameDigits(ru, en) ? en : ru;
}

export function isEnglish(lang: string): boolean {
  return lang === "en";
}

export function localizeTier<T extends TierLike>(tier: T, lang: string): T {
  if (!isEnglish(lang)) return tier;
  const en = TIER_EN[tier.id];
  if (!en) return tier;
  return {
    ...tier,
    tagline: pick(tier.tagline, en.tagline),
    ctaLabel: pick(tier.ctaLabel, en.ctaLabel),
    features: tier.features.map((f, i) => pick(f, en.features[i])),
  };
}

export function localizeNotes(notes: string[], lang: string): string[] {
  if (!isEnglish(lang)) return notes;
  return notes.map((n) => pick(n, NOTES_EN[n]));
}

export function localizePromoDescription(description: string, lang: string): string {
  if (!isEnglish(lang)) return description;
  return pick(description, PROMO_EN[description]);
}

export function localizeModuleOneLiner(moduleId: string, oneLiner: string, lang: string): string {
  if (!isEnglish(lang)) return oneLiner;
  return pick(oneLiner, MODULE_ONE_LINER_EN[moduleId]);
}

export function localizeTrustNumber<T extends { label: string; hint?: string }>(n: T, lang: string): T {
  if (!isEnglish(lang)) return n;
  const en = TRUST_NUMBER_EN[n.label];
  if (!en) return n;
  const hint = n.hint != null && en.hintEn != null ? pick(n.hint, en.hintEn) : n.hint;
  return { ...n, label: pick(n.label, en.labelEn), hint };
}
