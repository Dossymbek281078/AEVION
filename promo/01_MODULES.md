# Планета AEVION — модули

> Каждый модуль = карточка для презентации (one-liner + бенефит + привилегия для покупателя + статус).
> Сгруппировано по пяти столпам из `PROMPT.md`.
> Live-проверка: `https://aevion.app/launch-status` и `/api/aevion/registry`.

---

## I. Финансовый слой

### 1. AEV (AEVION native token)

- **Что это:** расчётная единица планеты, cap 21 000 000, ledger в Postgres, 4 engine-источника эмиссии.
- **Бенефит:** единая валюта расчёта между всеми 30+ модулями, биллинг подписок, монетизация AI-токенов (QCoreAI), reward-engine для consumer-витрин.
- **Привилегия покупателя:** treasury в AEV переходит к покупателю; cap 21M зафиксирован — это **дисциплина денежной массы**, которую невозможно подделать.
- **Статус:** `aev-pickup` ветка прошла в main, 65+ коммитов, /api/aev/* 6 endpoints, smoke 10/10.

### 2. QPayNet

- **Что это:** embedded-payments. Stripe deposit + payouts + KYC + webhooks retry + SMTP-email notifications.
- **Бенефит:** любой модуль AEVION может выписать чек или принять платёж за 1 endpoint-вызов.
- **Привилегия покупателя:** готовая платёжная рельса с прохождением KYC + регулярная история webhooks.
- **Статус:** ~99.5% prod-ready (см. `qpaynet_full_session_2026-05-04.md`).

### 3. AEVION Bank

- **Что это:** UI и backend для бытового банкинга — счета, карты, переводы, FX.
- **Бенефит:** конечный пользователь видит «свой банк» внутри AEVION без перехода на сторонний фронт.
- **Привилегия покупателя:** retail-фасад с SEO/OG + 19 features + compliance trio + cursor pagination.
- **Статус:** 255 commits, 17/17 tests PASS, Postgres scaffold, HMAC webhooks.

### 4. Payments Rail (B2B)

- **Что это:** v1.1 production-hardened, 9 surfaces + 6 реальных `/api/payments/v1/*` routes, OpenAPI 3.1, sitemap.
- **Бенефит:** B2B-payment-rails для партнёров.
- **Привилегия покупателя:** документированный API-контракт под OpenAPI 3.1.
- **Статус:** HEAD `6f96326`, build green.

### 5. QTrade (spot exchange)

- **Что это:** биржа спот, история ордеров, SL-TP/OCO/DCA/grid, backtest, fees, Portfolio Sharpe/PF.
- **Бенефит:** биржевой UI поверх AEV-ledger.
- **Привилегия покупателя:** trading-витрина с реалистичным workflow.

### 6. QTradeOffline

- **Что это:** **офлайн-подписанные P2P транзакции AEV** (ECDSA P-256). Подпишешь без интернета → потом sync → batch claim.
- **Бенефит:** AEV работает в зонах без связи (фронтиры, регулируемые юрисдикции, кризисные сценарии).
- **Привилегия покупателя:** edge-кейс, которого нет ни у Visa, ни у Stripe.
- **Статус:** `qtradeoffline-v1` PUSHED, smoke 3/3 PASS.

---

## II. Защита и право

### 7. QSign v2 (digital signatures)

- **Что это:** ML-DSA-65 (FIPS 204) Dilithium-signatures, **GA-релиз**, SDK published, Sentry, env-rotation.
- **Бенефит:** любой документ или артефакт может быть подписан post-quantum-стойко прямо сейчас.
- **Привилегия покупателя:** один из немногих в индустрии **уже выкаченных** FIPS 204 продуктов.
- **Статус:** PR #17 + #21 merged, prod smoke 20/20 PASS.

### 8. QShield (threshold secrets)

- **Что это:** secret sharing с Lagrange-реконструкцией; distributed_v2 c witness CID; audit + revoke + /metrics + OpenAPI; идемпотентный replay-protect.
- **Бенефит:** хранение и восстановление критических секретов без single point of trust.
- **Привилегия покупателя:** `/metrics` Prometheus, OpenAPI, SDK published.
- **Статус:** PR #23 merged 990200e, prod smoke 14/14 PASS.

### 9. QRight (IP registry)

- **Что это:** реестр интеллектуальной собственности с public reference page, attestation, owner audit-snippet.
- **Бенефит:** «момент создания» AI-объектов фиксируется в открытом регистре.
- **Привилегия покупателя:** legally-defensible timestamping для AI-эры.
- **Статус:** Tier 2 MERGED (PR #18, #22).

### 10. QContract (self-destruct docs)

- **Что это:** документы с burn-N-reads, time-expiry, password, email-signature watermark, QRight badge, templates.
- **Бенефит:** контракты живут ровно столько, сколько нужно — без копий в почтовом архиве.
- **Привилегия покупателя:** готовый legal-tech продукт с SaaS-фасадом.
- **Статус:** v1.1 SHIPPED.

### 11. QChainGov

- **Что это:** governance-tech — голосования, аудит решений, on-chain протоколы.
- **Бенефит:** легитимность решений внутри платформы.
- **Статус:** MVP в проде, fintech ecosystem v2.

### 12. QMaskCard

- **Что это:** privacy-preserving идентификация (selective disclosure, ZK-friendly stubs).
- **Бенефит:** «покажи возраст, не показывая дату рождения».
- **Статус:** MVP в проде.

### 13. VeilNetX

- **Что это:** ledger + защищённая передача данных между модулями.
- **Бенефит:** межмодульный безопасный канал.
- **Статус:** MVP в проде.

### 14. Z-Tide

- **Что это:** анти-фрод сигналы, rank-pill в UI, /fintech/status агрегатор.
- **Бенефит:** общий fraud-screen для всех денежных модулей.
- **Статус:** ZTideRankPill в проде, прод-smoke 13/13.

---

## III. Dev-слой / Planet DevHub

### 15. AEVION DevHub ⭐ (key differentiator)

- **Что это:** **единый agent-layer**, проксирующий 9 интеграций под общим AEV-биллингом:
  - GitHub (OAuth-stub, repo/file actions)
  - Vercel (deployments)
  - Railway (services, env)
  - ElevenLabs (TTS, music, voice library)
  - Brevo (email campaigns, contacts)
  - Stripe (checkout, customers)
  - DALL-E / OpenAI image
  - Cloudflare (DNS, R2)
  - Google Drive (files)
- **Backlog (готовится):** voice clone, per-user GitHub OAuth, Brevo SMS, DeepL (translation).
- **Бенефит:** **15-вкладочный workflow становится одним кабинетом и одним счётом.**
- **Привилегия покупателя:** breadth, которую нельзя купить — 9+ интеграций под комплаенсом.
- **Статус:** 9 интеграций live + 23 vitest PASS. HEAD `b78af310`.

### 16. QCoreAI

- **Что это:** AI-marketplace, 5+ провайдеров (OpenAI, Anthropic, Mistral, Google AI, локальные модели), 230 routes / 490 vitest PASS, SDK v0.9, V4-V30 merged.
- **Бенефит:** один SDK, любой провайдер; биллинг в AEV per-token.
- **Привилегия покупателя:** AI-uptime смикширован между провайдерами.

### 17. QBuild (recruiting platform)

- **Что это:** 60+ endpoints, 16 sub-routers, 28 frontend routes. AI-shortlist / cover / interview-prep / translate / labels / bulk DM / notes / clone / template / j-k shortcuts. Partner public API + drop-in widget.
- **Бенефит:** HH-конкурент с AI-нативным ATS.
- **Статус:** PR #108 merged, 30/30 tests PASS.

### 18. Bureau v2

- **Что это:** OG images + sitemap + POST `/protect-batch` + ETag/304 + enriched `/health`.
- **Бенефит:** Bureau-as-a-service для модулей платформы.
- **Статус:** 25 commits, HEAD `71e7700`, build green.

---

## IV. Consumer-витрины (proof of execution)

### 19. CyberChess

- **Что это:** шахматный продукт vs lichess + chess.com. Главный дифференциатор — **AEVION CPI (Chess Performance Index)** — композитный рейтинг из CPL/time/book/best-line/mate-vision/hangs/brilliancy + result-bonus. Даёт баллы даже за проигрыш.
- **Подсистемы:** Coach с 93 knowledge entries в 9 категориях (debuts, middlegame, time, memory, growth), Library v2, Premium gating, variant-tutorials (Fischer960/Atomic/KotH/Three-Check/Crazyhouse), spaced-rep SM-2, billing wire-up через QPayNet, COEP credentialless для Stockfish 18.
- **Бенефит:** **доказательство**, что AEVION-инфраструктура держит массовый продукт.
- **Привилегия покупателя:** retention-кривая + 5818 пазлов corpus.
- **Статус:** R² калибровки 0.08 → 0.48, HEAD `a7819134`.

### 20. HealthAI v3

- **Что это:** AI-screener + plan + family + cycle + plan-history + population + mobile + notifications + referrals.
- **Бенефит:** health-вертикаль с подписочной моделью.
- **Статус:** 19 commits, build green.

### 21. Multichat

- **Что это:** AI-чат с handoff между моделями, context-pinning, presets, i18n, broadcast, token meter, fork, workspaces, `?demo=1`.
- **Бенефит:** ChatGPT-конкурент с multi-provider routing.
- **Статус:** 12 фич, HEAD `1f1c06f`.

### 22. KidsAI

- **Что это:** образовательный AI для детей на узком корпусе.
- **Статус:** v2-corpus в проде.

### 23. Smeta Trainer

- **Что это:** AI-тренажёр сметного дела РК (узкий учебный корпус, calc-engine, AI-советник на типовых ошибках студента).
- **Бенефит:** edtech-проникновение в профессиональные курсы.
- **Статус:** P1 в работе.

### 24. MapReality

- **Что это:** geo-сервис, nearby-витрина v2.
- **Статус:** в проде.

### 25. LifeBox

- **Что это:** life-management MVP.
- **Статус:** в проде.

### 26. StartupX

- **Что это:** AI-score для стартапов, v2.
- **Статус:** в проде.

### 27. PsyApp Deps

- **Что это:** psychological dependencies trainer MVP.
- **Статус:** в проде.

### 28. QFusionAI

- **Что это:** AI-fusion одной из вертикалей.
- **Статус:** MVP shipped 5b9b4787.

### 29. QGood, ShadowNet, QLife, QPersona, DeepSan, Voe, MapReality

- Семейство landing+MVP-витрин, каждая со своей вертикалью.

---

## V. Governance / Trust

### 30. AEVION Constitution v1

- **Что это:** учредительный документ, опубликован в Planet через QSign envelope (коммит `1cacd5a1`), три языка (RU/EN/KK).
- **Бенефит:** правовой режим продукта.
- **Привилегия покупателя:** наследует **легитимный документ**, а не «правила в Notion».

### 31. /planet (registry of attestations)

- **Что это:** публичный реестр аттестованных артефактов (movie/music/code/web), валидаторы, threshold, public explanation.
- **Бенефит:** «доказательство существования» AI-генерируемых объектов в момент создания.

### 32. /transparency

- **Что это:** health-board, daily smoke, статусы модулей.
- **Бенефит:** доверие через прозрачность.

### 33. AEVION_COORDINATION.md

- **Что это:** внутренний протокол синхронизации между параллельными сессиями разработки.
- **Бенефит:** операционная дисциплина видна изнутри.

### 34. /awards, /press, /changelog, /developers, /api-explorer, /legal, /pricing

- **Бенефит:** «нормальная» площадка с пресс-секцией, ченджлогом, лицензиями, прайсом.

---

## Сводка по группам

| Группа | Кол-во модулей | Прод-готовность |
|--------|-----------------|------------------|
| Финансовый | 6 | 5/6 в проде, AEV в обращении |
| Защита и право | 8 | 7/8 в проде, QSign GA |
| Dev-слой | 4 | DevHub 9 интеграций live |
| Consumer | 10+ | 7+ retention-products в проде |
| Governance | 6 | Constitution v1 опубликован |

**Итого:** 30+ модулей под единой расчётной единицей и единым регистром. Воспроизвести = 36-48 месяцев.

---

— редакция 2026-05-22, AEVION
