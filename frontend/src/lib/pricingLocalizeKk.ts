/**
 * Казахский для того, что страница цен получает ИЗ БЭКЕНДА (тарифы, их пункты, кнопки,
 * примечания, промо, блок доверия). 30.10.2026, проход Бюро на проде: на kk /pricing
 * показывал русские «Выбрать Max», «Цены AEVION» и английские «Crypto-grade signatures».
 * Раньше kk считался «русским» (isEnglish), а словаря kk у цен не было вовсе.
 *
 * Правило то же, что у английского (pricingLocalize.ts): числа в переводе обязаны
 * совпадать с числами оригинала, иначе показываем оригинал — покупатель читает цену.
 * Что здесь не переведено (описания модулей, отзывы клиентов — их отдаёт бэкенд) остаётся
 * как пришло; это ниже первого экрана.
 */

const digits = (s: string) => s.replace(/\D+/g, "");
const pick = (src: string, kk: string | undefined) => (kk != null && digits(src) === digits(kk) ? kk : src);

const TIER_KK: Record<string, { tagline: string; ctaLabel: string }> = {
  free: { ctaLabel: "Тегін бастау", tagline: "Кедергісіз бастаңыз — AEVION-мен енді танысып жатқандарға" },
  lite: { ctaLabel: "Lite таңдау", tagline: "Бүкіл AEVION планетасы 1 айға" },
  medium: { ctaLabel: "Medium таңдау", tagline: "Бүкіл AEVION планетасы 3 айға" },
  pro: { ctaLabel: "Pro таңдау", tagline: "Бүкіл AEVION планетасы 6 айға" },
  full: { ctaLabel: "Full таңдау", tagline: "Бүкіл AEVION планетасы 9 айға" },
  max: { ctaLabel: "Max таңдау", tagline: "Бүкіл AEVION планетасы 12 айға" },
  enterprise: { ctaLabel: "Сатумен байланысу", tagline: "Корпорациялар, банктер және мемлекеттік сектор үшін" },
};

const FEATURE_KK: Record<string, string> = {
  "1 активный модуль на выбор": "Таңдауыңызша 1 белсенді модуль",
  "QRight: до 10 объектов / месяц": "QRight: айына 10 нысанға дейін",
  "QSign: 1 подпись в день": "QSign: күніне 1 қолтаңба",
  "QCoreAI: 100 000 токенов / месяц": "QCoreAI: айына 100 000 токен",
  "Доступ к публичному Globus": "Ашық Globus-қа қолжетімділік",
  "Сообщество и базовая документация": "Қауымдастық және базалық құжаттама",
  "Все продукты AEVION в одной подписке": "AEVION-ның барлық өнімі бір жазылымда",
  "DevHub, Multichat, IP Bureau, CyberChess, QVenture и остальные модули": "DevHub, Multichat, IP Bureau, CyberChess, QVenture және қалған модульдер",
  "QCoreAI: 50 000 000 токенов / месяц": "QCoreAI: айына 50 000 000 токен",
  "Без обязательств дольше месяца": "Бір айдан артық міндеттемесіз",
  "Приоритетная поддержка (8h SLA)": "Басым қолдау (8 сағаттық SLA)",
  "Условия корпоративного уровня обсуждаются индивидуально": "Корпоративтік деңгейдегі шарттар жеке талқыланады",
  "Выделенная инфраструктура (on-prem / VPC)": "Бөлінген инфрақұрылым (on-prem / VPC)",
  "SOC2 / ISO27001 пакет (по запросу)": "SOC2 / ISO27001 топтамасы (сұраныс бойынша)",
  "Безлимитные seats и токены": "Шексіз орындар мен токендер",
  "Индивидуальные SLA до 1 часа": "1 сағатқа дейінгі жеке SLA",
  "Customer Success менеджер": "Customer Success менеджері",
  "Roadmap-влияние и кастом-фичи": "Roadmap-қа ықпал және жеке функциялар",
  "Юридические NDA / DPA / MSA": "Құқықтық NDA / DPA / MSA",
};

const RULES_KK: Array<[RegExp, (...m: string[]) => string]> = [
  [/^Вся планета AEVION на (\d+) (?:месяц|месяца|месяцев)$/, (_, n) => `Бүкіл AEVION планетасы ${n} айға`],
  [/^Выбрать (Lite|Medium|Pro|Full|Max)$/, (_, t) => `${t} таңдау`],
  [/^\$(\d+(?:\.\d+)?) за месяц, без обязательств$/, (_, p) => `Бір айға $${p}, міндеттемесіз`],
  [
    /^\$(\d+(?:\.\d+)?) в месяц, списание ежемесячно — (\d+) (?:платежа|платежей), \$(\d+(?:\.\d+)?) за (\d+) (?:месяца|месяцев); вперёд(?: одним платежом)? — \$(\d+(?:\.\d+)?)(?: раз в \d+ (?:месяца|месяцев), пока не отмените)?$/,
    (_, per, n, total, m, prepay) => `Айына $${per}, төлем ай сайын — ${n} төлем, барлығы $${total} (${m} ай); алдын ала — $${prepay} әр ${m} ай сайын, сіз бас тартқанша`,
  ],
  [/^Экономия (\d+(?:\.\d+)?)% против месяца без срока$/, (_, p) => `Мерзімсіз айға қарағанда ${p}% үнемдеу`],
];

function translate(ru: string): string | undefined {
  const exact = FEATURE_KK[ru];
  if (exact != null) return exact;
  for (const [re, f] of RULES_KK) {
    const m = re.exec(ru);
    if (m) return f(...m);
  }
  return undefined;
}

export function tierKk<T extends { id: string; tagline: string; features: string[]; ctaLabel: string }>(tier: T): T {
  const k = TIER_KK[tier.id];
  return {
    ...tier,
    tagline: pick(tier.tagline, translate(tier.tagline) ?? k?.tagline),
    ctaLabel: pick(tier.ctaLabel, translate(tier.ctaLabel) ?? k?.ctaLabel),
    features: tier.features.map((f) => pick(f, translate(f))),
  };
}

const NOTES_KK: Record<string, string> = {
  "Цены указаны в USD. Конвертация в KZT/RUB/EUR — справочная, окончательный счёт в USD.":
    "Бағалар USD-мен көрсетілген. KZT/RUB/EUR-ға айналдыру — анықтамалық, түпкілікті шот USD-мен.",
  "Тариф — это срок обязательства: Lite 1 мес, Medium 3, Pro 6, Full 9, Max 12. Списание ежемесячно; чем длиннее срок, тем дешевле месяц. Весь срок вперёд — скидка до 12,5 %.":
    "Тариф — міндеттеме мерзімі: Lite 1 ай, Medium 3, Pro 6, Full 9, Max 12. Төлем ай сайын алынады; мерзім неғұрлым ұзақ болса, ай соғұрлым арзан. Бүкіл мерзімді алдын ала төлесеңіз — 12,5 %-ға дейін жеңілдік.",
  "Enterprise — индивидуальный договор, фиксированный SLA, NDA/DPA.":
    "Enterprise — жеке келісімшарт, бекітілген SLA, NDA/DPA.",
};
export const notesKk = (notes: string[]) => notes.map((n) => pick(n, NOTES_KK[n]));

const PROMO_KK: Record<string, string> = {
  "Запуск GTM — 20% на любой платный тариф": "GTM іске қосу — кез келген ақылы тарифке 20%",
  "Стартапам в первый год — 50% на Lite": "Стартаптарға алғашқы жылы — Lite-қа 50%",
  "Ранние пользователи — 30% на любой платный тариф": "Ерте пайдаланушылар — кез келген ақылы тарифке 30%",
  "Реферальный — $10 в первый месяц": "Рефералдық — алғашқы айға $10",
  "Команды — до $100 на Full (не более 50% от суммы заказа)": "Командалар — Full-ға $100-ға дейін (тапсырыс сомасының 50%-ынан артық емес)",
};
export const promoKk = (d: string) => pick(d, PROMO_KK[d]);

const BADGE_LABEL_KK: Record<string, string> = {
  gdpr: "GDPR-ға сай",
  "kz-152": "Деректерді Қазақстанда сақтау",
  openssl: "Криптографиялық берік қолтаңбалар",
};
const BADGE_STATUS_KK: Record<string, string> = {
  "in progress (Q3 2026)": "әзірленуде (2026 ж. 3-тоқсан)",
  "in progress (Q4 2026)": "әзірленуде (2026 ж. 4-тоқсан)",
  "аудит не пройден": "аудит өтпеген",
  "политика опубликована, удаление по запросу работает; аудита нет": "саясат жарияланған, сұраныс бойынша жою жұмыс істейді; аудит жоқ",
  "локализацию данных в РК не предоставляем": "деректерді ҚР-да локализациялауды ұсынбаймыз",
};
export function badgeKk<T extends { id: string; label: string; status?: string }>(b: T): T {
  const status = b.status != null ? pick(b.status, BADGE_STATUS_KK[b.status]) : b.status;
  return { ...b, label: pick(b.label, BADGE_LABEL_KK[b.id]), status };
}

// Ключи labelKk/hintKk, не label/hint: тот же приём, что у TRUST_NUMBER_EN (сторож englishAttrsDoNotGrow).
const TRUST_NUMBER_KK: Record<string, { labelKk: string; hintKk?: string }> = {
  "Зарегистрированных идей": { labelKk: "Тіркелген идеялар", hintKk: "QRight бета кезеңінде" },
  "Стран использования": { labelKk: "Қолданылатын елдер", hintKk: "Қазақстаннан Канадаға дейін" },
  "Модулей платформы": { labelKk: "Платформа модульдері", hintKk: "бір жазылымда (Full-да)" },
  "Время до первой подписи": { labelKk: "Алғашқы қолтаңбаға дейінгі уақыт", hintKk: "QSign-да тіркелуден бастап" },
  "Сертифицированных артефактов": { labelKk: "Сертификатталған артефактілер", hintKk: "AEVION IP Bureau арқылы" },
};
export function trustNumberKk<T extends { label: string; hint?: string }>(n: T): T {
  const k = TRUST_NUMBER_KK[n.label];
  if (!k) return n;
  const hint = n.hint != null && k.hintKk != null ? pick(n.hint, k.hintKk) : n.hint;
  return { ...n, label: pick(n.label, k.labelKk), hint };
}
