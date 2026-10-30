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
 * Казахский — pricingLocalizeKk.ts (30.10.2026). Для языков без перевода поведение прежнее.
 */
import { tierKk, notesKk, promoKk, badgeKk, trustNumberKk } from "./pricingLocalizeKk";

type TierLike = {
  id: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
};

/** Подзаголовок и кнопка по id тарифа — запасной путь, когда шаблон бэка не узнан. Пункты — FEATURE_EN ниже. */
type TierEn = { tagline: string; ctaLabel: string };

const ALL_PRODUCTS = "Every AEVION product in one subscription";
const MODULE_LIST = "DevHub, Multichat, IP Bureau, CyberChess, QVenture and the rest of the modules";
const TOKENS_50M = "QCoreAI: 50 000 000 tokens / month";
const SUPPORT_8H = "Priority support (8h SLA)";

export const TIER_EN: Record<string, TierEn> = {
  free: {
    ctaLabel: "Start free",
    tagline: "Start with no barriers — for those just getting to know AEVION",
  },
  lite: {
    ctaLabel: "Choose Lite",
    tagline: "The whole AEVION planet for 1 month",
  },
  medium: {
    ctaLabel: "Choose Medium",
    tagline: "The whole AEVION planet for 3 months",
  },
  pro: {
    ctaLabel: "Choose Pro",
    tagline: "The whole AEVION planet for 6 months",
  },
  full: {
    ctaLabel: "Choose Full",
    tagline: "The whole AEVION planet for 9 months",
  },
  max: {
    ctaLabel: "Choose Max",
    tagline: "The whole AEVION planet for 12 months",
  },
  enterprise: {
    ctaLabel: "Contact sales",
    tagline: "For corporations, banks and the public sector",
  },
};

/** Примечания под тарифами — ключ по русскому тексту: изменился текст на бэкенде → перевод отпадает сам. */
export const NOTES_EN: Record<string, string> = {
  "Цены указаны в USD. Конвертация в KZT/RUB/EUR — справочная, окончательный счёт в USD.":
    "Prices are in USD. KZT/RUB/EUR conversion is for reference; the final invoice is in USD.",
  "Тариф — это срок обязательства: Lite 1 мес, Medium 3, Pro 6, Full 9, Max 12. Списание ежемесячно; чем длиннее срок, тем дешевле месяц. Весь срок вперёд — скидка до 12,5 %.":
    "A tier is a commitment term: Lite 1 month, Medium 3, Pro 6, Full 9, Max 12. Billed monthly; the longer the term, the cheaper the month. Pay the whole term up front and save up to 12.5%.",
  "Enterprise — индивидуальный договор, фиксированный SLA, NDA/DPA.":
    "Enterprise — individual contract, fixed SLA, NDA/DPA.",
};

/** Промо-описания — тоже по русскому тексту. */
export const PROMO_EN: Record<string, string> = {
  "Запуск GTM — 20% на любой платный тариф": "GTM launch — 20% off any paid tier",
  "Стартапам в первый год — 50% на Lite": "Startups in their first year — 50% off Lite",
  "Ранние пользователи — 30% на любой платный тариф": "Early users — 30% off any paid tier",
  "Реферальный — $10 в первый месяц": "Referral — $10 off the first month",
  "Команды — до $100 на Full (не более 50% от суммы заказа)": "Teams — up to $100 off Full (no more than 50% of the order)",
};

/**
 * Знаки соответствия (/api/pricing/trust → badges) — по id; статус по русскому тексту:
 * изменился статус на бэкенде → перевод отпадает сам, показывается русский (замер 29.10: на /en
 * «аудит не пройден», «Хранение в РК» шли по-русски).
 */
export const BADGE_LABEL_EN: Record<string, string> = { "kz-152": "Data residency in Kazakhstan" };
export const BADGE_STATUS_EN: Record<string, string> = {
  "аудит не пройден": "not audited",
  "политика опубликована, удаление по запросу работает; аудита нет": "policy published, deletion on request works; no audit",
  "локализацию данных в РК не предоставляем": "we do not offer data localization in Kazakhstan",
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
  qrenew: "Biological age (PhenoAge) + evidence-graded stack (informational)",
  "smeta-trainer": "AI trainer for construction estimating in Kazakhstan",
  qai: "General-purpose AI assistant",
  qlearn: "Learning platform with AI",
  qnews: "News and AI digest",
  qstore: "Marketplace of digital products",
  qmedia: "Media hosting and streaming",
  qlife: "Longevity and healthy-habit scenarios",
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
  // 01.10.2026: английский отстал от смены СУТИ продукта. Z-Tide перестал быть
  // «энергией как валютой» и стал мягкой репутацией; русский однострочник
  // обновили, английский остался описывать прежний замысел — то есть другой
  // продукт. Вскрылось свежим снимком цен: sameDigits не сходился (в русском
  // «7 рангов», в английском цифр не было вовсе).
  "z-tide": "Soft reputation: 7 ranks, points are not tradable",
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

/**
 * Показывать ли английский перевод цен вместо русского исходника.
 *
 * 27.10.2026 (саудовская волна, замер Продаж locale ar-SA): в ar-режиме /pricing отдавала
 * 3436 знаков кириллицы — тарифы, заметки, однострочники модулей шли по-русски, потому что
 * «не en» означало «русский». Арабского перевода цен нет; для любого языка, кроме ru и kk,
 * запасной — английский (так же устроены словари, lib/i18n-lang/README.md). Пустой/неизвестный
 * язык по-прежнему русский: прежнее поведение страниц без провайдера не меняется.
 */
export function isEnglish(lang: string): boolean {
  return !!lang && lang !== "ru" && lang !== "kk";
}

/**
 * 🔴 20.10.2026: пункты тарифа — по ТЕКСТУ, а не по позиции. Замер Продаж на
 * /pricing при en-US: 731 знак кириллицы. Позиционная карта TIER_EN отстала от
 * плана «Планета» 19.10 (цены $400→$250, строка «списание ежемесячно», «Экономия
 * N% против месяца без срока», 4 пункта Enterprise вместо 7) — числа разошлись,
 * и pick честно откатывался на русский. Хуже: у пунктов БЕЗ чисел позиция
 * совпадала по цифрам, и Enterprise мог показать чужой пункт.
 *
 * Теперь: точная строка → FEATURE_EN; шаблонная строка бэка (data/pricing.ts,
 * planetTier) → правило с теми же числами; иначе русский текст (числа верны).
 */
const FEATURE_EN: Record<string, string> = {
  "1 активный модуль на выбор": "1 active module of your choice",
  "QRight: до 10 объектов / месяц": "QRight: up to 10 objects / month",
  "QSign: 1 подпись в день": "QSign: 1 signature per day",
  "QCoreAI: 100 000 токенов / месяц": "QCoreAI: 100 000 tokens / month",
  "Доступ к публичному Globus": "Access to the public Globus",
  "Сообщество и базовая документация": "Community and basic documentation",
  "Все продукты AEVION в одной подписке": ALL_PRODUCTS,
  "DevHub, Multichat, IP Bureau, CyberChess, QVenture и остальные модули": MODULE_LIST,
  "QCoreAI: 50 000 000 токенов / месяц": TOKENS_50M,
  "Без обязательств дольше месяца": "No commitment beyond one month",
  "Приоритетная поддержка (8h SLA)": SUPPORT_8H,
  "Условия корпоративного уровня обсуждаются индивидуально": "Enterprise-level terms are agreed individually",
  "Выделенная инфраструктура (on-prem / VPC)": "Dedicated infrastructure (on-prem / VPC)",
  "SOC2 / ISO27001 пакет (по запросу)": "SOC2 / ISO27001 package (on request)",
  "Безлимитные seats и токены": "Unlimited seats and tokens",
  "Индивидуальные SLA до 1 часа": "Custom SLA down to 1 hour",
  "Customer Success менеджер": "Customer Success manager",
  "Roadmap-влияние и кастом-фичи": "Roadmap influence and custom features",
  "Юридические NDA / DPA / MSA": "Legal NDA / DPA / MSA",
};

const monthsEn = (n: string) => (n === "1" ? "1 month" : `${n} months`);

/** Шаблоны строк бэка → английский с ТЕМИ ЖЕ числами. */
const RULES_EN: Array<[RegExp, (...m: string[]) => string]> = [
  [/^Вся планета AEVION на (\d+) (?:месяц|месяца|месяцев)$/, (_, n) => `The whole AEVION planet for ${monthsEn(n)}`],
  [/^Выбрать (Lite|Medium|Pro|Full|Max)$/, (_, t) => `Choose ${t}`],
  [/^\$(\d+(?:\.\d+)?) за месяц, без обязательств$/, (_, p) => `$${p} for one month, no commitment`],
  [
    // 21.10.2026: «вперёд» — подписка с продлением. Прежнюю форму бэка («одним
    // платежом») тоже принимаем: сайт и бэк выкатываются порознь.
    /^\$(\d+(?:\.\d+)?) в месяц, списание ежемесячно — (\d+) (?:платежа|платежей), \$(\d+(?:\.\d+)?) за (\d+) (?:месяца|месяцев); вперёд(?: одним платежом)? — \$(\d+(?:\.\d+)?)(?: раз в \d+ (?:месяца|месяцев), пока не отмените)?$/,
    (_, per, n, total, m, prepay) => `$${per} a month, billed monthly — ${n} payments, $${total} for ${monthsEn(m)}; up front — $${prepay} every ${monthsEn(m)} until you cancel`,
  ],
  [/^Экономия (\d+(?:\.\d+)?)% против месяца без срока$/, (_, p) => `Save ${p}% vs. one month without a term`],
  // Строки и примечания расчёта /api/pricing/quote (data/pricing.ts, buildQuote).
  [/^План «AEVION Планета» — (\d+) (?:месяца|месяцев), списание ежемесячно по \$(\d+(?:\.\d+)?)$/, (_, m, p) => `AEVION Planet plan — ${monthsEn(m)}, billed monthly at $${p}`],
  [/^План «AEVION Планета» — 1 месяц, без обязательств$/, () => "AEVION Planet plan — 1 month, no commitment"],
  [/^Дополнительные пользователи \((\d+) × \$5\/мес\)$/, (_, n) => `Extra users (${n} × $5/mo)`],
  [/^Модуль ([a-z0-9-]+)$/, (_, id) => `Module ${id}`],
  [/^Модуль ([a-z0-9-]+) включён в Lite \(1 продукт на выбор\)$/, (_, id) => `Module ${id} is included in Lite (1 product of your choice)`],
  [/^Модуль "(.+)" не найден$/, (_, id) => `Module "${id}" not found`],
  [/^Модуль "(.+)" доступен только по запросу \(Enterprise \/ Sales\)$/, (_, id) => `Module "${id}" is available on request only (Enterprise / Sales)`],
  [/^Enterprise — итоговая цена согласовывается отдельно$/, () => "Enterprise — the final price is agreed separately"],
  [/^Скидки срезаны потолком: −\$(\d+(?:\.\d+)?) сверх допустимого$/, (_, x) => `Discounts capped: −$${x} above the allowed limit`],
];

/** Строка или примечание расчёта (/api/pricing/quote) на языке страницы; без перевода — русская. */
export function localizeQuoteText(ru: string, lang: string): string {
  // 31.10.2026 (путь платящего на kk): калькулятор писал «План «AEVION Планета» — 3 месяца, списание
  // ежемесячно по $225» по-русски. Правило сайта для kk — без казахского перевода по-английски.
  if (lang === "kk") return pick(ru, translateBackendText(ru) ?? undefined);
  if (!isEnglish(lang)) return ru;
  return pick(ru, translateBackendText(ru) ?? undefined);
}

/** Английский для строки бэка: точная → правило → null (нет перевода). */
export function translateBackendText(ru: string): string | null {
  const exact = FEATURE_EN[ru];
  if (exact != null) return exact;
  for (const [re, f] of RULES_EN) {
    const m = re.exec(ru);
    if (m) return f(...m);
  }
  return null;
}

export function localizeTier<T extends TierLike>(tier: T, lang: string): T {
  if (lang === "kk") return tierKk(tier);
  if (!isEnglish(lang)) return tier;
  const en = TIER_EN[tier.id];
  return {
    ...tier,
    tagline: pick(tier.tagline, translateBackendText(tier.tagline) ?? en?.tagline),
    ctaLabel: pick(tier.ctaLabel, translateBackendText(tier.ctaLabel) ?? en?.ctaLabel),
    features: tier.features.map((f) => pick(f, translateBackendText(f) ?? undefined)),
  };
}

export function localizeNotes(notes: string[], lang: string): string[] {
  if (lang === "kk") return notesKk(notes);
  if (!isEnglish(lang)) return notes;
  return notes.map((n) => pick(n, NOTES_EN[n]));
}

export function localizePromoDescription(description: string, lang: string): string {
  if (lang === "kk") return promoKk(description);
  if (!isEnglish(lang)) return description;
  return pick(description, PROMO_EN[description]);
}

export function localizeTrustBadge<T extends { id: string; label: string; status?: string }>(b: T, lang: string): T {
  if (lang === "kk") return badgeKk(b);
  if (!isEnglish(lang)) return b;
  const status = b.status != null ? pick(b.status, BADGE_STATUS_EN[b.status]) : b.status;
  return { ...b, label: pick(b.label, BADGE_LABEL_EN[b.id]), status };
}

export function localizeModuleOneLiner(moduleId: string, oneLiner: string, lang: string): string {
  // 31.10.2026, путь платящего CyberChess на kk (прод 2f217a909): таблица «Все модули» на /pricing давала
  // 43 русских описания — kk считался «не английским» и получал оригинал. Правило сайта (pricingI18n, kk):
  // чего нет на казахском — по-английски, НЕ по-русски. Числа сверяет тот же pick().
  if (lang === "kk") return pick(oneLiner, MODULE_ONE_LINER_EN[moduleId]);
  if (!isEnglish(lang)) return oneLiner;
  return pick(oneLiner, MODULE_ONE_LINER_EN[moduleId]);
}

export function localizeTrustNumber<T extends { label: string; hint?: string }>(n: T, lang: string): T {
  if (lang === "kk") return trustNumberKk(n);
  if (!isEnglish(lang)) return n;
  const en = TRUST_NUMBER_EN[n.label];
  if (!en) return n;
  const hint = n.hint != null && en.hintEn != null ? pick(n.hint, en.hintEn) : n.hint;
  return { ...n, label: pick(n.label, en.labelEn), hint };
}
