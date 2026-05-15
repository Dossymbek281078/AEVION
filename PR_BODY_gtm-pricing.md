# GTM Pricing — production-ready лендинг-комплект для всех 27 модулей AEVION

Ветка `gtm-pricing-api` → `main` · **41 коммит** · build green (frontend + backend) · все 27 модулей покрыты единым прайс-слоем.

## Что внутри

### Public marketing страницы (19)

| Маршрут | Назначение |
|---|---|
| `/pricing` | Главная: tier-cards × 4 (с A/B), calculator, mini-comparison, FAQ |
| `/pricing/[tierId]` | Детальные страницы Free / Pro / Business / Enterprise |
| `/pricing/for/[industry]` | Лендинги для banks / startups / government / creators / law-firms |
| `/pricing/cases` + `/pricing/cases/[id]` | 6 customer-stories с ROI-метриками — **SSG через generateStaticParams** |
| `/pricing/compare` | Полная матрица 27 модулей × 4 тарифа |
| `/pricing/api-pricing` | Per-call билинг для разработчиков |
| `/pricing/integrations` | Каталог 20+ интеграций (Slack, Salesforce, Zapier и т.д.) |
| `/pricing/migrations` | Гайды миграции с DocuSign / OpenAI / Stripe / Patently |
| `/pricing/affiliate` | Реферальная программа 20% recurring lifetime |
| `/pricing/edu` | Sponsorship для университетов и хакатонов |
| `/pricing/partners` | Channel-программа (Reseller / SI / Agency) |
| `/pricing/refund-policy` | TL;DR + 6 секций + 4-step process |
| `/pricing/changelog` | **API-driven** journal с filter (kind/since) + pagination |
| `/pricing/glossary` | 30 терминов (TSP, eIDAS, SOC 2, ...) с EN/RU + filter |
| `/pricing/roadmap` | Public roadmap по 27 модулям |
| `/pricing/security` | SOC 2 / GDPR / 152-ФЗ / PCI DSS |

### Functional / forms (7)
- `/pricing/contact` — sales lead form (rate-limit + JSONL)
- `/pricing/checkout/{success,cancel}` — после Stripe
- `/pricing/admin` — token-gated dashboard с 6 tabs + CSV export + **A/B conversion funnel**
- `/pricing/calculator/embed` — iframe widget для блогов (postMessage resize)
- **`/pricing/affiliate-dashboard`** ⭐ — magic-link auth + ref-link + stats
- **`/pricing/partners-portal`** ⭐ — magic-link + deal registration + pipeline

### Backend (`aevion-globus-backend/src/routes/pricing.ts`, `events.ts`)

**Public:**
- `GET /api/pricing` — все тарифы + модули + бандлы + валюты
- `GET /api/pricing/{tiers,modules,bundles,promo,roadmap,trust,testimonials,changelog}`
- `POST /api/pricing/quote` — расчёт сметы
- `POST /api/pricing/promo/validate`
- `POST /api/pricing/lead` — sales-leads (rate-limit, JSONL)
- `POST /api/pricing/newsletter`
- `POST /api/pricing/checkout/session` — Stripe + stub fallback
- `POST /api/pricing/events` — analytics ingest (16 event types)
- `GET /api/pricing/cases`, `GET /api/pricing/cases/:id`
- `POST /api/pricing/{affiliate,partners,edu}/apply` (rate-limit 3/10мин, JSONL, **email через Resend**)
- `POST /api/pricing/{affiliate,partners}/magic-link` — magic-link auth (HMAC SHA-256)
- `GET /api/pricing/affiliate/dashboard?email=&token=` — affiliate self-service
- `GET /api/pricing/partners/dashboard?email=&token=` — partner self-service
- `POST /api/pricing/partners/deals` — partner deal registration

**Token-gated (`x-admin-token`):**
- `GET /api/pricing/leads`
- `GET /api/pricing/applications?kind={affiliate|partner|edu}`
- `GET /api/pricing/newsletter/list`
- `GET /api/pricing/events/{summary,recent}`
- `GET /api/pricing/events/by-variant?hours=&keys=hero,tierCards` — **A/B-конверсия**

### Killer-фичи

- **A/B/C variants** на 2 уровнях (hero copy + tier-cards highlight) — cookie + localStorage, sticky 30 days, `window.__aevion_ab` debug API
- **A/B conversion funnel** в admin: page_view → cta_click → lead_submit / checkout_start → checkout_success в разрезе вариантов
- **Magic-link auth** для self-service dashboards (HMAC-SHA-256, 32-hex token, scope `affiliate|partners`)
- **SSG для case-detail**: `generateStaticParams` тянет cases с backend на этапе build, `dynamicParams=true` для post-deploy кейсов
- **Динамические OG-images** через `next/og` (edge runtime) — 11 уникальных
- **Полная локализация** EN/RU через `usePricingT` (~830 ключей, расщеплено по секциям)
- **Stripe Checkout** с graceful stub-fallback для dev/staging
- **Provisioning + welcome-email** через Resend (с stub fallback)
- **Email-уведомления** при apply (auto-reply + internal notify через Resend)
- **CSV export** на каждой табе admin (UTF-8 BOM, RFC 4180)
- **Sitemap.xml** с динамическими `/pricing/cases/[id]` + canonical на каждой странице
- **Промо-коды**: AEVION20, STARTUP50, EARLYBIRD, FRIEND10, TEAM100
- **Free trial 14 дней** на Pro / Business

## Безопасность

- PII (`leads.jsonl`, `affiliate.jsonl`, `partners.jsonl`, `edu.jsonl`, `newsletter.jsonl`, `events.jsonl`, `subscriptions.jsonl`, `partner-deals.jsonl`) **исключены из репо** через `.gitignore`
- Все public POST endpoints имеют rate-limit per IP (5/10мин для leads, 3/10мин для program-applications + magic-link, 60/мин для events)
- Email-валидация на сервере, length-limits на всех полях
- Magic-link **всегда отвечает 204** — не раскрываем существование email в системе
- HMAC token из `DASHBOARD_SECRET || ADMIN_TOKEN` через `timingSafeEqual` для constant-time сравнения
- Token-gated admin (ENV `ADMIN_TOKEN`) — отдаёт 401 если токен не сконфигурирован
- `/affiliate-dashboard` и `/partners-portal` помечены `robots: noindex, nofollow`

## Как запустить локально

```bash
# Backend
cd aevion-globus-backend
npm install
npm run dev   # http://127.0.0.1:4001

# Frontend
cd ../frontend
npm install
npm run dev   # http://localhost:3000/pricing
```

ENV для production-готовности (опционально, есть stub-fallback):
- `STRIPE_SECRET_KEY` — реальный Stripe checkout
- `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFY_EMAIL` — emails (auto-reply, magic-link, notify)
- `ADMIN_TOKEN` — доступ к `/pricing/admin`
- `DASHBOARD_SECRET` (опционально, иначе ADMIN_TOKEN) — HMAC для magic-link
- `PUBLIC_SITE_URL` (default `https://aevion.io`) — base для magic-link URL

## Test plan

- [ ] Открыть `/pricing` — увидеть tier-cards (с A/B highlight), calculator работает on-the-fly
- [ ] Перейти по footer-links: compare / cases / integrations / migrations / affiliate / edu / partners / api-pricing / refund-policy / changelog / glossary — все рендерятся
- [ ] Заполнить форму на `/pricing/affiliate` — заявка → JSONL + 2 emails (auto-reply + notify)
- [ ] На `/pricing/affiliate-dashboard` ввести email → magic-link → войти → увидеть ref-link и нулевые stats
- [ ] На `/pricing/partners-portal` войти magic-link → зарегистрировать сделку → увидеть в pipeline
- [ ] Открыть `/pricing/admin` с ADMIN_TOKEN — 6 tabs + CSV export + A/B funnel section
- [ ] В консоли: `__aevion_ab.set('tierCards', 'C'); location.reload()` — увидеть highlight Business
- [ ] Sitemap.xml — все pricing-страницы + cases/[id] перечислены
- [ ] OG-images: `/pricing/opengraph-image` → PNG

## Roadmap (не входит, на следующие итерации)

- Real affiliate-tracking: `?ref=` → POST /track → JSONL → агрегация в dashboard вместо нулей
- Magic-link expiry: timestamp в HMAC + проверка ≤24h
- A/B significance: chi-square p-value в `/events/by-variant`
- Дальнейший split `pricingI18n.ts` по секциям (8 кандидатов: glossary/partners/edu/affiliate/cases/compare-full/api-pricing/integrations) — migrations уже extracted
- Partner deal status workflow (registered→qualified→won/lost)
- Newsletter integration с changelog auto-digest

🤖 Generated with [Claude Code](https://claude.com/claude-code)
