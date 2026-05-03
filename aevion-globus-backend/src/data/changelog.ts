/**
 * Changelog AEVION pricing-блока — для /pricing/changelog.
 * Хронологический journal публичных изменений (added/changed/removed/promo/...).
 *
 * Сортируется на бэке: новейшие сверху по `date` desc.
 * Source-of-truth для админ-обновлений — добавляем сверху массива.
 */

export type ChangelogKind =
  | "added"
  | "changed"
  | "removed"
  | "deprecated"
  | "promo"
  | "module";

export interface ChangelogEntry {
  date: string;
  kind: ChangelogKind;
  title: string;
  body: string;
  scope?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-04-29",
    kind: "added",
    title: "A/B-конверсия по вариантам в /pricing/admin",
    body: "Backend ручка GET /api/pricing/events/by-variant + воронка page_view → cta_click → lead_submit / checkout_start → checkout_success в разрезе hero/tierCards вариантов.",
    scope: "ab-analytics",
  },
  {
    date: "2026-04-29",
    kind: "added",
    title: "A/B/C variant для tier-cards",
    body: "Расширена ABKey: 'tierCards' с тремя вариантами — A (без highlight), B (highlight Pro), C (highlight Business). Метрики уезжают в track() с meta.variant_tierCards.",
    scope: "ab-experiment",
  },
  {
    date: "2026-04-29",
    kind: "added",
    title: "Sitemap — динамические /pricing/cases/[id]",
    body: "sitemap.ts тянет список case-id с GET /api/pricing/cases и публикует страницы кейсов в XML. Добавлены /pricing/calculator/embed, /affiliate-dashboard, /partners-portal.",
    scope: "seo",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "SSG для /pricing/cases/[id]",
    body: "generateStaticParams тянет cases с backend на этапе build — кейсы пре-рендерятся как статика. dynamicParams=true для новых кейсов добавленных после deploy.",
    scope: "ssg",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "Email-уведомления при apply через Resend",
    body: "При POST /affiliate/apply, /partners/apply, /edu/apply — auto-reply заявителю + notify в NOTIFY_EMAIL. Graceful stub-fallback в console если RESEND_API_KEY не задан.",
    scope: "email",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "CSV export на каждой табе /pricing/admin",
    body: "Кнопка Export CSV в leads/affiliate/partners/edu/newsletter. UTF-8 BOM для корректного открытия в Excel, RFC 4180 escaping.",
    scope: "admin",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/calculator/embed — iframe widget",
    body: "Embeddable калькулятор для блогов и партнёрских сайтов. postMessage resize, snippet с инструкцией копирования, авто-track события из родительской страницы.",
    scope: "embed",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/glossary — словарь 30 терминов",
    body: "TSP, eIDAS, SOC 2, GDPR, 152-ФЗ, PCI DSS и ещё 24 термина с EN/RU переводами и фильтром по категории. SEO-friendly anchor-навигация.",
    scope: "glossary",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/admin tabs — leads/affiliate/partners/edu/newsletter",
    body: "Шесть вкладок дашборда: overview (ивенты/воронка), leads, affiliate-applications, partners-applications, edu-sponsorship, newsletter. Token-gated через ADMIN_TOKEN.",
    scope: "admin",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "A/B/C variant система для hero-копирайта",
    body: "Cookie+localStorage assignment с 30-day TTL. Window.__aevion_ab debug API. Каждый track-event пишет meta.variant_hero.",
    scope: "ab-experiment",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/migrations — гайды миграции",
    body: "Пошаговые гайды миграции с DocuSign, Adobe Sign, конкурентов в QSign. Чек-листы, скрипты импорта, оценка времени.",
    scope: "migrations-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/integrations — каталог интеграций",
    body: "20+ интеграций: Slack, Teams, Notion, Salesforce, HubSpot, Stripe, Telegram. Status (live/beta/soon), category filter.",
    scope: "integrations-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/cases/[id] — детальные case-страницы",
    body: "Расширенный case-template: challenge, solution, outcome, metrics-таблица, цитата с автором/ролью, модули и тариф, related-cases по индустрии.",
    scope: "cases-detail",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/partners — channel program",
    body: "Reseller, System Integrator, Agency треки. Margin до 30%, deal-registration, joint go-to-market. Apply-форма с email-confirmation.",
    scope: "partners-program",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/edu — sponsorship для университетов",
    body: "Бесплатные семестровые лицензии для студентов и преподавателей. Apply-форма с проверкой institutional-домена. Pro-подписка на курс.",
    scope: "edu-program",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/affiliate — 20% recurring lifetime",
    body: "Affiliate-программа: 20% recurring от MRR на всю lifetime подписку. Cookie 60 дней, payouts ежемесячно через Stripe. Apply-форма + tracking-link.",
    scope: "affiliate-program",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/api-pricing — per-call билинг",
    body: "Per-call rate для разработчиков: QSign $0.05/sign, QRight $0.001/proof, QCoreAI токены. Volume-discount после 10K calls/month.",
    scope: "api-pricing",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/changelog — публичный журнал",
    body: "Хронологический journal изменений: added/changed/promo/module. Фильтр по типу, группировка по месяцам.",
    scope: "changelog",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/refund-policy — политика возвратов",
    body: "14-day money-back, прорейтинг, annual-расчёт, data retention 90+60 дней.",
    scope: "refund-policy",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/cases — 6 customer stories",
    body: "Публичный листинг кейсов с метриками before/after. Фильтрация по индустрии и тарифу.",
    scope: "cases-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "Полная матрица /pricing/compare",
    body: "Side-by-side сравнение 27 модулей × 4 тарифов. Sticky tier headers, фильтр по типу модуля.",
    scope: "compare-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "/pricing/security — Compliance & Security",
    body: "SOC 2 Type II, GDPR, 152-ФЗ, PCI DSS. 6 pillars безопасности, residency-таблица EU/RU/KZ, Bug Bounty.",
    scope: "security-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Динамические OG-images через next/og",
    body: "Edge-runtime генерация OpenGraph картинок для /pricing, /pricing/[tier], /pricing/for/[industry].",
    scope: "seo",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Public roadmap /pricing/roadmap",
    body: "27 модулей × 5 фаз c прогрессом и target window. Public-facing — для прозрачности.",
    scope: "roadmap-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Полная локализация EN/RU через usePricingT",
    body: "Словарь pricing-ключей с fallback EN→RU→ключ. Покрывает /pricing, [tier], for/[industry], contact, checkout.",
    scope: "i18n",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Provisioning подписки + welcome-email",
    body: "После Stripe-checkout — автоматический provisioning + welcome-email через Resend (с graceful stub-fallback).",
    scope: "billing",
  },
  {
    date: "2026-04-26",
    kind: "promo",
    title: "Промо-коды AEVION20, STARTUP50, EARLYBIRD, FRIEND10, TEAM100",
    body: "5 публичных промо-кодов: 20% запуск, 50% стартапам, 30% ранним, $10 рефералам, $100 командам.",
    scope: "promo",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Free trial 14 дней для Pro и Business",
    body: "Кнопка trial в карточках Pro/Business. Карта не списывается до окончания. Welcome-email с trialEnds.",
    scope: "trial",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Analytics ingest + /pricing/admin",
    body: "POST /api/pricing/events ingest. Token-gated дашборд /pricing/admin с разбивкой по событиям и tier.",
    scope: "analytics",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Stripe Checkout с graceful stub-fallback",
    body: "Реальный Stripe-чекаут с STRIPE_SECRET_KEY. Stub-режим (fake-success) для dev/staging без ключей.",
    scope: "checkout",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "POST /api/pricing/lead + /pricing/contact",
    body: "Lead-form с rate-limit 5/10мин, email-валидация. JSONL хранилище. Префилл от тарифа/индустрии.",
    scope: "leads",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Индустриальные лендинги /pricing/for/[industry]",
    body: "5 индустрий: banks, startups, government, creators, law-firms. Рекомендованный стек модулей под каждую.",
    scope: "industries",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Сравнение с конкурентами + общий FAQ",
    body: "Mini-таблица AEVION vs DocuSign / Stripe / OpenAI / Patently. 8 общих FAQ-вопросов.",
    scope: "compare-mini",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Детальные /pricing/[tierId]",
    body: "4 страницы: Free / Pro / Business / Enterprise. Расширенный список фич, лимиты, FAQ под тариф.",
    scope: "tier-pages",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "GTM Pricing API + публичный /pricing",
    body: "Backend /api/pricing отдаёт тарифы, модули, бандлы и валюты. Калькулятор сметы (POST /quote) с прорейтингом.",
    scope: "core",
  },
];
