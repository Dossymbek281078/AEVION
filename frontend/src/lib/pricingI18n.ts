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
