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
  { label: "Модулей платформы", value: "27", hint: "в одной подписке (на Business)" },
  { label: "Время до первой подписи", value: "<60s", hint: "от регистрации в QSign" },
  { label: "API uptime SLA", value: "99.5%", hint: "Business · 99.95% Enterprise" },
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
