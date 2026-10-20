"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUNDLES = exports.PROMO_CODES = exports.MODULES_PRICING = exports.TIERS = exports.STANDALONE_APPS = exports.PLANET_LADDER_FROM_DAY = exports.DAYS_PER_YEAR = exports.DAYS_PER_MONTH = exports.PLANET_PREPAY_DISCOUNT_PERCENT = exports.CHESS_YEARLY_USD = exports.PLANET_BASE_MONTHLY = exports.PLANET_TERM_PRICE = exports.TERM_NAME = exports.TERM_FACTOR = exports.TERM_MONTHS = exports.TERM_TIERS = exports.CURRENCY_RATES = exports.MAX_PROMO_DISCOUNT_RATIO = exports.MEDIUM_BUNDLE = void 0;
exports.currencyRate = currencyRate;
exports.planetPricePerMonth = planetPricePerMonth;
exports.planetTotal = planetTotal;
exports.planetFromPerMonth = planetFromPerMonth;
exports.planetSavingPercent = planetSavingPercent;
exports.termSavingPercent = termSavingPercent;
exports.toCents = toCents;
exports.planetPrepayTotal = planetPrepayTotal;
exports.planetPaymentsCount = planetPaymentsCount;
exports.planetTermDays = planetTermDays;
exports.planetLadderTierForDays = planetLadderTierForDays;
exports.planetEarlyCancellation = planetEarlyCancellation;
exports.isTermTier = isTermTier;
exports.termPricePerMonth = termPricePerMonth;
exports.termTotal = termTotal;
exports.appSellableTerms = appSellableTerms;
exports.appTermTotal = appTermTotal;
exports.monthsLabelEn = monthsLabelEn;
exports.monthsLabel = monthsLabel;
exports.monthsLabelRu = monthsLabelRu;
exports.standaloneApp = standaloneApp;
exports.getTier = getTier;
exports.getModulePrice = getModulePrice;
exports.resolvePromoCode = resolvePromoCode;
exports.buildQuote = buildQuote;
const discounts_1 = require("./discounts");
/** Модули, входящие в Medium-бандл (готовые consumer/prosumer-апп). */
exports.MEDIUM_BUNDLE = [
    "cyberchess",
    "healthai",
    "multichat-engine",
    "qcoreai",
    "smeta-trainer",
    "qai",
    "qlearn",
    "qnews",
    "qstore",
    "qmedia",
];
/**
 * Максимальная доля subtotal, которую может снять ОДИН промо-код — платформенный
 * потолок, а не решение про конкретный код. Защищает от того, что fixed-скидка
 * (умножается на 12 для annual — см. checkout.ts/buildQuote) обнулит/почти
 * обнулит тариф целиком просто потому, что его цена оказалась ниже суммы
 * скидки (нашли на TEAM100 −$100 против Full $89/890 → $49/490 после переоценки — оба periода ≥ него).
 * ⚠️ После переоценки 13.08.2026 тот же −$100 обнулил бы месячный Full
 * целиком (цена $49), то есть потолок ниже стал нужнее, а не наоборот.
 */
exports.MAX_PROMO_DISCOUNT_RATIO = 0.5;
// Тарифы Конституции (Pro $9, Team $49) сняты 15.09.2026: отдельно продаются только
// STANDALONE_APPS, Конституция входит в подписку AEVION. Касса отвечает 410
// (routes/constitutionCheckout.ts).
// Веерные скидки живут отдельным файлом: лестницы — это данные о продажах, а не
// про арифметику счёта, и меняются они чаще формулы.
/** Курсы для отображения на фронте (фиксированные, обновляются вручную). */
exports.CURRENCY_RATES = {
    USD: { rate: 1, symbol: "$", label: "US Dollar" },
    EUR: { rate: 0.92, symbol: "€", label: "Euro" },
    KZT: { rate: 470, symbol: "₸", label: "Kazakhstani Tenge" },
    RUB: { rate: 92, symbol: "₽", label: "Russian Ruble" },
};
/**
 * Курс валюты, который нельзя увести в NaN.
 *
 * `CURRENCY_RATES[currency]` находит и унаследованное: для "constructor" это
 * функция Object, и `.rate` у неё undefined — смета уходила клиенту БЕЗ ЦИФР
 * (HTTP 200, пустые total и subtotal). Живой прод отвечал так 28.07.2026.
 *
 * Проверка в маршруте /api/pricing/quote уже стоит, и другого вызывающего у
 * buildQuote сегодня нет. Но она стоит ДАЛЕКО от расчёта, а buildQuote
 * экспортирован: следующий вызывающий получит NaN молча. Курс берётся здесь,
 * значит и защита должна жить здесь.
 */
function currencyRate(currency) {
    return Object.prototype.hasOwnProperty.call(exports.CURRENCY_RATES, currency)
        ? exports.CURRENCY_RATES[currency].rate
        : exports.CURRENCY_RATES.USD.rate;
}
/**
 * ЛЕСТНИЦА СРОКОВ — слово основателя 15.09.2026.
 *
 * Тариф называет СРОК доступа, а не набор модулей: любой платный тариф открывает
 * всю планету AEVION, тарифы различаются только сроком и ценой месяца. Оплата —
 * за весь срок вперёд, продление на тот же срок. Иначе Medium превращался бы в
 * «$350 за один месяц и отмена», то есть дешевле Lite за тот же месяц.
 *
 * Та же лестница у каждого приложения, которое продаётся отдельно
 * (STANDALONE_APPS ниже). Документ с обоснованием:
 * Desktop/АЕВИОН/06-Витрина-цены-SEO/2026-09-15-ЦЕНОВАЯ-ПОЛИТИКА-тариф-это-срок.md
 */
exports.TERM_TIERS = ["lite", "medium", "pro", "full", "max"];
exports.TERM_MONTHS = { lite: 1, medium: 3, pro: 6, full: 9, max: 12 };
/** Доля базовой цены месяца на ступени — для отдельных приложений; у планеты это 250 / 225 / 200 / 175 / 150 (своя лесенка PLANET_TERM_PRICE ниже, не доля). */
exports.TERM_FACTOR = { lite: 1, medium: 0.875, pro: 0.75, full: 0.625, max: 0.5 };
exports.TERM_NAME = { lite: "Lite", medium: "Medium", pro: "Pro", full: "Full", max: "Max" };
/** Цена месяца всей планеты на самом коротком сроке (Lite). */
/**
 * 🔴 19.10.2026 — слово основателя: ОДИН план «AEVION Планета», доступ ко всем
 * приложениям, цена месяца зависит от срока: 1 мес $250, 3 мес по $225, 6 по $200,
 * 9 по $175, 12 по $150. У плана СВОЯ лесенка (не TERM_FACTOR): 250×0.875 — не
 * целые доллары, и termPricePerMonth на этом бросает (инвариант «целый доллар»).
 * Числа — решение человека, записаны литералами; TERM_FACTOR остаётся для
 * отдельных приложений. Шахматы — отдельной карточкой $50/год.
 */
exports.PLANET_TERM_PRICE = { lite: 250, medium: 225, pro: 200, full: 175, max: 150 };
/** Цена одного месяца без срока (ступень lite); литерал держит сторож зеркала. */
exports.PLANET_BASE_MONTHLY = 250;
exports.CHESS_YEARLY_USD = 50;
function planetPricePerMonth(term) { return exports.PLANET_TERM_PRICE[term]; }
function planetTotal(term) { return exports.PLANET_TERM_PRICE[term] * exports.TERM_MONTHS[term]; }
/** «от $…/мес» — месяц на самом длинном сроке. */
function planetFromPerMonth() { return exports.PLANET_TERM_PRICE.max; }
function planetSavingPercent(term) { return Math.round((1 - exports.PLANET_TERM_PRICE[term] / exports.PLANET_TERM_PRICE.lite) * 1000) / 10; }
/**
 * Экономия срока плана против месяца без срока, в процентах: 0, 10, 20, 30, 40.
 * 🔴 20.10.2026: зеркало фронта (frontend/src/lib/termPricing.ts) — там она считалась
 * из TERM_FACTOR (12.5/25/37.5/50) и расходилась со строкой карточки. Текст функции
 * сверяет сторож termPricingMatchesBackend.
 */
function termSavingPercent(term) {
    return planetSavingPercent(term);
}
/*
 * 🔴 19.10.2026 22:4x–22:5x, слово основателя: срочный план СПИСЫВАЕТСЯ
 * ПОМЕСЯЧНО при обязательстве на срок («$1800 сразу неподъёмно — соглашается
 * на годовую, платит ежемесячно»). totalUsd срока — сумма помесячных платежей.
 * Оплата всего срока вперёд — скидка к этой сумме: 3 мес −5 %, 6 −7,5 %,
 * 9 −10 %, 12 −12,5 % → 641.25 / 1110 / 1417.50 / 1575. Без срока (lite)
 * платить вперёд не за что — скидка 0.
 */
exports.PLANET_PREPAY_DISCOUNT_PERCENT = { lite: 0, medium: 5, pro: 7.5, full: 10, max: 12.5 };
/** До цента: 675 × 0.95 в двоичной дроби — 641.2499…, покупателю показываем 641.25. */
function toCents(usd) { return Math.round(usd * 100) / 100; }
/** Один платёж за весь срок вперёд, со скидкой; у срока без обязательства — цена месяца. */
function planetPrepayTotal(term) {
    return toCents(planetTotal(term) * (1 - exports.PLANET_PREPAY_DISCOUNT_PERCENT[term] / 100));
}
/** Сколько помесячных списаний несёт обязательство: 1 / 3 / 6 / 9 / 12. */
function planetPaymentsCount(term) { return exports.TERM_MONTHS[term]; }
/*
 * Досрочная отмена срочного плана — ИТОГ основателя 19.10 22:5x.
 * Прожитые дни оплачиваются по самой длинной ПРОЙДЕННОЙ ступени лесенки:
 * < 90 дн — $250/мес, 90–179 — $225, 180–269 — $200, 270–364 — $175;
 * месяц = 30 дней, год = 365. Дослужил срок — цена плана, пересчёта нет.
 * «Оплачено − наше» > 0 — возврат; < 0 — у помесячного доплата счётом
 * (касса сама не спишет), у оплаты вперёд доплаты нет.
 * Контрольные числа основателя: год вперёд 1575, 200 дн → наше 1333.33,
 * возврат 241.67; год помесячно, 120 дн, оплачено 600 → доплата 300.
 */
exports.DAYS_PER_MONTH = 30;
exports.DAYS_PER_YEAR = 365;
/** С какого прожитого дня ступень считается пройденной. */
exports.PLANET_LADDER_FROM_DAY = { lite: 0, medium: 90, pro: 180, full: 270, max: exports.DAYS_PER_YEAR };
/** Длина срока в днях: 30 / 90 / 180 / 270 / 365. */
function planetTermDays(term) {
    return term === "max" ? exports.DAYS_PER_YEAR : exports.TERM_MONTHS[term] * exports.DAYS_PER_MONTH;
}
/** Самая длинная ступень, чей порог дней пройден. */
function planetLadderTierForDays(daysUsed) {
    let tier = "lite";
    for (const t of exports.TERM_TIERS)
        if (daysUsed >= exports.PLANET_LADDER_FROM_DAY[t])
            tier = t;
    return tier;
}
function planetEarlyCancellation(input) {
    const { term, billing } = input;
    const daysUsed = Math.max(0, Math.floor(input.daysUsed));
    const paidUsd = toCents(Math.max(0, input.paidUsd));
    // Без срока обязательства нет, дослуженный срок пересчёту не подлежит.
    if (term === "lite" || daysUsed >= planetTermDays(term)) {
        return { ladderTier: term, rateUsdPerMonth: exports.PLANET_TERM_PRICE[term], ourUsd: paidUsd, refundUsd: 0, surchargeUsd: 0, finished: true };
    }
    const ladderTier = planetLadderTierForDays(daysUsed);
    const rateUsdPerMonth = exports.PLANET_TERM_PRICE[ladderTier];
    const ourUsd = toCents((daysUsed * rateUsdPerMonth) / exports.DAYS_PER_MONTH);
    const diff = toCents(paidUsd - ourUsd);
    return {
        ladderTier,
        rateUsdPerMonth,
        ourUsd,
        refundUsd: diff > 0 ? diff : 0,
        surchargeUsd: diff < 0 && billing === "monthly" ? toCents(-diff) : 0,
        finished: false,
    };
}
function isTermTier(id) {
    return exports.TERM_TIERS.includes(id);
}
/**
 * Цена месяца на ступени лестницы.
 *
 * Базы выбраны кратными 8, и на каждой ступени выходят целые доллары. Нецелое
 * число здесь — ошибка ДАННЫХ (кто-то поставил базу не кратной 8), а не повод
 * округлять: округление молча разводит витрину и кассу на центы.
 */
function termPricePerMonth(base, term) {
    const v = base * exports.TERM_FACTOR[term];
    if (!Number.isInteger(v))
        throw new Error(`term price is not whole dollars: ${base} x ${exports.TERM_FACTOR[term]}`);
    return v;
}
/** Платёж за весь срок вперёд. */
function termTotal(base, term) {
    return termPricePerMonth(base, term) * exports.TERM_MONTHS[term];
}
/**
 * Сроки, на которые приложение ПРОДАЁТСЯ (19.10.2026): у годового — один `max`,
 * у остальных — вся лестница. Единственный источник для кассы, healthz и витрины.
 */
function appSellableTerms(app) {
    return app.yearOnlyUsd != null ? ["max"] : [...exports.TERM_TIERS];
}
/** Платёж за срок у приложения; null — на этом сроке оно не продаётся. */
function appTermTotal(app, term) {
    if (app.yearOnlyUsd != null)
        return term === "max" ? app.yearOnlyUsd : null;
    return termTotal(app.baseMonthly, term);
}
/** «3 месяца», «6 месяцев» — для подписей. */
/**
 * Подпись срока ПО-АНГЛИЙСКИ.
 *
 * Понадобилась не для красоты: эта строка попадает в имя товара на странице
 * оплаты (checkout.ts собирает `description`, а lemonSqueezyProvider кладёт его
 * в `product_options.name`). Замер 05.10.2026 на живой кассе DevHub: страница
 * с `lang="en-US"` показывала «AEVION DevHub Lite — 1 месяц», английское имя
 * шло в скобках вторым. Кириллица в момент оплаты на англоязычном сайте — это
 * недоверие ровно там, где человек вводит карту.
 */
function monthsLabelEn(n) {
    return n === 1 ? "1 month" : `${n} months`;
}
/**
 * Подпись срока на языке покупателя. Язык неизвестен — АНГЛИЙСКИЙ: сайт отдаёт
 * английский по всем адресам, и русский по умолчанию был бы случайным выбором,
 * а не вежливостью.
 */
function monthsLabel(n, lang) {
    const код = String(lang ?? "").trim().toLowerCase();
    return код.startsWith("ru") ? monthsLabelRu(n) : monthsLabelEn(n);
}
function monthsLabelRu(n) {
    const d = n % 10;
    const dd = n % 100;
    if (d === 1 && dd !== 11)
        return `${n} месяц`;
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14))
        return `${n} месяца`;
    return `${n} месяцев`;
}
exports.STANDALONE_APPS = [
    { slug: "cyberchess", moduleId: "cyberchess", name: "CyberChess", baseMonthly: 24, yearOnlyUsd: exports.CHESS_YEARLY_USD },
    { slug: "multichat", moduleId: "multichat-engine", name: "Multichat", baseMonthly: 40 },
    { slug: "qventure", moduleId: "qventure", name: "QVenture", baseMonthly: 80 },
    { slug: "ip_bureau", moduleId: "aevion-ip-bureau", name: "IP Bureau", baseMonthly: 32 },
    { slug: "devhub", moduleId: "devhub", name: "DevHub", baseMonthly: 200 },
    // 20.09.2026, слово основателя «везде должны быть цены». База кратна 8: коэффициенты
    // сроков (1 / 0.875 / 0.75 / 0.625 / 0.5) обязаны давать ЦЕЛЫЙ месяц, иначе
    // termPricePerMonth бросает. Проверено: 24/32/40/56 проходят, 19/29/49/59 — нет.
    // Товаров в кассе у них пока нет: страница цен честно покажет цену и «связаться»
    // вместо кнопки (сторож unsellableTierExplainsItself), кнопки зажгутся сами, когда
    // появятся варианты и переменные LEMON_SQUEEZY_VARIANT_<SLUG>_<СТУПЕНЬ>.
    { slug: "qright", moduleId: "qright", name: "QRight", baseMonthly: 24 },
    { slug: "qsign", moduleId: "qsign", name: "QSign", baseMonthly: 24 },
    { slug: "startup_exchange", moduleId: "startup-exchange", name: "Startup Exchange", baseMonthly: 40 },
    // QSkyway: слово основателя 14.09.2026 было $19/мес. Лестница сроков (15.09)
    // QSkyway не называла, а база обязана делиться на 8 — иначе termPricePerMonth
    // бросает на дробном долларе. Из двух ближайших (16 и 24) взята МЕНЬШАЯ:
    // брать с человека больше, чем назвал основатель, я не вправе. Решение
    // вынесено ему файлом 2026-09-20-ВАША-РУКА-три-дела-на-15-минут.md.
    { slug: "qskyway", moduleId: "qskyway", name: "QSkyway", baseMonthly: 16 },
];
function standaloneApp(slugOrModuleId) {
    return exports.STANDALONE_APPS.find((a) => a.slug === slugOrModuleId || a.moduleId === slugOrModuleId) ?? null;
}
/**
 * Месячная квота токенов одинакова на всех сроках: срок меняет цену месяца, а не
 * объём. Планета работает на моделях Anthropic, и Max за $200/мес стоит столько же,
 * сколько их подписка Max, — без месячного потолка длинный тариф уходит в минус.
 */
const PLANET_LIMITS = {
    modules: null,
    qrightObjectsPerMonth: null,
    qsignOpsPerDay: null,
    llmTokensPerMonth: 50000000,
    premiumTokensPerMonth: 5000000, // 10% of the overall cap
    seats: 1,
    supportSlaHours: 8,
};
function planetTier(id, extra = {}) {
    const months = exports.TERM_MONTHS[id];
    const perMonth = planetPricePerMonth(id);
    const total = planetTotal(id);
    const savingPct = termSavingPercent(id);
    return {
        id,
        name: exports.TERM_NAME[id],
        tagline: `Вся планета AEVION на ${monthsLabelRu(months)}`,
        priceMonthly: perMonth,
        termMonths: months,
        priceTermTotal: total,
        pricePrepayTotal: planetPrepayTotal(id),
        features: [
            "Все продукты AEVION в одной подписке",
            "DevHub, Multichat, IP Bureau, CyberChess, QVenture и остальные модули",
            "QCoreAI: 50 000 000 токенов / месяц",
            // 19.10.2026: срочный план списывается помесячно; вперёд — один платёж со скидкой.
            months === 1
                ? `$${total} за месяц, без обязательств`
                : `$${perMonth} в месяц, списание ежемесячно — ${months} ${months === 3 ? "платежа" : "платежей"}, $${total} за ${monthsLabelRu(months)}; вперёд одним платежом — $${planetPrepayTotal(id)}`,
            savingPct > 0 ? `Экономия ${savingPct}% против месяца без срока` : "Без обязательств дольше месяца",
            // 🔴 07.10.2026 «Приоритетная поддержка (8h SLA)» СНЯТА со всех пяти
            // ступеней (строка одна — она собирается для каждой). Причина: ни в
            // бэкенде, ни в процессе нет приоритета обращений и срока ответа —
            // поиск по коду дал ноль мест. Единственный канал поддержки — почта,
            // общая для всех. Обещать срок, которого никто не держит, дороже, чем
            // не обещать ничего: на него сошлются ровно в тот момент, когда у
            // покупателя что-то сломалось.
        ],
        limits: { ...PLANET_LIMITS },
        ctaLabel: `Выбрать ${exports.TERM_NAME[id]}`,
        ...extra,
    };
}
exports.TIERS = [
    {
        id: "free",
        name: "Free",
        tagline: "Старт без барьеров — для тех, кто только знакомится с AEVION",
        priceMonthly: 0,
        termMonths: null,
        priceTermTotal: 0,
        pricePrepayTotal: 0,
        features: [
            "1 активный модуль на выбор",
            "QRight: до 10 объектов / месяц",
            "QSign: 1 подпись в день",
            "QCoreAI: 100 000 токенов / месяц",
            "Доступ к публичному Globus",
            "Сообщество и базовая документация",
        ],
        limits: {
            modules: 1,
            qrightObjectsPerMonth: 10,
            qsignOpsPerDay: 1,
            llmTokensPerMonth: 100000,
            premiumTokensPerMonth: null, // tiny overall cap already bounds worst-case exposure
            seats: 1,
            supportSlaHours: null,
        },
        ctaLabel: "Начать бесплатно",
    },
    planetTier("lite"),
    planetTier("medium"),
    planetTier("pro"),
    planetTier("full"),
    planetTier("max", { highlight: true }),
    {
        id: "enterprise",
        name: "Enterprise",
        tagline: "Для корпораций, банков и государственного сектора",
        priceMonthly: null,
        termMonths: null,
        priceTermTotal: null,
        pricePrepayTotal: null,
        /*
         * 🔴 01.10.2026: СНЯТО ЗАЯВЛЕНИЕ О СЕРТИФИКАЦИИ, которой у нас нет.
         *
         * Здесь стояло обещание пакета двух международных сертификатов, и оно выдавалось
         * наружу публичной ручкой /api/pricing, то есть читалось на странице цен
         * как имеющийся сертификат. Сертификатов у компании нет: на собственной
         * странице доверия оба они помечены «in progress», то есть
         * две наши поверхности утверждали разное.
         *
         * Для компании, которая продаёт ДОКАЗАТЕЛЬСТВО авторства, ложное заявление
         * о сертификации бьёт по самому товару: покупателю нечем отличить наше
         * «мы сертифицированы» от нашего же «вот доказательство, что документ ваш».
         *
         * Выделенная инфраструктура, SLA в один час и персональный Customer Success
         * убраны по той же причине — исполнять их сегодня некому. Осталась честная
         * формулировка: условия обсуждаются, а не обещаны заранее.
         */
        features: [
            "Условия корпоративного уровня обсуждаются индивидуально",
            "Безлимитные seats и токены",
            "Roadmap-влияние и кастом-фичи",
            "Юридические NDA / DPA / MSA",
        ],
        limits: {
            modules: null,
            qrightObjectsPerMonth: null,
            qsignOpsPerDay: null,
            llmTokensPerMonth: null,
            premiumTokensPerMonth: null,
            seats: null,
            supportSlaHours: 1,
        },
        ctaLabel: "Связаться с продажами",
    },
];
/**
 * Per-module add-on прайс. Покупается поверх любого тарифа,
 * если конкретный модуль не входит в `includedIn`.
 */
// includedIn-схема новой модели:
//   - globus              → free + все (публичный портал)
//   - все остальные       → любой платный срок (lite…max) + enterprise:
//     тариф — это срок, а не набор модулей (15.09.2026)
/**
 * Цена надстройки = база лестницы отдельного приложения. Только STANDALONE_APPS:
 * у остальных модулей addonMonthly = null — отдельно они не продаются (15.09.2026).
 */
function appBase(moduleId) {
    const app = standaloneApp(moduleId);
    if (!app)
        throw new Error(`not a standalone app: ${moduleId}`);
    return app.baseMonthly;
}
exports.MODULES_PRICING = [
    // ===== CORE / PLATFORM =====
    {
        id: "globus",
        addonMonthly: 0,
        includedIn: ["free", "lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Центральная карта и портал экосистемы",
    },
    {
        id: "revenue-hub",
        addonMonthly: 0,
        includedIn: ["free", "lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Внутренний модуль монетизации (auth-gated, не plan-gated)",
    },
    {
        id: "ventures",
        addonMonthly: 0,
        includedIn: ["free", "lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Идея-Маркет: витрина бизнес-моделей + венчур AEVIA",
    },
    {
        id: "qcoreai",
        // ~50% below Claude Pro / ChatGPT Plus ($20/mo) as a standalone AI
        // subscription — penetration pricing against single-purpose AI rivals,
        // same logic applied to cyberchess below. See docs/PRICING_STRATEGY_2026-07.md.
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "AI Core Engine: оркестрация агентов и LLM",
    },
    {
        id: "multichat-engine",
        addonMonthly: appBase("multichat-engine"),
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Параллельные подчатики и агенты под задачи",
    },
    {
        id: "qfusionai",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Гибридный движок поверх лучших AI-платформ",
    },
    // ===== IP / LEGAL =====
    {
        id: "qright",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Регистрация цифровых объектов и подтверждение авторства",
    },
    {
        id: "qsign",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Цифровая подпись и проверка целостности",
    },
    {
        id: "aevion-ip-bureau",
        addonMonthly: appBase("aevion-ip-bureau"),
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Электронное бюро авторства + сертификаты",
    },
    // ===== FINTECH =====
    {
        id: "qtradeoffline",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Офлайн-сделки и платежи без интернета",
    },
    {
        id: "qpaynet-embedded",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Платёжное ядро для встраивания",
    },
    {
        id: "qmaskcard",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "on_request",
        oneLiner: "Защищённая банковская карта (PCI-контур)",
    },
    {
        id: "veilnetx",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Privacy-крипто и приватная сеть",
    },
    // ===== CONSUMER PRODUCTS ===== (CyberChess/HealthAI входят в Medium)
    {
        id: "cyberchess",
        // ~50% below chess.com Diamond (~$20/mo monthly billing) — penetration
        // pricing against the direct single-purpose rival while it's still
        // building traction. See docs/PRICING_STRATEGY_2026-07.md.
        addonMonthly: appBase("cyberchess"),
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Шахматная платформа нового поколения",
    },
    {
        id: "healthai",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Персональный AI-доктор (информационно)",
    },
    // ⚠️ ЭТИ ДВЕ ПОЗИЦИИ ПРОДАЮТСЯ ДВАЖДЫ, В РАЗНЫХ ФОРМАХ. Найдено 10.08.2026;
    // на них же указывает информационная строка `npm run audit:projects-pricing`
    // («2 модуля есть в MODULES_PRICING, но не в projects.ts»).
    //
    // Здесь они — ЕЖЕМЕСЯЧНЫЕ add-on'ы: qmelanin $15/мес, qrenew $19/мес.
    // А в каталоге товаров (frontend/src/lib/products.ts, цены сверены с живым
    // дашбордом Gumroad 26.07.2026) те же бренды продаются РАЗОВО: «The Anti-Grey
    // Protocol» $19 (EN, permalink kkiavh) и «Протокол Анти-седина» $9 (RU,
    // tmuyxw) — это PDF-гайды, кнопки на /qrenew и /qmelanin.
    //
    // Для покупателя разница невидима, а цена почти совпадает: добавив qrenew на
    // /pricing, он платит $19 КАЖДЫЙ месяц; купив с /qrenew — $19 ОДИН раз.
    // Ни одна из страниц про это не говорит.
    //
    // Не трогаю: чем должны быть эти два продукта — подпиской или разовым
    // гайдом — это решение об упаковке, а не техническая правка. Когда решение
    // будет, лишнюю форму надо убрать, а не оставлять обе.
    {
        id: "qmelanin",
        name: "QMelanin — протокол против седины",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Протокол против седины: анализы → питание (информационно)",
    },
    {
        id: "qrenew",
        name: "QRenew — клеточное обновление",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Клеточное обновление: биовозраст + стек (информационно)",
    },
    {
        id: "smeta-trainer",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "AI-тренажёр сметного дела РК",
    },
    {
        id: "qai",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "AI-ассистент общего назначения",
    },
    {
        id: "qlearn",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Платформа обучения с AI",
    },
    {
        id: "qnews",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Новости и AI-дайджест",
    },
    {
        id: "qstore",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Маркетплейс цифровых продуктов",
    },
    {
        id: "qmedia",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Медиа-хостинг и стриминг",
    },
    {
        id: "qlife",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Долголетие и анти-эйджинг сценарии",
    },
    {
        id: "qgood",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Психология и ментальное здоровье",
    },
    {
        id: "psyapp-deps",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Выход из зависимостей с поддержкой AI",
    },
    {
        id: "qpersona",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Цифровой аватар и персональный двойник",
    },
    {
        id: "kids-ai-content",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Детский AI-контент на нескольких языках",
    },
    {
        id: "voice-of-earth",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "soon",
        oneLiner: "Контент-сериал «Голос Земли»",
    },
    // ===== MARKETPLACE / NETWORK =====
    {
        id: "qbuild",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Рекрутинг-платформа и ATS",
    },
    {
        id: "startup-exchange",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Маркетплейс защищённых стартап-идей",
    },
    {
        id: "qventure",
        addonMonthly: appBase("qventure"),
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "AI due-diligence: quant-скоринг + совет 4 ролей + стратегия входа",
    },
    {
        // 14.09.2026 цену назначил основатель: $19/мес отдельно и в составе
        // Full и Enterprise — та же форма, что у остальных платных модулей.
        // До этого стояло addonMonthly:null, includedIn:[] (sales-only, PoC), и
        // купить модуль было нельзя ничем. Стены это не включает: qskyway нет в
        // PAYWALL_MODULES (проверено на проде 14.09).
        id: "qskyway",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Провайдер-независимые 3D-аэрокоридоры для аэротакси над цифровым двойником города",
    },
    {
        // Рендер стоит реальных денег ($0.13-0.30/с движка) — модуль платный
        // с первого дня: addon поверх Full, себестоимость×~3 на типовой фильм/мес.
        id: "qreal",
        addonMonthly: null,
        includedIn: ["enterprise"],
        availability: "beta",
        oneLiner: "Полностью живое AI-видео без актёра: бриф → кадры → фильм с QC реализма и провенансом",
    },
    {
        id: "deepsan",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Анти-хаос приложение для продуктивности",
    },
    {
        id: "mapreality",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "soon",
        oneLiner: "Карта реальных потребностей сообществ",
    },
    {
        id: "qevents",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "События, календарь и регистрации",
    },
    // ===== EXPERIMENTAL =====
    {
        id: "z-tide",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Мягкая репутация: 7 рангов, очки не торгуются",
    },
    {
        id: "qcontract",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Самоуничтожающиеся смарт-документы",
    },
    {
        id: "shadownet",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "soon",
        oneLiner: "Альтернативная приватная сеть (R&D)",
    },
    {
        id: "lifebox",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "Цифровой сейф для будущего",
    },
    {
        id: "constitution",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "AI-конституция и гражданские документы",
    },
    {
        id: "qchaingov",
        addonMonthly: null,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "beta",
        oneLiner: "DAO-управление экосистемой",
    },
    {
        // DevHub Studio Pro. До 31.08.2026 модуля здесь не было вовсе, и это
        // расходились ДВА наших собственных каталога: на /apps он продаётся
        // ($149/мес, LemonSqueezy, касса отвечает 302 при 404 у выдуманного
        // товара — проверено 31.08.2026), а на /pricing его не существовало.
        // Покупатель, сравнивающий цены на странице с названием «цены», самый
        // дорогой модуль платформы там не находил.
        //
        // Цена и название взяты из frontend/src/lib/products.ts, где они уже
        // приняты и опубликованы, — здесь ничего не решается заново.
        id: "devhub",
        // ЦЕНА ЗДЕСЬ НАМЕРЕННО null, хотя модуль стоит $149/мес на /apps.
        //
        // Положительная цена делает модуль выбираемым в калькуляторе как
        // надстройку (frontend/src/app/pricing/page.tsx фильтрует по
        // addonMonthly > 0), а касса цен считает его через buildQuote. Оплата
        // прошла бы — а доступа человек НЕ получил бы: DevHub определяет тариф
        // только по таблице «почта → тариф» (getUserTierChecked в
        // routes/devhub.ts) и подписку платформы не читает вовсе. Проверено
        // 31.08.2026 чтением обоих путей.
        //
        // То есть цена в этой строке — это кнопка «заплати и не получи».
        // Пока DevHub не признаёт isModuleEntitled(), модуль показывается на
        // /pricing без цены надстройки: человек видит, что он есть и живой, а
        // покупает там, где выдача работает. Связь закреплена сторожем
        // devhubAddonOnlyWhenEntitled в tests/.
        addonMonthly: null,
        // РЕШЕНО ОСНОВАТЕЛЕМ 14.09.2026: DevHub входит в Full; routes/devhub.ts признаёт
        // isModuleEntitled(). Цену надстройки к Lite/Medium основатель НЕ назначал —
        // addonMonthly остаётся null. Текст ниже — след прежнего состояния.
        // ПУСТОЙ намеренно, а не по недосмотру: в какие тарифы DevHub входит
        // bundle-ом — решение о составе пакетов, оно за основателем. Пустой
        // список означает «ни в какой тариф не обещан», то есть мы не обещаем
        // того, чего не решали. Проверено, что на выдачу доступа это не влияет:
        // isModuleEntitled() для full/enterprise возвращает true раньше, чем
        // читает includedIn, а для прочих тарифов прежнее запасное значение
        // ["full","enterprise"] давало ровно тот же ответ — false.
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        availability: "live",
        oneLiner: "Браузерная IDE на движке VS Code: генерация кода и публикация",
        // Модуля НЕТ в data/projects.ts, поэтому имя обязано быть здесь — иначе
        // сработает описанный выше запасной путь и в списке тарифа Lite
        // человек увидит строку вместо названия (замер 20.08.2026, 2 модуля).
        name: "DevHub Studio Pro",
    },
];
exports.PROMO_CODES = [
    {
        code: "AEVION20",
        kind: "percent",
        amount: 20,
        description: "Запуск GTM — 20% на любой платный тариф",
        validUntil: "2026-12-31T23:59:59Z",
    },
    {
        code: "STARTUP50",
        kind: "percent",
        amount: 50,
        description: "Стартапам в первый год — 50% на Lite",
        validUntil: "2026-12-31T23:59:59Z",
        tiers: ["lite"],
    },
    {
        code: "EARLYBIRD",
        kind: "percent",
        amount: 30,
        description: "Ранние пользователи — 30% на любой платный тариф",
        validUntil: "2026-06-30T23:59:59Z",
    },
    {
        code: "FRIEND10",
        kind: "fixed",
        amount: 10,
        description: "Реферальный — $10 в первый месяц",
    },
    {
        code: "TEAM100",
        kind: "fixed",
        amount: 100,
        description: "Команды — до $100 на Full (не более 50% от суммы заказа)",
        tiers: ["full"],
    },
];
/** Сборки модулей со скидкой — для GTM-лендинга. */
// Наборы модулей со скидкой сняты 15.09.2026: любой платный срок открывает все
// модули, а отдельно продаются только STANDALONE_APPS. Набор поверх этого
// стал бы третьей ценой одного и того же доступа.
exports.BUNDLES = [];
/** Утилита: получить тариф по id (или null) */
function getTier(id) {
    return exports.TIERS.find((t) => t.id === id) ?? null;
}
/** Утилита: получить цену модуля по id */
function getModulePrice(id) {
    return exports.MODULES_PRICING.find((m) => m.id === id) ?? null;
}
/**
 * Получить активный промо-код по строке. Возвращает null, если код:
 *   - не существует
 *   - истёк (validUntil < now)
 *   - не применим к данному тарифу (tiers задан и tier не входит)
 *   - annualOnly=true, а тариф короче 12 месяцев (не max)
 */
function resolvePromoCode(raw, tierId) {
    if (!raw)
        return { promo: null };
    const code = raw.trim().toUpperCase();
    const promo = exports.PROMO_CODES.find((p) => p.code === code);
    if (!promo)
        return { promo: null, reason: "promo_not_found" };
    if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
        return { promo: null, reason: "promo_expired" };
    }
    if (promo.annualOnly && tierId !== "max") {
        return { promo: null, reason: "promo_annual_only" };
    }
    if (promo.tiers && promo.tiers.length > 0 && !promo.tiers.includes(tierId)) {
        return { promo: null, reason: "promo_tier_mismatch" };
    }
    return { promo };
}
function buildQuote(input) {
    const termMonths = getTier(input.tierId)?.termMonths ?? null;
    const months = termMonths ?? 1;
    const currency = input.currency ?? "USD";
    const seats = Math.max(1, input.seats ?? 1);
    const tier = getTier(input.tierId);
    const lines = [];
    const notes = [];
    if (!tier) {
        return {
            tierId: input.tierId,
            termMonths,
            currency,
            lines: [],
            subtotal: 0,
            discount: 0,
            total: 0,
            notes: [`Tier "${input.tierId}" not found`],
            promo: null,
            fans: [],
            discountCappedBy: 0,
            billing: null,
            monthlyCharge: null,
            prepayTotal: null,
            prepayDiscountPercent: 0,
        };
    }
    // 1) База
    const tierMonthly = tier.priceMonthly ?? 0;
    if (tier.id === "enterprise") {
        notes.push("Enterprise — итоговая цена согласовывается отдельно");
    }
    else if (tierMonthly > 0) {
        lines.push({
            kind: "tier",
            // 19.10.2026: срочный план списывается помесячно; сумма строки — за срок.
            label: months > 1
                ? `План «AEVION Планета» — ${monthsLabelRu(months)}, списание ежемесячно по $${tierMonthly}`
                : `План «AEVION Планета» — 1 месяц, без обязательств`,
            unitPrice: tierMonthly,
            qty: months,
            total: tierMonthly * months,
        });
    }
    // 2) Доп seats (поверх базовых лимитов тарифа). Свыше — $5/seat/мес
    const baseSeats = tier.limits.seats ?? 1;
    const extraSeats = Math.max(0, seats - baseSeats);
    if (extraSeats > 0 && tier.id !== "enterprise") {
        lines.push({
            kind: "seat",
            label: `Дополнительные пользователи (${extraSeats} × $5/мес)`,
            unitPrice: 5,
            qty: extraSeats * months,
            total: extraSeats * 5 * months,
        });
    }
    // 3) Add-on модули.
    //
    // Lite = «1 продукт на выбор» с полным доступом к нему. Модуль(и), покрытые
    // module-лимитом Lite, НЕ тарифицируются как add-on — иначе двойной счёт
    // (Lite + qsign дал бы $19 + $9 = $28 вместо $19). Логика зеркалит
    // routes/checkout.ts, чтобы quote == итоговый charge.
    const freeChoiceSlots = tier.id === "lite" ? (tier.limits.modules ?? 0) : 0;
    let usedChoiceSlots = 0;
    // ОДИН МОДУЛЬ ТАРИФИЦИРУЕТСЯ ОДИН РАЗ.
    //
    // Замер 04.09.2026: lite [qsign] стоил $19, а lite [qsign, qsign] — $28,
    // ровно столько же, сколько за два РАЗНЫХ модуля. То есть повтор в списке
    // продавался как второй продукт, хотя это тот же самый. Список приходит из
    // тела запроса и ничем не ограничен (`routes/checkout.ts`), поэтому
    // достаточно, чтобы он собрался с повтором — например, при восстановлении
    // выбора или двойном нажатии.
    //
    // Инвариант принадлежит РАСЧЁТУ, а не вызывающим: иначе каждый новый
    // вызывающий обязан помнить о нём сам, а забывший продаст повтор снова.
    // Заодно это выравнивает расчёт с записью: `lib/payment/customData`
    // отбрасывает повторы, и без дедупликации здесь мы брали бы деньги за
    // два, а записывали один.
    const модулиБезПовторов = Array.from(new Set(input.modules ?? []));
    for (const mid of модулиБезПовторов) {
        const m = getModulePrice(mid);
        if (!m) {
            notes.push(`Модуль "${mid}" не найден`);
            continue;
        }
        if (m.includedIn.includes(tier.id))
            continue; // уже в тарифе
        if (usedChoiceSlots < freeChoiceSlots) {
            usedChoiceSlots++;
            notes.push(`Модуль ${m.id} включён в Lite (1 продукт на выбор)`);
            continue;
        }
        if (m.addonMonthly === null) {
            notes.push(`Модуль "${mid}" доступен только по запросу (Enterprise / Sales)`);
            continue;
        }
        if (m.addonMonthly === 0)
            continue;
        lines.push({
            kind: "addon",
            label: `Модуль ${m.id}`,
            unitPrice: m.addonMonthly,
            qty: months,
            total: m.addonMonthly * months,
        });
    }
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    // 4) Отдельной «годовой» скидки больше нет (15.09.2026): выгода длинного срока
    //    уже в цене месяца на лестнице (TERM_FACTOR), вторая скидка удвоила бы её.
    let discount = 0;
    // 5) Веер: ступени за объём модулей, мест и срок обязательства. Считается
    //    ПОСЛЕ годовой скидки и ДО промо-кода: годовая — свойство тарифа, веер —
    //    награда за объём, промо — разовый повод. Каждая ступень возвращается
    //    отдельной строкой, чтобы покупатель видел, за что именно ему скидка.
    const moduleLines = lines.filter((l) => l.kind === "addon");
    const seatLines = lines.filter((l) => l.kind === "seat");
    const fans = (0, discounts_1.computeFan)({
        modulesUsd: moduleLines.reduce((x, l) => x + l.total, 0),
        moduleCount: moduleLines.length,
        seatsUsd: seatLines.reduce((x, l) => x + l.total, 0),
        seatCount: seats,
        commitmentMonths: input.commitmentMonths,
        subtotalUsd: subtotal,
    });
    const fanUsd = (0, discounts_1.fanTotalUsd)(fans);
    discount += fanUsd;
    // 6) Промо-код применяется на (subtotal - discount). Фиксированный — ОДИН раз за покупку (15.09.2026): при умножении на срок TEAM100 «до $100» давал $900 на Full за 9 месяцев
    let promoApplied = null;
    let promoUsd = 0;
    if (input.promoCode) {
        const { promo, reason } = resolvePromoCode(input.promoCode, tier.id);
        if (promo) {
            const base = Math.max(0, subtotal - discount);
            const rawPromoUsd = promo.kind === "percent"
                ? Math.round((base * promo.amount) / 100)
                : Math.min(base, promo.amount);
            promoUsd = Math.min(rawPromoUsd, base * exports.MAX_PROMO_DISCOUNT_RATIO);
            const rate = currencyRate(currency);
            promoApplied = {
                code: promo.code,
                kind: promo.kind,
                amount: promo.amount,
                description: promo.description,
                applied: Math.round(promoUsd * rate * 100) / 100,
            };
        }
        else {
            const map = {
                promo_not_found: "Промо-код не найден",
                promo_expired: "Промо-код истёк",
                promo_tier_mismatch: "Промо-код не применим к этому тарифу",
            };
            notes.push(map[reason ?? ""] ?? `Промо-код невалиден: ${input.promoCode}`);
        }
    }
    // 7) Потолок на СУММУ всех скидок. Каждая ступень по отдельности выглядит
    //    скромно, а вместе с промо-кодом они способны отдать товар почти даром —
    //    и по одной цифре итога это не заметить.
    const capped = (0, discounts_1.capTotalDiscount)(subtotal, discount + promoUsd);
    const totalUSD = Math.max(0, subtotal - capped.applied);
    if (capped.cappedBy > 0) {
        notes.push(`Скидки срезаны потолком: −$${capped.cappedBy} сверх допустимого`);
    }
    const rate = currencyRate(currency);
    return {
        tierId: tier.id,
        termMonths,
        currency,
        lines: lines.map((l) => ({
            ...l,
            unitPrice: Math.round(l.unitPrice * rate * 100) / 100,
            total: Math.round(l.total * rate * 100) / 100,
        })),
        subtotal: Math.round(subtotal * rate * 100) / 100,
        discount: Math.round(capped.applied * rate * 100) / 100,
        total: Math.round(totalUSD * rate * 100) / 100,
        notes,
        promo: promoApplied,
        fans: fans.map((f) => ({
            ...f,
            baseUsd: Math.round(f.baseUsd * rate * 100) / 100,
            amountUsd: Math.round(f.amountUsd * rate * 100) / 100,
        })),
        discountCappedBy: Math.round(capped.cappedBy * rate * 100) / 100,
        billing: isTermTier(tier.id) ? "monthly" : null,
        monthlyCharge: isTermTier(tier.id) ? Math.round((totalUSD / months) * rate * 100) / 100 : null,
        prepayTotal: isTermTier(tier.id) && months > 1
            ? Math.round(totalUSD * (1 - exports.PLANET_PREPAY_DISCOUNT_PERCENT[tier.id] / 100) * rate * 100) / 100
            : null,
        prepayDiscountPercent: isTermTier(tier.id) ? exports.PLANET_PREPAY_DISCOUNT_PERCENT[tier.id] : 0,
    };
}
