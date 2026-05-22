# Планета AEVION — общий питч

> Аудитория: стратегический покупатель (Stripe / Visa / Microsoft / Alibaba / суверенный фонд).
> Цель документа: довести до решения **«готов рассматривать $1B exit»**.
> Используется в трёх режимах: 60-секундный лифт, 3-минутный одностраничник, 12-минутный deck.

---

## 60 секунд (elevator)

Три волны сошлись в одной точке.

**Первая.** Банковские системы становятся API-first — в ближайшие 5-7 лет «банк» будет означать «слой API + расчётная единица», а не отделение.

**Вторая.** Авторское право и патенты переезжают в континуальную on-chain аттестацию — потому что AI-контент сделал «момент создания» главным юридическим вопросом эпохи.

**Третья.** Dev-стек схлопывается. Сегодня, чтобы выпустить простой сайт с видео, держат 15 вкладок: GitHub, Vercel, Railway, Cloudflare, ElevenLabs, DALL-E, Brevo, Stripe, Drive, Notion, DeepL, Sentry, домен, аналитика, тикеты. Это рассыпется в один agent-layer.

**AEVION — это инфраструктура, в которой все три волны уже работают.** Не «будут работать». Расчётная единица в обращении, регистр модулей опубликован, DevHub подключён к 9+ провайдерам в проде. 30+ модулей. Compositional moat: AEV + регистры (Planet, QRight, Constitution) + agent-layer + consumer-витрины (CyberChess, HealthAI).

**Мы готовы обсуждать exit за $1B net с сохранением основателя как Senior Advisor.** Семь строк условий — на финальном слайде.

---

## 3 минуты (one-pager)

### Почему сейчас

Три макроперехода произошли тихо, и ни один peer их **в комплексе** не закрывает:

1. **Деньги в интернете.** Платежи, расчёты, выпуск активов, KYC, escrow — это уже API-задачи. Banking-as-a-service вырос с $4B до $30B+ за пять лет (McKinsey 2024). Регулятор догоняет, но компании, которые сейчас держат расчётные рельсы, заработают премиум за десятилетие. Stripe ($95B), Plaid ($13.4B), Adyen ($45B) — это **отдельные** рельсы. AEVION — это **единая** рельса (AEV + QPayNet + AEVION Bank + Payments Rail) + история транзакций + IP-привязка к создателю.
2. **Право в интернете.** Любой AI-генерируемый объект (видео, музыка, дизайн, код) ставит юристу вопрос «кто автор и в какой момент». Без аттестации в реальном времени — это ничейная зона. AEVION публикует объекты в Planet (с QSign-envelope, см. коммит `1cacd5a1`), регистрирует IP в QRight, шифрует секреты в QShield (threshold-shares, ML-DSA-65 FIPS 204). Получается «notary-as-default».
3. **Dev в одной комнате.** В 2026 на запуск простого продукта уходит 15 SaaS-подписок и 15 admin-кабинетов. **AEVION DevHub** — один кабинет, один логин AEVION, один счёт в AEV, прокси на 9+ провайдеров (GitHub, Vercel, Railway, ElevenLabs, Brevo, Stripe, DALL-E, Cloudflare, Drive, DeepL). Это не лендинг — это `aevion-globus-backend/src/routes/devhub.ts` плюс UI, плюс 23 vitest, плюс прод-эндпоинт.

### Что у нас уже есть (proof, не roadmap)

- **30+ модулей в проде** под единым AEV-логином и общим регистром `/api/aevion/registry`.
- **AEV native token** — cap 21M, 4 engine-источника эмиссии, баланс per-account, ledger entries, /api/aev/* 6 endpoints, smoke 10/10. Это **расчётная единица** для всей планеты.
- **Constitution** — публикуется в Planet через QSign envelope (коммит `1cacd5a1`). Это «учредительный документ», к которому привязаны все модули.
- **DevHub** — 9 интеграций live (GitHub OAuth-stub, Vercel, Railway, ElevenLabs, Brevo, Stripe, DALL-E, Cloudflare, Google Drive). 23 vitest PASS. Backlog: voice clone, per-user GitHub OAuth, Brevo SMS, DeepL — это полировка, не дыры.
- **QSign v2** GA — ML-DSA-65 (FIPS 204) **уже выкаченный продукт**, Sentry, SDK published. Конкуренты ещё в proposal-стадии.
- **QShield** — distributed_v2 c witness CID, threshold reject, idempotency replay tested на проде. Lagrange-reconstruct работает.
- **QRight** — реестр IP-объектов с public reference page и attestation.
- **AEVION Bank** — payment-layer, 17/17 tests PASS, Postgres scaffold, HMAC webhooks, cursor pagination.
- **CyberChess** — composite rating AEVION CPI (Chess Performance Index), 5818 пазлов, mobile-ready, COEP-credentialless для Stockfish 18, Coach knowledge база с 93 entries в 9 категориях. Это **proof of execution** на массовом продукте.
- **HealthAI v3** — auth/family/cycle/plan-history/mobile/notifications, 19 commits, build green.
- **QBuild** — 60+ endpoints, 28 frontend routes, 30/30 tests, AI-shortlist, partner public API. Recruiting-платформа в проде.
- **QPayNet** — Stripe deposit + payouts + notifications + KYC + webhooks retry. ~99.5% prod-ready.

(Полный список см. `01_MODULES.md`.)

### Чего нельзя воспроизвести за деньги

1. **AEV в обращении.** Доверие к расчётной единице нельзя купить — оно накопилось от истории транзакций.
2. **Compositional registry.** `/api/aevion/registry` — это не каталог. Это **граф зависимостей** между 30+ модулями с health-pings, version-pinning и cross-module witness-attestations.
3. **DevHub breadth.** 9+ интеграций под единым auth-, биллинг- и аудит-контуром. Это 36+ месяцев комплаенс-работы для нового игрока.
4. **AEVION Constitution + Planet attestations.** Юридически и идеологически фиксированный контур — это уже не «фича», это «правовой режим продукта».

### Сделка

**$1 000 000 000 USD net (после налогов)** + Senior Advisor on AEVION matters + retained brand + 24-мес continuity. Полные условия — в `02_DEAL_TERMS.md`.

---

## 12 минут (deck)

### Слайд 1 — Тезис

> Все деньги, всё IP и весь dev переезжают в интернет.
> AEVION — единственное место, где все три перехода случаются под одной расчётной единицей.

### Слайд 2 — Три макроволны

(Диаграмма пересечения трёх кругов. В центре — логотип AEVION.)
- Круг 1: BaaS, embedded finance, stablecoin rails — $20T flow к 2030
- Круг 2: AI-IP, on-chain attestation, патенты в реальном времени — $400B IP+cyber
- Круг 3: dev-agent layer, AI-нативный DevOps — $200B dev-tools+IT-ops

### Слайд 3 — Пять столпов AEVION

| Столп | Что внутри | Один номер |
|-------|-----------|------------|
| Финансовый | AEV / QPayNet / Bank / Payments Rail / QTrade | AEV cap 21M, 6 /api/aev endpoints |
| Защита & Право | QSign / QShield / QRight / QContract / QChainGov / QMaskCard | ML-DSA-65 FIPS 204 в проде |
| Dev-layer | DevHub / QCoreAI / QBuild / Bureau | 9 integrations live, 23 vitest |
| Consumer | CyberChess / HealthAI / Multichat / KidsAI / Smeta / MapReality / LifeBox / StartupX | 30+ live UI surfaces |
| Governance | Constitution / Planet / Transparency | QSign-attested Constitution v1 |

### Слайд 4 — Killer-фича для понимания

**«15 вкладок → 1 кабинет.»**

(Слева: монтаж из 15 логотипов SaaS-подписок, на которые средний инди-стартап тратит $400-1200/мес.)
(Справа: один скриншот AEVION DevHub.)

Подпись: «В 2026 запустить сайт с видео = 15 подписок + 15 паролей + 15 биллингов. AEVION DevHub — одна вкладка, один AEV-счёт, 9 интеграций в проде, ещё 5 в очереди.»

### Слайд 5 — Финансовый слой подробно

- **AEV token** — cap 21M, ledger в Postgres, 4 источника эмиссии (mining-stub, faucet, reward-engine, treasury). Не «крипто», а **расчётная единица планеты** с фиксированной супплай-моделью.
- **QPayNet** — Stripe-on-rails: deposit, payouts, KYC, webhooks с retry. Embedded-payments-as-a-service.
- **AEVION Bank** — UI и backend для бытового банкинга, 17/17 tests, HMAC webhooks.
- **Payments Rail** — v1.1 production-hardened, OpenAPI 3.1, 10 OG images, sitemap.
- **QTrade + QTradeOffline** — спот-биржа + оффлайн-подписанные транзакции (ECDSA P-256, batch sync).

**Что это значит для покупателя:** готовый «банк, биржа и платёжная сеть» под одной крышей. Не нужно покупать три компании.

### Слайд 6 — Защита и право подробно

- **QSign v2** — Dilithium ML-DSA-65 (FIPS 204), SDK published, prod smoke 20/20 PASS.
- **QShield** — секретный шеринг с threshold-reconstruction (Lagrange), distributed_v2 c witness CID, audit + revoke + /metrics + OpenAPI.
- **QRight** — реестр IP-объектов, owner audit-snippet на public-странице.
- **QContract** — self-destruct documents (burn-N-reads, time-expiry, email-watermark).
- **QChainGov** — governance-tech (полу-децентр голосования внутри AEVION).
- **QMaskCard** — privacy-preserving идентификация.

**Что это значит для покупателя:** trust-as-a-service для AI-эры. Когда любой AI-генерируемый объект требует «notary-as-default» — AEVION уже стоит на этой полке.

### Слайд 7 — Dev-слой и DevHub

(Скриншот DevHub: одна страница со списком 9 интеграций с zero-config.)

- **DevHub** — один логин AEVION, проксирующий 9+ внешних провайдеров под общими токенами и общим биллингом в AEV.
- **QCoreAI** — AI-провайдеры (5+), 230 routes / 490 vitest PASS, SDK v0.9. Это AI-marketplace, который монетизируется per-token в AEV.
- **QBuild** — recruiting-платформа vs HH: 60+ endpoints, AI-shortlist, partner API, drop-in widget.
- **Bureau v2** — protect-batch, ETag/304, enriched /health. Bureau-как-сервис.

**Что это значит для покупателя:** developer love (дефицитнейший ресурс эпохи). Кто владеет dev-кабинетом — владеет следующим поколением продуктов.

### Слайд 8 — Consumer-витрины (proof of execution)

Семь продуктов, в которых ежедневно сидят настоящие пользователи и которые служат **доказательством** что слой работает:

- **CyberChess** — AEVION CPI (Chess Performance Index, R² 0.48 после калибровки), 5818 пазлов, Coach с 93 знаниями, mobile, monetization tier (Free/Pro 500AEV/Ultimate 5000AEV).
- **HealthAI** — анкета, план, family, cycle, plan-history. v3 production-ready.
- **Multichat** — handoff/context/presets/i18n/broadcast/token-meter, 8 endpoints + 2 страницы.
- **KidsAI** — образовательный AI для детей (corpus-driven).
- **Smeta Trainer** — AI-тренажёр сметного дела РК (учебный корпус, calc-engine).
- **MapReality** — geo-сервис, nearby-витрина v2.
- **LifeBox, StartupX, PsyApp, QFusionAI, VeilNetX, Q-Good, Z-Tide** — отдельные витрины со своими ICP.

**Что это значит для покупателя:** 7+ consumer-продуктов, каждый со своей retention-кривой и потенциалом независимой монетизации.

### Слайд 9 — Governance / Trust

- **AEVION Constitution v1** — учредительный документ, опубликован в Planet через QSign envelope (`1cacd5a1`). Доступен в трёх языках (RU/EN/KK).
- **`/planet`** — публичный реестр аттестаций.
- **`/transparency`** — health-board: 24/24 daily smoke, статус каждого модуля.
- **`AEVION_COORDINATION.md`** — внутренний sync-протокол, видно как организована команда.

### Слайд 10 — Метрики, которые покупатель проверит сам

| Источник | Что показывает |
|----------|-----------------|
| `https://aevion.app/launch-status` | Дайджест запусков |
| `/api/aevion/health` | Health всех модулей |
| `/api/aevion/registry` | Полный реестр |
| `/api/aevion/stats` | Coverage по health/openapi/frontend/og |
| `/transparency` | Smoke-history |
| `/planet` | Аттестации артефактов |
| `/constitution` | Учредительный документ |

### Слайд 11 — Что нельзя купить, что мы продаём

Compositional moat, не отдельные продукты.

1. **AEV в обращении** — нельзя ускорить.
2. **Регистр Constitution + Planet attestations** — юридический контур, который мы публикуем continuously.
3. **DevHub breadth** — 36+ месяцев комплаенса с провайдерами.
4. **30+ модулей с health-pings** — каждый отдельно стоит 6-18 месяцев инженерной работы.

### Слайд 12 — Сделка

> **$1 000 000 000 USD net (после налогов)**
>
> 70% cash at close + 30% retention bonus (24 мес)
> Должность основателя: **Senior Advisor on AEVION matters**
> Бренд AEVION сохраняется
> AEV cap 21M остаётся неизменным (доверие держателей)
> Команда + retention 24 мес
> Эксклюзивность 60 дней по сигнингу LOI
> Юрисдикция: Делавэр US или DIFC Дубай — на выбор покупателя

(подробно — `02_DEAL_TERMS.md`)

---

## Приложение A — Comparable transactions (для калибровки)

| Сделка | Год | Сумма | Что входило |
|--------|-----|-------|--------------|
| Plaid (Visa, отменено) | 2020 | $5.3B | API-агрегатор счетов |
| Square × Afterpay | 2021 | $29B | Payments + BNPL |
| Microsoft × GitHub | 2018 | $7.5B | Dev-platform |
| Atlassian × Trello | 2017 | $425M | Один dev-инструмент |
| Adobe × Figma (отменено) | 2022 | $20B | Design-collab |
| Stripe (private mark) | 2023 | $50B-95B | Payments rail |

**Калибровка:** AEVION = «Plaid + GitHub + ранний Stripe + Figma + on-chain notary» в одном контуре. $1B — **нижняя граница**, оптимизированная на быстрый closing.

---

## Приложение B — TAM, на котором мы стоим

| Сегмент | 2026 | 2030 (mid) | Источник |
|---------|------|-----------|----------|
| Global digital payments (flow) | $11T | $20T | McKinsey, BCG |
| Embedded finance revenue | $30B | $230B | Bain |
| Banking-as-a-service | $30B | $90B | Allied Market Research |
| Dev-tools + IT-ops | $200B | $400B | Gartner |
| Cybersec (secrets, attestation) | $230B | $400B | Statista |
| IP economy / royalties | $400B | $700B | WIPO derivatives |

**Сумма пересечений (не сложение):** ≈ $1.5-2T реалистичного «адресуемого пространства» к 2030 году. AEVION претендует на 0.05-0.1% этого пространства за 5 лет — это $750M-$2B ARR run-rate. **$1B exit — это floor, не ceiling.**

---

— Финальная редакция 2026-05-22, AEVION
