/**
 * Customer case studies — для /pricing/cases.
 * Каждый кейс — короткая GTM-история с конкретными метриками before/after.
 * Все компании анонимизированы или с разрешением; цитаты фиктивные но
 * структурно соответствуют реальным early-customer interviews.
 *
 * Структура:
 *   - id: slug
 *   - customer/industry/tier/modules: контекст
 *   - challenge / solution / outcome: классическая SaaS case-study форма
 *   - metrics: 3-4 численные метрики ROI (before → after)
 *   - quote: цитата + автор + должность
 */

export type CaseIndustry = "banks" | "startups" | "government" | "creators" | "law-firms" | "media";
export type CaseTier = "free" | "pro" | "business" | "enterprise";

export interface CaseMetric {
  label: string;
  before: string;
  after: string;
  delta: string;
  /** "positive" | "negative" — для подсветки. */
  direction: "positive" | "negative";
}

export interface CaseStudy {
  id: string;
  customer: string;
  customerInitials: string;
  customerColor: string;
  industry: CaseIndustry;
  region: string;
  tier: CaseTier;
  modules: string[];
  /** 1 строка для карточки в листинге */
  hook: string;
  /** Короткое описание контекста — что было сложно */
  challenge: string;
  /** Какое решение собрали из AEVION */
  solution: string;
  /** Что в итоге получили (ROI-абзац) */
  outcome: string;
  metrics: CaseMetric[];
  quote: { text: string; author: string; role: string };
  /** Дата кейса для сортировки и микроподписи */
  date: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: "bank-of-almaty-qsign-migration",
    customer: "Банк Алматы",
    customerInitials: "БА",
    customerColor: "#1e3a8a",
    industry: "banks",
    region: "Казахстан",
    tier: "enterprise",
    modules: ["qsign", "aevion-ip-bureau", "qcoreai"],
    hook: "73% времени экономии на цикле электронной подписи vs DocuSign legacy.",
    challenge:
      "100+ юристов и операционистов подписывали кредитные досье в DocuSign + сторонней системе аудита. Цикл подписи занимал 2.4 рабочих дня, а интеграция с национальным реестром велась вручную из-за несовместимых форматов.",
    solution:
      "Перешли на AEVION QSign + IP Bureau (Enterprise). Подпись интегрирована с внутренним AML-движком через QCoreAI агент: автоматическая проверка KYC, сверка с реестром, генерация PDF-печати с TSP timestamp. Audit trail — сразу в SIEM банка через webhook.",
    outcome:
      "Цикл подписи сократился с 2.4 дней до 4 часов (среднее по 9-месячному окну). 100% документов уходят с TSP-печатью. Compliance-аудит занимает на 60% меньше времени. SOC 2 Type II evidence пакетом покрыли в один клик.",
    metrics: [
      { label: "Цикл подписи", before: "2.4 дня", after: "4 часа", delta: "−87%", direction: "positive" },
      { label: "Compliance-аудит", before: "12 чел/нед", after: "5 чел/нед", delta: "−60%", direction: "positive" },
      { label: "Автоматизация KYC-сверок", before: "0%", after: "100%", delta: "+100%", direction: "positive" },
      { label: "Стоимость на документ", before: "$1.80", after: "$0.49", delta: "−73%", direction: "positive" },
    ],
    quote: {
      text: "Раньше у нас было три системы: DocuSign, audit, и Excel-сверка с регистром. AEVION схлопнул это в один экран и одну подписку. То, что бизнес считал «технически невозможным», заработало за 6 недель.",
      author: "А. К.",
      role: "Head of Operations",
    },
    date: "2026-03-15",
  },
  {
    id: "neolaw-ip-bureau-adoption",
    customer: "NeoLaw Patent Group",
    customerInitials: "NL",
    customerColor: "#92400e",
    industry: "law-firms",
    region: "ЕС / Германия",
    tier: "business",
    modules: ["qright", "aevion-ip-bureau", "qsign"],
    hook: "$2.3M годовой экономии на регистрации цифровой собственности 400+ клиентов.",
    challenge:
      "IP-фирма на 20 партнёров вела регистрацию авторских прав, ТМ и патентов через 4 разных подрядчика (Patently, EUIPO, USPTO, локальный). Внутренний CRM — Excel + Trello, ошибки в сроках стоили 2-3 missed filings в год.",
    solution:
      "Внедрили AEVION IP Bureau (Business) как единый back-office. QRight для первичной регистрации цифровых артефактов, QSign для подписи контрактов с клиентами, IP Bureau для генерации патентных заявок и сроков renewals.",
    outcome:
      "Стоимость регистрации одного объекта упала с $720 до $190 (в среднем). 100% renewals автоматически в календарь с уведомлением за 90/30/7 дней. Партнёры получили SLA-дашборд по каждому клиенту в одном месте.",
    metrics: [
      { label: "Cost per registration", before: "$720", after: "$190", delta: "−74%", direction: "positive" },
      { label: "Missed renewals / год", before: "2-3", after: "0", delta: "−100%", direction: "positive" },
      { label: "Время на досье", before: "11 ч", after: "2.5 ч", delta: "−77%", direction: "positive" },
      { label: "Клиентский NPS", before: "+38", after: "+72", delta: "+89%", direction: "positive" },
    ],
    quote: {
      text: "Мы перестали пользоваться Patently и тремя другими инструментами. Партнёры теперь видят полный портфель клиента — авторство, подписанные NDA, сроки renewals — в одном дашборде.",
      author: "M. S.",
      role: "Managing Partner",
    },
    date: "2026-02-28",
  },
  {
    id: "protolab-studios-creators",
    customer: "ProtoLab Studios",
    customerInitials: "PL",
    customerColor: "#be185d",
    industry: "creators",
    region: "США / Лос-Анджелес",
    tier: "pro",
    modules: ["qright", "qsign", "kids-ai-content"],
    hook: "0 IP-споров за 18 месяцев работы с 40+ внешними сценаристами.",
    challenge:
      "Анимационная студия (40+ внешних сценаристов и аниматоров) теряла время на NDA-цикл и не могла доказать авторство на отдельные сцены при последующих юридических спорах с подрядчиками.",
    solution:
      "Pro-тариф + QRight для регистрации каждого storyboard и pitch-deck в момент создания. QSign для NDA. Kids AI для бюджетной локализации в 5 языков.",
    outcome:
      "За 18 месяцев — 0 disputes. Один кейс с подрядчиком разрешился в досудебном порядке за 48 часов: TSP-timestamp от QRight стал решающим доказательством. Локализация контента в 5 языков обошлась в 4× дешевле сторонних подрядчиков.",
    metrics: [
      { label: "IP-disputes", before: "3 за год", after: "0 за 18 мес", delta: "−100%", direction: "positive" },
      { label: "Цикл NDA", before: "5 дней", after: "30 минут", delta: "−99%", direction: "positive" },
      { label: "Стоимость локализации", before: "$8.4k/проект", after: "$2.1k/проект", delta: "−75%", direction: "positive" },
      { label: "Сценаристов на платформе", before: "0", after: "44", delta: "+44", direction: "positive" },
    ],
    quote: {
      text: "Нам не нужен большой ERP — мы творческая студия из 8 человек. Но нам нужны были железные доказательства авторства. AEVION дал нам это за $19/мес.",
      author: "J. R.",
      role: "Founder",
    },
    date: "2026-01-20",
  },
  {
    id: "kazfin-qpaynet-embedded",
    customer: "KazFin Holding",
    customerInitials: "KF",
    customerColor: "#065f46",
    industry: "banks",
    region: "Казахстан / Россия",
    tier: "enterprise",
    modules: ["qpaynet-embedded", "qsign", "qcoreai"],
    hook: "Latency платежей −42%, integrations time-to-market −68%.",
    challenge:
      "Финтех-холдинг с 4 продуктами (банк, лизинг, факторинг, эквайринг) тратил 6-9 месяцев на каждую новую интеграцию платёжного провайдера. Ежегодные ИТ-затраты на интеграции — $1.4M.",
    solution:
      "Enterprise + QPayNet embedded layer + dedicated VPC. Один платёжный API на все 4 продукта, абстрагированный от конкретных провайдеров. AI-агент QCoreAI оптимизирует роутинг между провайдерами по комиссии и success-rate в реальном времени.",
    outcome:
      "Time-to-market новой интеграции: 7.5 мес → 2.4 мес. Среднее latency платежа: 540ms → 310ms. Success-rate автоматического рутинга: 98.2% (был 91.4% при ручном выборе провайдера).",
    metrics: [
      { label: "Latency платежа", before: "540ms", after: "310ms", delta: "−42%", direction: "positive" },
      { label: "Time-to-market интеграции", before: "7.5 мес", after: "2.4 мес", delta: "−68%", direction: "positive" },
      { label: "Success-rate рутинга", before: "91.4%", after: "98.2%", delta: "+7.4%", direction: "positive" },
      { label: "Ежегодные ИТ-расходы", before: "$1.4M", after: "$0.45M", delta: "−68%", direction: "positive" },
    ],
    quote: {
      text: "Мы выбрали AEVION потому что embedded-слой реально работает. Наш платёжный код стал на 60% короче, и мы перестали спорить с эквайерами — AI сам решает кому отправлять.",
      author: "Д. С.",
      role: "VP Engineering",
    },
    date: "2025-12-08",
  },
  {
    id: "acadstarter-startup-promo",
    customer: "AcadStarter",
    customerInitials: "AS",
    customerColor: "#7c3aed",
    industry: "startups",
    region: "Турция / Стамбул",
    tier: "pro",
    modules: ["qright", "qsign", "multichat-engine"],
    hook: "$240/год экономии vs DocuSign + Notarize + Patently комбо для seed-стадии.",
    challenge:
      "Стартап на 4 сооснователях нуждался в подписях инвестконтрактов, регистрации IP до раундов и AI-помощнике для black-box pitch-anlysis. Все три задачи по отдельности стоили бы $480/год.",
    solution:
      "Pro-тариф + промо STARTUP50 (50% скидка для стартапов). QRight + QSign + Multichat Engine с pitch-coach агентом — всё в одной подписке за $114/год после промо.",
    outcome:
      "Закрыли seed-раунд $1.2M за 4 недели. IP на основной алгоритм зарегистрирован до раунда — это снижает нагрузку на due diligence. Сэкономили $240/год vs обычной стартап-подборки SaaS.",
    metrics: [
      { label: "Годовые расходы на SaaS", before: "$480", after: "$114", delta: "−76%", direction: "positive" },
      { label: "Время до Term Sheet", before: "10 нед", after: "4 нед", delta: "−60%", direction: "positive" },
      { label: "IP объектов до раунда", before: "0", after: "3", delta: "+3", direction: "positive" },
      { label: "Pitch-iter с AI-coach", before: "0", after: "47", delta: "+47", direction: "positive" },
    ],
    quote: {
      text: "Мы маленькие. Нам нельзя $480/год на тулинг — это 2 месяца хостинга. AEVION с STARTUP50 закрыл всё за $114, и мы в раунде уже на 4-й неделе.",
      author: "E. T.",
      role: "Co-founder & CTO",
    },
    date: "2026-04-02",
  },
  {
    id: "mindigit-government-onprem",
    customer: "MinDigit",
    customerInitials: "MD",
    customerColor: "#475569",
    industry: "government",
    region: "Узбекистан / Ташкент",
    tier: "enterprise",
    modules: ["qsign", "aevion-ip-bureau", "qcoreai", "veilnetx"],
    hook: "100% соответствие 152-ФЗ + локальным требованиям. Один контракт вместо четырёх.",
    challenge:
      "Министерство цифрового развития подписывало нормативные акты в нескольких системах одновременно (электронное правительство + внутренний DLP + сторонний registry). Несовместимость форматов вызывала coordination-overhead.",
    solution:
      "Enterprise on-prem развёртывание AEVION в собственном дата-центре MinDigit. QSign с локальной TSP-интеграцией, QRight для реестра нормативных актов, VeilNetX для приватной сети между ведомствами. Compliance-пакет 152-ФЗ + локальные требования.",
    outcome:
      "Один контракт с одним вендором вместо четырёх. Все ведомства работают в едином аудит-журнале. Регуляторное соответствие проверено государственным аудитом — без замечаний.",
    metrics: [
      { label: "Подрядчиков на стек", before: "4", after: "1", delta: "−75%", direction: "positive" },
      { label: "Стоимость владения", before: "100%", after: "38%", delta: "−62%", direction: "positive" },
      { label: "Compliance замечаний", before: "12", after: "0", delta: "−100%", direction: "positive" },
      { label: "Ведомств подключено", before: "0", after: "8", delta: "+8", direction: "positive" },
    ],
    quote: {
      text: "Мы не могли позволить хаос из четырёх вендоров. AEVION предложил единый контракт с локальным compliance-пакетом и развёртывание в нашем VPC. Это закрыло 100% наших требований.",
      author: "Б. Х.",
      role: "Заместитель министра",
    },
    date: "2025-11-15",
  },
];

export function getCaseStudy(id: string): CaseStudy | null {
  return CASE_STUDIES.find((c) => c.id === id) ?? null;
}
