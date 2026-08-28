/**
 * Trust signals и customer testimonials для GTM-страниц.
 *
 * ВАЖНО: эти данные публичны, отдаются GET /api/pricing/testimonials
 * и /api/pricing/trust. Не указывать здесь NDA-фактов и реальных PII клиентов
 * без их письменного разрешения.
 *
 * Сейчас цифры — раннего AEVION (соответствуют реальной активности или
 * демо-сценариям). Обновляйте по мере роста.
 */

export interface Testimonial {
  id: string;
  author: string;
  role: string;
  company: string;
  quote: string;
  /** Какая часть AEVION упоминается — для фильтрации на разных лендингах */
  module?: string;
  industry?: "banks" | "startups" | "government" | "creators" | "law-firms";
  /** Avatar — публичная инициалы-плашка через CSS, реальных фото пока не показываем */
  avatarColor?: string;
  /** rating 1..5, опционально */
  rating?: number;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t-startup-1",
    author: "Айгерим Б.",
    role: "Founder",
    company: "Inkubator KZ",
    quote:
      "Раньше я платила DocuSign + Patently + ChatGPT отдельно. Теперь всё под одним аккаунтом за $19/мес. Зарегистрировала 47 идей за месяц — без юриста.",
    industry: "startups",
    module: "qright",
    avatarColor: "#7c3aed",
    rating: 5,
  },
  {
    id: "t-creator-1",
    author: "Дмитрий В.",
    role: "Технический блогер",
    company: "Independent",
    quote:
      "QSign + QRight закрыли вопрос с авторством статей навсегда. Каждый черновик автоматически в реестре. За 6 месяцев — 3 случая копирования, все доказали через certified PDF.",
    industry: "creators",
    module: "qsign",
    avatarColor: "#be185d",
    rating: 5,
  },
  {
    id: "t-law-1",
    author: "Алексей М.",
    role: "Партнёр",
    company: "IP Practice (12 юристов)",
    quote:
      "Заменили DocuSign + Patently + Notion + ChatGPT на один Business. Экономия на стеке — $480/месяц. Audit-export к ФАС в 1 клик. Кейс года.",
    industry: "law-firms",
    module: "aevion-ip-bureau",
    avatarColor: "#92400e",
    rating: 5,
  },
  {
    id: "t-bank-1",
    author: "Customer Success Lead",
    role: "Финансовый холдинг",
    company: "Top-5 банк KZ (NDA)",
    quote:
      "Pilot QSign+аудит для KYC-onboarding снизил time-to-onboard клиента с 3 дней до 12 минут. SLA 1h работает как часы.",
    industry: "banks",
    module: "qsign",
    avatarColor: "#1e3a8a",
    rating: 5,
  },
  {
    id: "t-gov-1",
    author: "Заместитель руководителя",
    role: "Цифровизация",
    company: "Гос. структура (NDA)",
    quote:
      "Open-source модули, локализация в KZ, on-prem развёртывание — это то, что мы искали 2 года. AEVION — единственное предложение на рынке с таким набором.",
    industry: "government",
    module: "qchaingov",
    avatarColor: "#065f46",
    rating: 5,
  },
  {
    id: "t-dev-1",
    author: "Серик А.",
    role: "Tech Lead",
    company: "FinTech Startup",
    quote:
      "OpenAPI + JSONL + checkout API из коробки. Интегрировали за 2 дня вместо 2 недель со Stripe+SendGrid+Auth0 связкой. Просто работает.",
    industry: "startups",
    avatarColor: "#0d9488",
    rating: 5,
  },
];

export interface TrustNumber {
  label: string;
  value: string;
  hint?: string;
}

export const TRUST_NUMBERS: TrustNumber[] = [
  { label: "Зарегистрированных идей", value: "12 000+", hint: "за время бета-периода в QRight" },
  { label: "Стран использования", value: "30+", hint: "от Казахстана до Канады" },
  // ⚠️ ЧЕТЫРЕ ПРОБЛЕМЫ В ЭТОМ БЛОКЕ, найдено 10.08.2026 при аудите числовых
  // утверждений. Две выведены из кода и исправлены, две ждут решения основателя.
  //
  // 1. ✅ ИСПРАВЛЕНО: было «27 модулей» при 41 записи в projects.ts. Публичный
  //    счёт — 40 продуктовых узлов (41 запись минус globus, это оболочка карты;
  //    та же арифметика в frontend/src/data/pitchFacts.ts). Число выведено из
  //    реестра, а не подобрано. Закреплено tests/trustClaims.guard.test.ts —
  //    фронтовый scaleClaims.guard сюда не достаёт, он сканирует только
  //    frontend/src.
  // 2. ✅ ИСПРАВЛЕНО: было «на Business» — тарифа Business не существует, это
  //    deprecated-алиас без объекта в TIERS. provisioning.ts маппит его в Full,
  //    а Full и означает «все продукты», поэтому подпись теперь про Full.
  // 3. «API uptime SLA 99.5% / 99.95% Enterprise» ниже противоречит ДВУМ
  //    другим источникам: routes/apiQuotas.ts (Build 99.0 / Scale 99.5 /
  //    Enterprise 99.9, отдаётся машинам на /api/quotas) и глоссарию на
  //    /pricing («99.9% на всё, 99.95% Enterprise»). Три разные лестницы для
  //    одного обещания.
  // 4. «12 000+ идей», «3 200+ артефактов», «30+ стран» — источник этих чисел
  //    в коде не найден, а компания pre-revenue.
  //
  //    ЗАМЕР 28.08.2026 (то, чего аудиту не хватало). Подписи-пояснения сами
  //    называют источник, и он отвечает числами:
  //      «за время бета-периода в QRight»  -> GET /api/qright/objects: total 13
  //      «через AEVION IP Bureau»          -> GET /api/bureau/transparency:
  //                                            7 записей, 113 ждут проверки
  //      «от Казахстана до Канады»         -> у подписей 3 страны
  //                                            (GET /api/qsign/v2/stats),
  //                                            у бюро список стран пуст
  //    То есть вопрос «откуда взяты счётчики» из пункта 4 закрыт с другой
  //    стороны: названные источники существуют и дают 13, 7 и 3.
  //
  //    Значения ЗДЕСЬ НЕ МЕНЯЮ по той же причине, по которой их не менял
  //    аудит: подставить сюда что-либо — решение о том, что мы говорим людям
  //    на странице оплаты. Варианты для основателя: убрать три строки,
  //    подставить живые значения (источники есть, ручки отвечают) или
  //    оставить осознанно. Числа уходят человеку в момент решения о деньгах,
  //    и проверяются они одним запросом.
  //
  // Почему 3 и 4 не поправил: SLA — коммерческое обязательство, а счётчики —
  // заявления о мире. Подставить сюда правдоподобное число значит выдумать
  // его, а это ровно то, против чего затевался весь аудит. Нужен ответ
  // основателя: какая лестница SLA настоящая и откуда взяты счётчики.
  { label: "Модулей платформы", value: "40", hint: "в одной подписке (на Full)" },
  { label: "Время до первой подписи", value: "<60s", hint: "от регистрации в QSign" },
  // ✅ ИСПРАВЛЕНО 19.08.2026 (пункт 3 из списка выше). Было: value "99.5%",
  //    hint «Business · 99.95% Enterprise». Три ошибки в одной строке:
  //    (а) 99.5% — это уровень тарифа Scale за $249, а не общий;
  //    (б) тарифа «Business» не существует (тот же мёртвый алиас, что и в
  //        пункте 2 выше);
  //    (в) 99.95% Enterprise обещает БОЛЬШЕ, чем опубликованный договор.
  //
  //    Договор здесь не мнение: GET /api/quotas — машиночитаемый, с версией
  //    1.1.0, датой публикации и адресом для связи. Обещать сверх него — брать
  //    обязательство, которого мы не брали. Поэтому строка теперь называет
  //    лестницу целиком и ровно ту, что отдаётся машинам.
  { label: "API uptime SLA", value: "99.0–99.9%", hint: "Build 99.0 · Scale 99.5 · Enterprise 99.9 (GET /api/quotas)" },
  { label: "Сертифицированных артефактов", value: "3 200+", hint: "через AEVION IP Bureau" },
];

export interface TrustBadge {
  id: string;
  label: string;
  /** ISO дата — когда получено / в каком статусе */
  status?: string;
  category: "compliance" | "technology" | "partner";
}

export const TRUST_BADGES: TrustBadge[] = [
  { id: "soc2", label: "SOC2 Type II", status: "in progress (Q3 2026)", category: "compliance" },
  { id: "iso27001", label: "ISO 27001", status: "in progress (Q4 2026)", category: "compliance" },
  { id: "gdpr", label: "GDPR-ready", status: "live", category: "compliance" },
  { id: "kz-152", label: "KZ data localization", status: "live", category: "compliance" },
  { id: "openapi", label: "Open API + OpenAPI 3.1", status: "live", category: "technology" },
  { id: "openssl", label: "Crypto-grade signatures", status: "live", category: "technology" },
];
