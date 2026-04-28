"use client";

import { useI18n } from "./i18n";

/**
 * Локализация pricing-секции. Отдельный словарь, чтобы не раздувать
 * глобальный i18n.tsx и хранить весь GTM-копирайт в одном месте.
 *
 * Использование:
 *   const tp = usePricingT();
 *   <h1>{tp("hero.title")}</h1>
 *
 * Fallback порядок: en → ru → key.
 */

type Lang = "en" | "ru";

const dict: Record<Lang, Record<string, string>> = {
  ru: {
    "back.allTiers": "← Все тарифы",
    "back.pricing": "← /pricing",

    /* Hero */
    "hero.badge": "AEVION GTM · ПРАЙС-ЛИСТ",
    "hero.title": "Цены AEVION",
    "hero.subtitle": "Единая платформа: цифровая собственность, AI, финтех, потребительские продукты — 27 модулей под одним аккаунтом.",

    /* Period / currency */
    "period.monthly": "Месяц",
    "period.annual": "Год (-16%)",

    /* Promo */
    "promo.activeBanner": "АКТИВНЫЕ ПРОМО:",
    "promo.copied": "✓ Скопировано",

    /* Tier CTA */
    "tier.popular": "ПОПУЛЯРНЫЙ",
    "tier.perMonth": "/мес",
    "tier.perYear": "в год",
    "tier.byRequest": "По запросу",
    "tier.free": "Бесплатно",
    "tier.detailsLink": "Подробнее о {name} →",
    "tier.tryTrial": "Попробовать 14 дней бесплатно",
    "tier.openCalc": "Открыть калькулятор →",

    /* Bundles */
    "bundles.title": "Готовые сборки",
    "bundles.subtitle": "Несколько модулей со скидкой — берите целевой контур одной кнопкой.",

    /* Industries */
    "industries.title": "Для вашей индустрии",
    "industries.subtitle": "Кейсы и рекомендованный стек для вашей вертикали.",
    "industries.banks": "Банки и финтех",
    "industries.startups": "Стартапы",
    "industries.government": "Госсектор",
    "industries.creators": "Создатели контента",
    "industries.lawFirms": "Юр. фирмы",

    /* Testimonials */
    "testimonials.title": "Что говорят клиенты",
    "testimonials.subtitle": "Реальные команды на AEVION. Все цитаты с разрешением авторов.",
    "logos.label": "ИСПОЛЬЗУЮТ КОМАНДЫ ИЗ 30+ СТРАН",

    /* Modules matrix */
    "modules.title": "Все модули",
    "modules.subtitle": "27 продуктов AEVION. Покупаются отдельно или входят в тарифы.",
    "modules.colModule": "Модуль",
    "modules.colDescription": "Описание",
    "modules.colStatus": "Статус",
    "modules.colAddon": "Add-on / мес",
    "modules.colIncluded": "Включено в",

    /* Calculator */
    "calc.title": "Калькулятор",
    "calc.subtitle": "Соберите свою конфигурацию — смета пересчитывается на лету.",
    "calc.tier": "ТАРИФ",
    "calc.seats": "ПОЛЬЗОВАТЕЛИ (SEATS)",
    "calc.promo": "ПРОМО-КОД",
    "calc.modules": "ДОПОЛНИТЕЛЬНЫЕ МОДУЛИ",
    "calc.estimate": "СМЕТА",
    "calc.recalc": "пересчёт...",
    "calc.freeBilling": "Бесплатный тариф — оплата не требуется.",
    "calc.annualDiscount": "Годовая скидка",
    "calc.totalYear": "ИТОГО / год",
    "calc.totalMonth": "ИТОГО / месяц",
    "calc.payQuote": "Оплатить смету",
    "calc.opening": "Открываем оплату...",
    "calc.contactSales": "Связаться с продажами →",
    "calc.empty": "Выбери параметры слева...",

    /* Comparison */
    "compare.title": "AEVION vs альтернативы",
    "compare.subtitle": "Что обычно собирают по кускам — у нас под одним аккаунтом и одной подпиской.",

    /* Full compare matrix */
    "compareFull.badge": "ПОЛНАЯ МАТРИЦА · 27 МОДУЛЕЙ × 4 ТАРИФА",
    "compareFull.title": "Сравнение тарифов и модулей",
    "compareFull.subtitle": "Что включено в каждый тариф, что доступно как add-on, что только в Enterprise. Фильтруйте по типу модуля или скрывайте те, что ещё в работе.",
    "compareFull.filterLabel": "ФИЛЬТР:",
    "compareFull.filterAll": "Все",
    "compareFull.hideUnavailable": "Скрыть SOON / by-request",
    "compareFull.stickyHeader": "27 МОДУЛЕЙ",
    "compareFull.ctaTitle": "Готовы выбрать тариф?",
    "compareFull.ctaSubtitle": "Соберите смету в калькуляторе или свяжитесь с продажами для Enterprise-конфигурации.",
    "compareFull.ctaCalculator": "Открыть калькулятор",
    "compareFull.ctaSales": "Связаться с продажами",
    "compareFull.legendTitle": "ОБОЗНАЧЕНИЯ",
    "compareFull.legendIncluded": "Включено в тариф",
    "compareFull.legendAddon": "Add-on к любому тарифу",
    "compareFull.legendUnavailable": "Недоступно на этом тарифе",
    "compareFull.legendLive": "В продакшене",
    "compareFull.legendBeta": "Бета-версия",
    "compareFull.legendSoon": "Скоро",

    /* Customer cases */
    "cases.badge": "CUSTOMER STORIES · 6 КЕЙСОВ",
    "cases.title": "Реальные клиенты, реальные цифры",
    "cases.subtitle": "Что считают команды на AEVION после 3-12 месяцев работы. Метрики до/после, цитаты, использованные модули и тариф.",
    "cases.filterIndustry": "ИНДУСТРИЯ:",
    "cases.filterTier": "ТАРИФ:",
    "cases.empty": "Нет кейсов под такие фильтры. Сбросьте фильтр или посмотрите другую индустрию.",
    "cases.showDetails": "Показать challenge / solution / outcome",
    "cases.hideDetails": "Свернуть",
    "cases.challenge": "Сложность",
    "cases.solution": "Решение AEVION",
    "cases.outcome": "Результат",
    "cases.tryTier": "Попробовать {tier}",
    "cases.ctaTitle": "Хотите свой кейс?",
    "cases.ctaSubtitle": "Расскажите о результатах — мы оформим case study и подсветим вашу команду на /pricing/cases. Бесплатно для клиентов на Pro+.",
    "cases.ctaShare": "Поделиться кейсом",
    "cases.ctaBack": "Все тарифы",

    /* Refund Policy */
    "refund.badge": "REFUND POLICY · ЧЁТКИЕ УСЛОВИЯ",
    "refund.title": "Политика возвратов AEVION",
    "refund.subtitle": "Без юридического жаргона. Что возвращаем, когда, и как быстро. Если что-то непонятно — пишите billing@aevion.io.",
    "refund.tldr.title": "TL;DR — ОСНОВНОЕ",
    "refund.tldr.p1": "14 дней money-back на любой платный тариф (Pro / Business) — без вопросов.",
    "refund.tldr.p2": "При даунгрейде — кредит за неиспользованное автоматически на счёте.",
    "refund.tldr.p3": "Annual оплата — возврат пропорционально оставшимся месяцам.",
    "refund.tldr.p4": "Экспорт всех данных в JSON / PDF — кнопка в личном кабинете в любой момент.",

    "refund.section.moneyBack.title": "14-дневный money-back",
    "refund.section.moneyBack.body": "Подписки Pro и Business можно вернуть в течение 14 календарных дней с даты первой оплаты. Без объяснения причин. Применяется к monthly и annual.",
    "refund.section.moneyBack.b1": "Возврат возможен один раз на email/аккаунт.",
    "refund.section.moneyBack.b2": "После 14-дневного окна возврат — только на usaule pro-rated основе при даунгрейде.",
    "refund.section.moneyBack.b3": "Free тариф возврату не подлежит — он бесплатный.",

    "refund.section.downgrade.title": "Даунгрейд и прорейтинг",
    "refund.section.downgrade.body": "Если переходите с Pro на Free или с Business на Pro в середине биллинг-периода — неиспользованная сумма автоматически зачисляется как кредит на следующий цикл.",
    "refund.section.downgrade.b1": "Кредит хранится бессрочно, пока есть аккаунт.",
    "refund.section.downgrade.b2": "При запросе вывода кредита — возврат на исходную карту в течение 5-10 рабочих дней.",
    "refund.section.downgrade.b3": "Апгрейд в обратную сторону — кредит зачитывается автоматически.",

    "refund.section.annual.title": "Annual возвраты",
    "refund.section.annual.body": "При отмене годовой подписки в первые 14 дней — полный возврат. Позже — пропорциональный возврат за полные неиспользованные месяцы (минус 16% годовой скидки).",
    "refund.section.annual.b1": "Расчёт: (полная_сумма / 12) × неиспользованные_месяцы × 0.84.",
    "refund.section.annual.b2": "Минимум 1 полный месяц использования — возврат от 0 до 11 месяцев.",
    "refund.section.annual.b3": "Annual-промо (STARTUP50, EARLYBIRD) — возврат рассчитывается от уже промо-ставки.",

    "refund.section.usage.title": "Использование (usage-based)",
    "refund.section.usage.body": "Token-overage и per-action биллинг (например, lifetime-подпись QSign выше квоты тарифа) — НЕ подлежит возврату, так как ресурсы уже потрачены на нашей стороне.",
    "refund.section.usage.b1": "Если квота тарифа израсходована — overage списывается отдельной строкой.",
    "refund.section.usage.b2": "Спорные списания (sudden spike, баг подсчёта) — пишите billing@, разберёмся вручную.",

    "refund.section.enterprise.title": "Enterprise-контракты",
    "refund.section.enterprise.body": "Enterprise-условия фиксируются в индивидуальном MSA/SLA. Минимальный срок — 12 месяцев. Возврат регулируется условиями договора и обычно не происходит автоматически.",
    "refund.section.enterprise.b1": "Customer Success менеджер — единая точка контакта по биллингу.",
    "refund.section.enterprise.b2": "При досрочном расторжении возможен частичный возврат при отсутствии нарушений SLA с нашей стороны.",

    "refund.section.data.title": "Данные после отмены",
    "refund.section.data.body": "Ваши QRight-объекты, QSign-подписи, IP Bureau архивы — ваши. После отмены подписки данные сохраняются 90 дней grace + 60 дней soft-delete.",
    "refund.section.data.b1": "Экспорт в JSON / PDF доступен в любой момент через личный кабинет (Settings → Export).",
    "refund.section.data.b2": "Через 90 дней без оплаты — soft-delete с возможностью восстановления ещё 60 дней.",
    "refund.section.data.b3": "Через 150 дней — окончательное удаление по GDPR Right-to-be-forgotten.",

    "refund.process.title": "Как происходит возврат",
    "refund.process.subtitle": "Стандартный процесс — обычно 5-10 рабочих дней. Без бумажных запросов.",
    "refund.process.day0": "ДЕНЬ 0",
    "refund.process.dayLabel": "ДНИ",
    "refund.process.s1.title": "Запрос на billing@aevion.io",
    "refund.process.s1.body": "Тема: «Refund request». В тексте — email аккаунта и причина (опционально). Автоответ с тикетом.",
    "refund.process.s2.title": "Подтверждение и расчёт",
    "refund.process.s2.body": "Customer Success подтверждает условия возврата (14 дней / прорейтинг / промо-условия) и выставляет сумму к возврату.",
    "refund.process.s3.title": "Возврат на исходную карту",
    "refund.process.s3.body": "Возврат через Stripe или вашего эквайера. Время поступления — на стороне банка-эмитента.",
    "refund.process.s4.title": "Закрытие тикета и offboarding",
    "refund.process.s4.body": "Подтверждение получения средств. Аккаунт переходит на Free или soft-delete по вашему выбору. Welcome-back промо на 50% при возврате.",

    "refund.contact.title": "Вопросы по возврату?",
    "refund.contact.subtitle": "Не нужно искать форму. Пишите напрямую — Customer Success отвечает в течение 1 рабочего дня.",
    "refund.contact.salesCta": "Связаться с продажами",

    "refund.lastUpdated": "Последнее обновление",
    "refund.linkTerms": "Terms of Service",
    "refund.linkPrivacy": "Privacy Policy",

    /* FAQ */
    "faq.title": "Вопросы и ответы",
    "faq.subtitle": "Самое частое — здесь. Если нет ответа, напишите",

    /* Newsletter */
    "newsletter.title": "Не готовы покупать сейчас?",
    "newsletter.subtitle": "Подпишитесь на email-апдейты — раз в 2 недели: новые модули, кейсы клиентов, промо-коды.",
    "newsletter.placeholder": "your@email.com",
    "newsletter.submit": "Подписаться",
    "newsletter.submitting": "Подписываемся...",
    "newsletter.success": "✓ Подписка подтверждена. Спасибо!",
    "newsletter.error": "Ошибка:",

    /* Compliance */
    "compliance.title": "Compliance & технологии",

    /* Notes */
    "notes.title": "Условия",
    "notes.docsApi": "Документация API:",
    "notes.endpoint": "Прайс-эндпоинт:",

    /* Loading / errors */
    "loading.pricing": "Загружаем прайс...",
    "error.unavailable": "Прайс недоступен",
    "error.checkBackend": "Проверь, что бэкенд запущен (npm run dev в aevion-globus-backend).",

    /* Contact form */
    "contact.badge": "ENTERPRISE / SALES",
    "contact.title": "Связаться с продажами",
    "contact.subtitle": "Расскажите о задаче — Customer Success свяжется в течение 24 часов с предложением, demo и customer-stories под вашу индустрию.",
    "contact.field.name": "Ваше имя *",
    "contact.field.email": "Email *",
    "contact.field.company": "Компания",
    "contact.field.industry": "Индустрия",
    "contact.field.tier": "Интересующий тариф",
    "contact.field.seats": "Кол-во пользователей",
    "contact.field.message": "Что нужно решить?",
    "contact.placeholder.name": "Айдар Ахметов",
    "contact.placeholder.email": "aydar@company.com",
    "contact.placeholder.company": "Acme Inc",
    "contact.placeholder.industry": "— выбрать —",
    "contact.placeholder.tier": "— не уверен —",
    "contact.placeholder.message": "Например: нужна цифровая подпись + аудит для 50 юристов, on-prem развёртывание в KZ",
    "contact.submit": "Отправить заявку",
    "contact.submitting": "Отправляем...",
    "contact.noSpam": "Никакого спама. Только Customer Success → одно письмо.",
    "contact.success.title": "Заявка принята",
    "contact.success.body": "Customer Success менеджер свяжется с вами в течение 24 часов на",
    "contact.success.id": "ID заявки:",
    "contact.success.back": "Вернуться к прайсу",

    /* Checkout success/cancel */
    "checkout.success.activated": "Аккаунт активирован",
    "checkout.success.trialActivated": "Триал-период активирован",
    "checkout.success.paid": "Оплата прошла",
    "checkout.success.freeText": "Вы перешли на Free. Можете сразу зарегистрировать первую идею в QRight.",
    "checkout.success.trialText": "Бесплатный доступ к AEVION {tier} на {days} дней. Карта не списывается до окончания триала.",
    "checkout.success.paidText": "Подписка AEVION {tier} активна. Welcome-email отправлен на ваш почтовый ящик.",
    "checkout.success.trialEnds": "Триал заканчивается:",
    "checkout.success.stub": "STUB MODE — реальная оплата не проводилась. Установите STRIPE_SECRET_KEY в backend для production.",
    "checkout.success.openQRight": "Открыть QRight",
    "checkout.success.home": "На главную",
    "checkout.cancel.title": "Оплата отменена",
    "checkout.cancel.body": "Никаких списаний не было. Если что-то не понравилось в чекауте или возникли вопросы по тарифу — напишите нам, разберёмся.",
    "checkout.cancel.return": "Вернуться к",
    "checkout.cancel.contact": "Связаться с продажами",
    "checkout.cancel.allTiers": "Все тарифы",
  },
  en: {
    "back.allTiers": "← All tiers",
    "back.pricing": "← /pricing",

    "hero.badge": "AEVION GTM · PRICING",
    "hero.title": "AEVION pricing",
    "hero.subtitle": "Unified platform: digital IP, AI, fintech, consumer products — 27 modules under a single account.",

    "period.monthly": "Monthly",
    "period.annual": "Annual (-16%)",

    "promo.activeBanner": "ACTIVE PROMOS:",
    "promo.copied": "✓ Copied",

    "tier.popular": "POPULAR",
    "tier.perMonth": "/mo",
    "tier.perYear": "per year",
    "tier.byRequest": "By request",
    "tier.free": "Free",
    "tier.detailsLink": "More about {name} →",
    "tier.tryTrial": "Try 14 days free",
    "tier.openCalc": "Open calculator →",

    "bundles.title": "Pre-built suites",
    "bundles.subtitle": "Multiple modules with a discount — pick the right contour in one click.",

    "industries.title": "For your industry",
    "industries.subtitle": "Cases and recommended stack for your vertical.",
    "industries.banks": "Banks & fintech",
    "industries.startups": "Startups",
    "industries.government": "Government",
    "industries.creators": "Content creators",
    "industries.lawFirms": "Law firms",

    "testimonials.title": "What customers say",
    "testimonials.subtitle": "Real teams on AEVION. All quotes published with author permission.",
    "logos.label": "TRUSTED BY TEAMS ACROSS 30+ COUNTRIES",

    "modules.title": "All modules",
    "modules.subtitle": "27 AEVION products. Buy individually or get them in tiers.",
    "modules.colModule": "Module",
    "modules.colDescription": "Description",
    "modules.colStatus": "Status",
    "modules.colAddon": "Add-on / mo",
    "modules.colIncluded": "Included in",

    "calc.title": "Calculator",
    "calc.subtitle": "Build your config — quote recalculates on the fly.",
    "calc.tier": "TIER",
    "calc.seats": "USERS (SEATS)",
    "calc.promo": "PROMO CODE",
    "calc.modules": "EXTRA MODULES",
    "calc.estimate": "QUOTE",
    "calc.recalc": "recalculating...",
    "calc.freeBilling": "Free tier — no payment required.",
    "calc.annualDiscount": "Annual discount",
    "calc.totalYear": "TOTAL / year",
    "calc.totalMonth": "TOTAL / month",
    "calc.payQuote": "Pay quote",
    "calc.opening": "Opening checkout...",
    "calc.contactSales": "Contact sales →",
    "calc.empty": "Pick options on the left...",

    "compare.title": "AEVION vs alternatives",
    "compare.subtitle": "What's usually pieced together from many vendors — under one account here.",

    "compareFull.badge": "FULL MATRIX · 27 MODULES × 4 TIERS",
    "compareFull.title": "Compare tiers and modules",
    "compareFull.subtitle": "What's included in each tier, what's available as add-on, what's Enterprise-only. Filter by module kind or hide work-in-progress.",
    "compareFull.filterLabel": "FILTER:",
    "compareFull.filterAll": "All",
    "compareFull.hideUnavailable": "Hide SOON / by-request",
    "compareFull.stickyHeader": "27 MODULES",
    "compareFull.ctaTitle": "Ready to pick a tier?",
    "compareFull.ctaSubtitle": "Build a quote in the calculator or contact sales for Enterprise.",
    "compareFull.ctaCalculator": "Open calculator",
    "compareFull.ctaSales": "Contact sales",
    "compareFull.legendTitle": "LEGEND",
    "compareFull.legendIncluded": "Included in tier",
    "compareFull.legendAddon": "Add-on to any tier",
    "compareFull.legendUnavailable": "Not available on this tier",
    "compareFull.legendLive": "In production",
    "compareFull.legendBeta": "Beta",
    "compareFull.legendSoon": "Soon",

    "cases.badge": "CUSTOMER STORIES · 6 CASES",
    "cases.title": "Real customers, real numbers",
    "cases.subtitle": "What teams report after 3-12 months on AEVION. Before/after metrics, quotes, modules and tier used.",
    "cases.filterIndustry": "INDUSTRY:",
    "cases.filterTier": "TIER:",
    "cases.empty": "No cases match these filters. Try a different industry.",
    "cases.showDetails": "Show challenge / solution / outcome",
    "cases.hideDetails": "Collapse",
    "cases.challenge": "Challenge",
    "cases.solution": "AEVION solution",
    "cases.outcome": "Outcome",
    "cases.tryTier": "Try {tier}",
    "cases.ctaTitle": "Want your case here?",
    "cases.ctaSubtitle": "Share your results — we'll write up the case study and feature your team on /pricing/cases. Free for Pro+ customers.",
    "cases.ctaShare": "Share your case",
    "cases.ctaBack": "All tiers",

    "refund.badge": "REFUND POLICY · CLEAR TERMS",
    "refund.title": "AEVION Refund Policy",
    "refund.subtitle": "No legal jargon. What we refund, when, and how fast. If something's unclear — email billing@aevion.io.",
    "refund.tldr.title": "TL;DR — KEY POINTS",
    "refund.tldr.p1": "14-day money-back on any paid tier (Pro / Business) — no questions asked.",
    "refund.tldr.p2": "On downgrade — credit for unused time auto-applied to your account.",
    "refund.tldr.p3": "Annual — refund proportionally for remaining months.",
    "refund.tldr.p4": "Export all your data to JSON / PDF — button in dashboard, anytime.",

    "refund.section.moneyBack.title": "14-day money-back",
    "refund.section.moneyBack.body": "Pro and Business subscriptions can be refunded within 14 calendar days from first payment. No reason needed. Applies to monthly and annual.",
    "refund.section.moneyBack.b1": "Refund available once per email/account.",
    "refund.section.moneyBack.b2": "After the 14-day window — only pro-rated refund on downgrade.",
    "refund.section.moneyBack.b3": "Free tier is not refundable — it's free.",

    "refund.section.downgrade.title": "Downgrade & pro-rating",
    "refund.section.downgrade.body": "When moving from Pro to Free or Business to Pro mid-cycle — unused amount is auto-credited to your next cycle.",
    "refund.section.downgrade.b1": "Credit holds indefinitely while account exists.",
    "refund.section.downgrade.b2": "On withdrawal request — refund to original card in 5-10 business days.",
    "refund.section.downgrade.b3": "Upgrade back — credit auto-applied.",

    "refund.section.annual.title": "Annual refunds",
    "refund.section.annual.body": "Cancel annual in first 14 days — full refund. Later — pro-rated refund for full unused months (minus 16% annual discount).",
    "refund.section.annual.b1": "Formula: (full_total / 12) × unused_months × 0.84.",
    "refund.section.annual.b2": "Minimum 1 full month of usage — refund 0 to 11 months.",
    "refund.section.annual.b3": "Annual promo (STARTUP50, EARLYBIRD) — refund computed from already-promo rate.",

    "refund.section.usage.title": "Usage-based fees",
    "refund.section.usage.body": "Token overage and per-action billing (e.g. QSign signatures over tier quota) is NOT refundable, since resources were already consumed on our side.",
    "refund.section.usage.b1": "When tier quota is exhausted — overage shows as separate line item.",
    "refund.section.usage.b2": "Disputed charges (sudden spike, counter bug) — email billing@, we'll review manually.",

    "refund.section.enterprise.title": "Enterprise contracts",
    "refund.section.enterprise.body": "Enterprise terms are set in individual MSA/SLA. Minimum term: 12 months. Refunds governed by contract, generally non-automatic.",
    "refund.section.enterprise.b1": "Customer Success Manager — single point of contact for billing.",
    "refund.section.enterprise.b2": "On early termination — partial refund possible if no SLA breach on our side.",

    "refund.section.data.title": "Data after cancellation",
    "refund.section.data.body": "Your QRight objects, QSign signatures, IP Bureau archives — yours. After cancellation, data retained 90 days grace + 60 days soft-delete.",
    "refund.section.data.b1": "Export to JSON / PDF — anytime via dashboard (Settings → Export).",
    "refund.section.data.b2": "After 90 days unpaid — soft-delete with 60-day restore window.",
    "refund.section.data.b3": "After 150 days — final delete per GDPR Right-to-be-forgotten.",

    "refund.process.title": "How a refund works",
    "refund.process.subtitle": "Standard process — usually 5-10 business days. No paper forms.",
    "refund.process.day0": "DAY 0",
    "refund.process.dayLabel": "DAYS",
    "refund.process.s1.title": "Email billing@aevion.io",
    "refund.process.s1.body": "Subject: «Refund request». In body — account email and optional reason. Auto-reply with ticket ID.",
    "refund.process.s2.title": "Confirmation and amount",
    "refund.process.s2.body": "Customer Success confirms terms (14-day / pro-rated / promo conditions) and quotes the refund amount.",
    "refund.process.s3.title": "Refund to original card",
    "refund.process.s3.body": "Via Stripe or your acquirer. Posting time depends on issuing bank.",
    "refund.process.s4.title": "Ticket close & offboarding",
    "refund.process.s4.body": "Confirmation of receipt. Account moves to Free or soft-delete per your choice. Welcome-back promo of 50% if you return.",

    "refund.contact.title": "Refund questions?",
    "refund.contact.subtitle": "No need to find a form. Email directly — Customer Success replies within 1 business day.",
    "refund.contact.salesCta": "Contact sales",

    "refund.lastUpdated": "Last updated",
    "refund.linkTerms": "Terms of Service",
    "refund.linkPrivacy": "Privacy Policy",

    "faq.title": "FAQ",
    "faq.subtitle": "Most common questions — here. If yours isn't, email",

    "newsletter.title": "Not ready to buy yet?",
    "newsletter.subtitle": "Subscribe to email updates — every 2 weeks: new modules, customer cases, promo codes.",
    "newsletter.placeholder": "your@email.com",
    "newsletter.submit": "Subscribe",
    "newsletter.submitting": "Subscribing...",
    "newsletter.success": "✓ Subscription confirmed. Thanks!",
    "newsletter.error": "Error:",

    "compliance.title": "Compliance & tech",

    "notes.title": "Terms",
    "notes.docsApi": "API docs:",
    "notes.endpoint": "Pricing endpoint:",

    "loading.pricing": "Loading pricing...",
    "error.unavailable": "Pricing unavailable",
    "error.checkBackend": "Check that the backend is running (npm run dev in aevion-globus-backend).",

    "contact.badge": "ENTERPRISE / SALES",
    "contact.title": "Contact sales",
    "contact.subtitle": "Tell us about your task — Customer Success will reach out within 24 hours with a proposal, demo and customer stories for your vertical.",
    "contact.field.name": "Your name *",
    "contact.field.email": "Email *",
    "contact.field.company": "Company",
    "contact.field.industry": "Industry",
    "contact.field.tier": "Tier of interest",
    "contact.field.seats": "Number of users",
    "contact.field.message": "What do you need to solve?",
    "contact.placeholder.name": "Aydar Akhmetov",
    "contact.placeholder.email": "aydar@company.com",
    "contact.placeholder.company": "Acme Inc",
    "contact.placeholder.industry": "— select —",
    "contact.placeholder.tier": "— not sure —",
    "contact.placeholder.message": "E.g.: digital signature + audit for 50 lawyers, on-prem deployment in KZ",
    "contact.submit": "Send request",
    "contact.submitting": "Sending...",
    "contact.noSpam": "No spam. Only Customer Success → one email.",
    "contact.success.title": "Request received",
    "contact.success.body": "Customer Success manager will reach out within 24 hours at",
    "contact.success.id": "Request ID:",
    "contact.success.back": "Back to pricing",

    "checkout.success.activated": "Account activated",
    "checkout.success.trialActivated": "Trial period activated",
    "checkout.success.paid": "Payment successful",
    "checkout.success.freeText": "You're on Free. Register your first idea in QRight right now.",
    "checkout.success.trialText": "Free access to AEVION {tier} for {days} days. Your card is not charged until the trial ends.",
    "checkout.success.paidText": "AEVION {tier} subscription is active. Welcome-email sent to your inbox.",
    "checkout.success.trialEnds": "Trial ends:",
    "checkout.success.stub": "STUB MODE — no real payment. Set STRIPE_SECRET_KEY in backend for production.",
    "checkout.success.openQRight": "Open QRight",
    "checkout.success.home": "Home",
    "checkout.cancel.title": "Payment cancelled",
    "checkout.cancel.body": "No charges. If something didn't fit in checkout or you have questions about pricing — reach out, we'll help.",
    "checkout.cancel.return": "Back to",
    "checkout.cancel.contact": "Contact sales",
    "checkout.cancel.allTiers": "All tiers",
  },
};

export function usePricingT() {
  const { lang } = useI18n();
  return (key: string, vars?: Record<string, string | number>): string => {
    const raw = dict[lang][key] ?? dict.en[key] ?? key;
    if (!vars) return raw;
    return Object.keys(vars).reduce(
      (acc, k) => acc.replace(`{${k}}`, String(vars[k])),
      raw,
    );
  };
}
