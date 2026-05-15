/**
 * i18n словарь для /pricing/migrations.
 * Самая объёмная секция (~110 ключей × 2 языка) — выделена в отдельный
 * файл, чтобы основной pricingI18n.ts не превышал ~1000 строк.
 *
 * Pattern: `{ ru: Record<string,string>, en: Record<string,string> }`
 * — главный файл подмешивает через spread.
 */
export const migrationsDict: { ru: Record<string, string>; en: Record<string, string> } = {
  ru: {
    "migrations.badge": "MIGRATION GUIDES · ZERO DOWNTIME",
    "migrations.title": "Перейдите на AEVION без боли",
    "migrations.subtitle": "Step-by-step гайды миграции с самых популярных альтернатив. Customer Success помогает бесплатно — без риска, без double-billing, с полным data-export'ом.",

    "migrations.stat.estDays": "ВРЕМЯ",
    "migrations.stat.cost": "ЭКОНОМИЯ",
    "migrations.stat.steps": "ШАГИ",
    "migrations.stat.stepsUnit": "шага",
    "migrations.stat.zeroDowntime": "ZERO DOWNTIME",

    "migrations.changes.title": "Что меняется",
    "migrations.changes.before": "БЫЛО:",
    "migrations.changes.after": "СТАНЕТ:",

    "migrations.steps.title": "План миграции",

    "migrations.cta.help": "Помочь с миграцией",
    "migrations.cta.cases": "Customer stories →",

    "migrations.docusign.before.b1": "$25/мес/seat за подпись + $0.10 за каждый envelope сверх квоты",
    "migrations.docusign.before.b2": "Audit-trail в отдельной системе, не интегрирован с реестром авторских прав",
    "migrations.docusign.before.b3": "Нет TSP-timestamp по умолчанию, для compliance — отдельный продукт",

    "migrations.docusign.after.b1": "$19/мес/seat (Pro) или $9/мес add-on к любому тарифу — без overage",
    "migrations.docusign.after.b2": "QRight + QSign в одном аккаунте: подпись автоматически фиксируется в реестре",
    "migrations.docusign.after.b3": "TSP-timestamp + audit-trail включены, SOC2 evidence pack одной кнопкой",

    "migrations.docusign.step1.title": "Экспорт envelope-history из DocuSign",
    "migrations.docusign.step1.body": "Settings → Reports → Envelope History → CSV. Customer Success парсит файл и переносит метаданные в AEVION (без содержимого PDF — оно остаётся у вас).",
    "migrations.docusign.step2.title": "Подключение AEVION QSign",
    "migrations.docusign.step2.body": "Создание workspace, инвайт seats, настройка SSO (если нужно). Время: 1 день. Можно работать параллельно с DocuSign в double-run режиме.",
    "migrations.docusign.step3.title": "Перенос шаблонов и template-flow",
    "migrations.docusign.step3.body": "Любые DocuSign-шаблоны (envelope templates, recipient routing) воспроизводимы в AEVION QSign. Customer Success делает миграцию шаблонов вручную — обычно 3-7 дней.",
    "migrations.docusign.step4.title": "Cutover и отмена DocuSign",
    "migrations.docusign.step4.body": "Когда команда привыкла (обычно 5-14 дней) — отменяете DocuSign-подписку. Все active envelopes завершаются в DocuSign, новые — в AEVION.",

    "migrations.docusign.quote": "Мы тратили $4 200/мес на DocuSign Business для 30 юристов. На AEVION Pro с annual-скидкой — $570/мес за тот же объём подписей. Цикл подписи сократился с 2 дней до 4 часов.",
    "migrations.docusign.quoteBy": "Head of Operations, Almaty Law Group",

    "migrations.openai.before.b1": "$0.03/1k input + $0.06/1k output для GPT-4 — быстро добегает до $1k/мес для ML-команды",
    "migrations.openai.before.b2": "Нет встроенного аудита и compliance-evidence для regulated-industries",
    "migrations.openai.before.b3": "OpenAI ToS запрещает использование данных для обучения, но логи всё равно проходят через их инфра",

    "migrations.openai.after.b1": "$0.50/1k токенов фиксированный rate (любые модели), volume-discounts от Build-tier",
    "migrations.openai.after.b2": "Audit-trail каждого LLM-вызова с TSP-timestamp в QRight — для compliance",
    "migrations.openai.after.b3": "On-prem развёртывание возможно (Enterprise), BYO-key для собственных моделей",

    "migrations.openai.step1.title": "Inventory OpenAI-вызовов",
    "migrations.openai.step1.body": "Customer Success помогает скан кодовой базы: где вы вызываете OpenAI, какие модели, какие prompts. Обычно 5-15 endpoints.",
    "migrations.openai.step2.title": "Drop-in замена SDK",
    "migrations.openai.step2.body": "AEVION QCoreAI SDK совместим с OpenAI v1 API: меняется только base_url и API-ключ. Большинство кода работает as-is.",
    "migrations.openai.step3.title": "Тестирование на staging",
    "migrations.openai.step3.body": "Параллельный запуск OpenAI и QCoreAI на staging — сравнение качества ответов. AEVION даёт credits на тестирование.",
    "migrations.openai.step4.title": "Production rollout",
    "migrations.openai.step4.body": "Постепенный rollout с feature-flag (canary 5% → 50% → 100%). Зеркальные логи 30 дней для отката.",

    "migrations.openai.quote": "Заменили GPT-4 на QCoreAI за 5 дней. Качество — equivalent для наших задач. Биллинг упал с $1 800/мес до $980/мес. И теперь у нас audit-trail, который требует compliance.",
    "migrations.openai.quoteBy": "VP Engineering, KazFin Holding",

    "migrations.stripe.before.b1": "Single-provider роутинг — нет резерва при downtime эквайера",
    "migrations.stripe.before.b2": "Latency 540ms+ для cross-border транзакций",
    "migrations.stripe.before.b3": "Локальные методы оплаты (Kaspi, СБП, Mir) — отдельные интеграции",

    "migrations.stripe.after.b1": "Multi-provider роутинг с AI-выбором по success-rate и комиссии в реальном времени",
    "migrations.stripe.after.b2": "Latency 310ms (среднее), failover между провайдерами автоматически",
    "migrations.stripe.after.b3": "Stripe + Kaspi + СБП + PayPal + локальные банки — single API",

    "migrations.stripe.step1.title": "Подключение QPayNet endpoint",
    "migrations.stripe.step1.body": "QPayNet — drop-in proxy перед существующими провайдерами. Добавляете как один из мерчантов, не убирая Stripe.",
    "migrations.stripe.step2.title": "Конфигурация роутинга",
    "migrations.stripe.step2.body": "AI-агент учится на 7-14 дневном hot-path: какие транзакции через какого провайдера. Можно задать manual-rules.",
    "migrations.stripe.step3.title": "Локальные провайдеры",
    "migrations.stripe.step3.body": "Подключение Kaspi/СБП/Mir/локальных банков через QPayNet — без отдельной интеграции с каждым.",
    "migrations.stripe.step4.title": "Полный cutover",
    "migrations.stripe.step4.body": "Stripe становится одним из мерчантов в QPayNet, не основным. Reconciliation через единый dashboard. Sub-минутный switch при downtime.",

    "migrations.stripe.quote": "Latency платежей упал на 42%, success-rate auto-routing — 98.2%. Time-to-market новой интеграции с локальным эквайером — с 7.5 мес до 2.4 мес.",
    "migrations.stripe.quoteBy": "VP Engineering, KazFin Holding",

    "migrations.patently.before.b1": "$59-99/мес/seat за tracking renewals и filing помощника",
    "migrations.patently.before.b2": "Регистрация артефактов через сторонние подрядчики, $720/реестр в среднем",
    "migrations.patently.before.b3": "Manual-сверка с EUIPO/USPTO/локальными патентными офисами",

    "migrations.patently.after.b1": "$19/мес add-on (IP Bureau) к любому тарифу — все renewals и filing помощника включены",
    "migrations.patently.after.b2": "QRight регистрация $190/реестр в среднем (зависит от объекта и юрисдикции)",
    "migrations.patently.after.b3": "Auto-renewals, auto-sync с EUIPO/USPTO/Россия/Казахстан/Узбекистан/etc.",

    "migrations.patently.step1.title": "Импорт IP-portfolio",
    "migrations.patently.step1.body": "Patently → Settings → Export → CSV. AEVION парсит регистрации, ТМ, патенты, дедлайны. Обычно 5-30 минут на портфель из 100+ объектов.",
    "migrations.patently.step2.title": "Проверка и обогащение",
    "migrations.patently.step2.body": "AI-агент QCoreAI проверяет каждую запись против актуальных данных EUIPO/USPTO/etc. Помечает устаревшие или с ошибочными датами.",
    "migrations.patently.step3.title": "Перенос шаблонов и templates",
    "migrations.patently.step3.body": "Patently-шаблоны заявок → AEVION IP Bureau шаблоны. Customer Success вручную мапит специфичные параметры юрисдикций.",
    "migrations.patently.step4.title": "Активация авто-renewals",
    "migrations.patently.step4.body": "Уведомления за 90/30/7 дней до renewal. После cutover — ваш Patently аккаунт можно отменить, AEVION уже владеет всем календарём.",

    "migrations.patently.quote": "Вели 400+ клиентов в Patently. После миграции на AEVION IP Bureau — стоимость регистрации упала с $720 до $190, missed renewals — с 2-3/год до 0. Партнёры теперь видят полный портфель в одном дашборде.",
    "migrations.patently.quoteBy": "Managing Partner, NeoLaw Patent Group",

    "migrations.faq.title": "Частые вопросы",
    "migrations.faq.q1": "А если миграция «застрянет»?",
    "migrations.faq.a1": "Customer Success ведёт миграцию end-to-end бесплатно. Если что-то блокирует — есть откат на старого вендора без потерь. Зеркальные логи 30 дней покрывают все сценарии.",
    "migrations.faq.q2": "Можно ли двигаться постепенно?",
    "migrations.faq.a2": "Да, double-run рекомендуется. Можете 30-90 дней работать одновременно на старом и новом — для verifiyation. AEVION-биллинг считает только по реальному usage в этот период.",
    "migrations.faq.q3": "Что с долгосрочными контрактами на старом вендоре?",
    "migrations.faq.a3": "Если у вас annual contract на DocuSign/OpenAI/Stripe — мигрируем поэтапно. AEVION даёт grace credit на overlap-период (до 6 мес). Customer Success помогает рассчитать ROI с учётом sunk cost.",
    "migrations.faq.q4": "Кто отвечает за data-loss при миграции?",
    "migrations.faq.a4": "Никаких операций без вашего подтверждения. Все экспорты — с вашей стороны, мы только подсказываем where и how. Customer Success делает dry-run на 5-10 записях, прежде чем мигрировать всё.",
  },
  en: {
    "migrations.badge": "MIGRATION GUIDES · ZERO DOWNTIME",
    "migrations.title": "Move to AEVION without pain",
    "migrations.subtitle": "Step-by-step guides from the most popular alternatives. Customer Success helps for free — no risk, no double-billing, full data export.",

    "migrations.stat.estDays": "TIME",
    "migrations.stat.cost": "SAVINGS",
    "migrations.stat.steps": "STEPS",
    "migrations.stat.stepsUnit": "steps",
    "migrations.stat.zeroDowntime": "ZERO DOWNTIME",

    "migrations.changes.title": "What changes",
    "migrations.changes.before": "BEFORE:",
    "migrations.changes.after": "AFTER:",

    "migrations.steps.title": "Migration plan",

    "migrations.cta.help": "Help me migrate",
    "migrations.cta.cases": "Customer stories →",

    "migrations.docusign.before.b1": "$25/seat/mo + $0.10 per envelope over quota",
    "migrations.docusign.before.b2": "Audit trail in a separate system, not integrated with copyright registry",
    "migrations.docusign.before.b3": "No TSP timestamp by default; compliance is a separate product",

    "migrations.docusign.after.b1": "$19/seat/mo (Pro) or $9/mo add-on on any tier — no overage",
    "migrations.docusign.after.b2": "QRight + QSign in one account: signature is auto-recorded in registry",
    "migrations.docusign.after.b3": "TSP timestamp + audit trail included, SOC2 evidence pack in one click",

    "migrations.docusign.step1.title": "Export envelope history from DocuSign",
    "migrations.docusign.step1.body": "Settings → Reports → Envelope History → CSV. Customer Success parses the file and ports metadata into AEVION (without PDF content — that stays with you).",
    "migrations.docusign.step2.title": "Connect AEVION QSign",
    "migrations.docusign.step2.body": "Workspace, invite seats, SSO if needed. 1 day. Run in parallel with DocuSign during cut-over.",
    "migrations.docusign.step3.title": "Migrate templates and routing flows",
    "migrations.docusign.step3.body": "Any DocuSign templates (envelope templates, recipient routing) reproduce in AEVION QSign. Customer Success migrates manually — usually 3-7 days.",
    "migrations.docusign.step4.title": "Cutover and DocuSign cancel",
    "migrations.docusign.step4.body": "Once the team is comfortable (5-14 days) — cancel DocuSign. Active envelopes finish there, new ones go to AEVION.",

    "migrations.docusign.quote": "We were paying $4,200/mo for DocuSign Business for 30 lawyers. AEVION Pro with annual discount — $570/mo for the same volume. Signing cycle dropped from 2 days to 4 hours.",
    "migrations.docusign.quoteBy": "Head of Operations, Almaty Law Group",

    "migrations.openai.before.b1": "$0.03/1k input + $0.06/1k output for GPT-4 — quickly hits $1k/mo for an ML team",
    "migrations.openai.before.b2": "No built-in audit and compliance evidence for regulated industries",
    "migrations.openai.before.b3": "OpenAI ToS bans training data use, but logs still pass through their infra",

    "migrations.openai.after.b1": "$0.50/1k tokens flat (any model), volume discounts from Build-tier",
    "migrations.openai.after.b2": "Audit trail of every LLM call with TSP timestamp in QRight — for compliance",
    "migrations.openai.after.b3": "On-prem possible (Enterprise), BYO-key for own models",

    "migrations.openai.step1.title": "Inventory OpenAI calls",
    "migrations.openai.step1.body": "Customer Success scans your codebase: where you call OpenAI, which models, which prompts. Usually 5-15 endpoints.",
    "migrations.openai.step2.title": "Drop-in SDK swap",
    "migrations.openai.step2.body": "AEVION QCoreAI SDK is OpenAI v1 API compatible: change only base_url and key. Most code works as-is.",
    "migrations.openai.step3.title": "Staging tests",
    "migrations.openai.step3.body": "Run OpenAI and QCoreAI in parallel on staging — compare answer quality. AEVION provides credits for testing.",
    "migrations.openai.step4.title": "Production rollout",
    "migrations.openai.step4.body": "Gradual rollout with feature-flag (canary 5% → 50% → 100%). Mirror logs 30 days for rollback.",

    "migrations.openai.quote": "Replaced GPT-4 with QCoreAI in 5 days. Quality is equivalent for our use case. Bill dropped from $1,800/mo to $980/mo. And now we have an audit trail compliance requires.",
    "migrations.openai.quoteBy": "VP Engineering, KazFin Holding",

    "migrations.stripe.before.b1": "Single-provider routing — no failover during acquirer downtime",
    "migrations.stripe.before.b2": "540ms+ latency on cross-border transactions",
    "migrations.stripe.before.b3": "Local payment methods (Kaspi, SBP, Mir) — separate integrations",

    "migrations.stripe.after.b1": "Multi-provider routing with AI choice by success-rate and fee in real time",
    "migrations.stripe.after.b2": "310ms latency (avg), automatic failover between providers",
    "migrations.stripe.after.b3": "Stripe + Kaspi + SBP + PayPal + local banks — single API",

    "migrations.stripe.step1.title": "Connect QPayNet endpoint",
    "migrations.stripe.step1.body": "QPayNet is a drop-in proxy in front of existing providers. Add as one merchant without removing Stripe.",
    "migrations.stripe.step2.title": "Routing config",
    "migrations.stripe.step2.body": "AI agent learns on 7-14 day hot-path: which transactions go through which provider. Can set manual rules.",
    "migrations.stripe.step3.title": "Local providers",
    "migrations.stripe.step3.body": "Connect Kaspi/SBP/Mir/local banks through QPayNet — without separate integration each.",
    "migrations.stripe.step4.title": "Full cutover",
    "migrations.stripe.step4.body": "Stripe becomes one merchant in QPayNet, not the only one. Reconciliation via unified dashboard. Sub-minute switch on downtime.",

    "migrations.stripe.quote": "Payment latency dropped 42%, auto-routing success rate is 98.2%. Time-to-market for new acquirer integration — from 7.5 months to 2.4.",
    "migrations.stripe.quoteBy": "VP Engineering, KazFin Holding",

    "migrations.patently.before.b1": "$59-99/seat/mo for renewal tracking and filing assistant",
    "migrations.patently.before.b2": "Artifact registration via third parties, $720/reg avg",
    "migrations.patently.before.b3": "Manual sync with EUIPO/USPTO/local patent offices",

    "migrations.patently.after.b1": "$19/mo add-on (IP Bureau) on any tier — all renewals and filing assistant included",
    "migrations.patently.after.b2": "QRight registration $190/reg avg (depends on object and jurisdiction)",
    "migrations.patently.after.b3": "Auto-renewals, auto-sync with EUIPO/USPTO/Russia/Kazakhstan/Uzbekistan/etc.",

    "migrations.patently.step1.title": "IP portfolio import",
    "migrations.patently.step1.body": "Patently → Settings → Export → CSV. AEVION parses registrations, TMs, patents, deadlines. Usually 5-30 minutes for a 100+ portfolio.",
    "migrations.patently.step2.title": "Verification and enrichment",
    "migrations.patently.step2.body": "QCoreAI agent checks each record against current EUIPO/USPTO/etc. Flags stale or wrong-date entries.",
    "migrations.patently.step3.title": "Migrate filing templates",
    "migrations.patently.step3.body": "Patently filing templates → AEVION IP Bureau templates. Customer Success manually maps jurisdiction-specific parameters.",
    "migrations.patently.step4.title": "Activate auto-renewals",
    "migrations.patently.step4.body": "Reminders 90/30/7 days before renewal. After cutover — Patently account can be cancelled, AEVION owns the calendar.",

    "migrations.patently.quote": "We were running 400+ clients in Patently. After migrating to AEVION IP Bureau — cost per registration dropped from $720 to $190, missed renewals from 2-3/yr to 0. Partners now see the full portfolio in one dashboard.",
    "migrations.patently.quoteBy": "Managing Partner, NeoLaw Patent Group",

    "migrations.faq.title": "FAQ",
    "migrations.faq.q1": "What if migration gets stuck?",
    "migrations.faq.a1": "Customer Success runs migration end-to-end for free. If anything blocks — fall back to old vendor without loss. Mirror logs 30 days cover all rollback paths.",
    "migrations.faq.q2": "Can I move gradually?",
    "migrations.faq.a2": "Yes, double-run is recommended. Run 30-90 days on both for verification. AEVION billing only counts real usage during overlap.",
    "migrations.faq.q3": "What about long-term contracts on the old vendor?",
    "migrations.faq.a3": "If you have an annual contract on DocuSign/OpenAI/Stripe — migrate gradually. AEVION provides a grace credit for the overlap (up to 6 months). Customer Success calculates ROI with sunk cost.",
    "migrations.faq.q4": "Who's responsible for data loss in migration?",
    "migrations.faq.a4": "No operation without your confirmation. All exports come from your side, we only advise where and how. Customer Success runs a dry-run on 5-10 records before migrating everything.",
  },
};
