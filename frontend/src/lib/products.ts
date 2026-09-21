/**
 * AEVION — каталог ПОКУПАЕМЫХ товаров. Единый источник правды для витрины.
 *
 * Зачем файл появился (инвентарь 2026-07-26): про товары знали ЧЕТЫРЕ места, и они
 * расходились между собой —
 *   1. `/shop/page.tsx`      — 3 товара хардкодом;
 *   2. `/apps/page.tsx`      — 7 модулей с checkoutUrl (LemonSqueezy + Gumroad);
 *   3. `lib/gumroad.ts`      — GUMROAD_PERMALINKS полностью закомментирован, из-за чего
 *                              gumroadPermalink() всегда отдавал дефолтную подписку
 *                              — то есть кнопка «купить» в любом модуле вела в подписку;
 *   4. backend `revenue.ts`  — PERMALINK_TO_APP, самый полный список (8 permalink'ов).
 * Покупатель при этом видел на витрине 3 позиции из 15 живых.
 *
 * Цены гайдов и книг сверены 2026-07-26 с дашбордом Gumroad. Не выдумывать записи:
 * товар попадает сюда, только если его можно оплатить — прямой ссылкой продавца
 * (гайды, книги) или через нашу кассу на /pricing (подписка и пять приложений).
 *
 * Бэкенд-зеркало: `aevion-globus-backend/src/routes/gumroadWebhook.ts` (permalink → tier)
 * и `routes/revenue.ts` (permalink → appId). Фронт и бэк — раздельные TS-проекты,
 * общего импорта нет, поэтому связь через комментарии, как и в `lib/gumroad.ts`.
 */

import {
  PLANET_BASE_MONTHLY,
  STANDALONE_APPS,
  fromPricePerMonth,
  standaloneApp,
  termTotal,
} from "./termPricing";

/*
 * ⚠️ 15.09.2026 — НОВАЯ ЦЕНОВАЯ ПОЛИТИКА (слово основателя).
 *
 * Тариф = СРОК доступа ко ВСЕЙ планете: 1 / 3 / 6 / 9 / 12 месяцев, оплата за
 * весь срок вперёд. Отдельно продаются только ПЯТЬ приложений (CyberChess,
 * Multichat, QVenture, IP Bureau, DevHub) — по той же лестнице сроков.
 * Сняты с продажи: All-Access (Gumroad xpxzam), Universe, Planet, наборы,
 * Constitution Pro/Team как отдельные подписки и отдельные продажи всех прочих
 * модулей (QPayNet, QContract, Smeta и др.). Книги и гайды — без изменений.
 *
 * Числа здесь не пишутся руками: цены и лестница — только из `./termPricing`.
 * Прямых ссылок Lemon Squeezy на товары новой лестницы нет (товары ещё
 * заводятся в магазине), поэтому покупка подписки и приложения ведёт на нашу
 * страницу цен, а оттуда — в кассу (`POST /api/pricing/checkout/session`).
 */

export type ProductKind = "subscription" | "guide" | "book" | "module";
/**
 * gumroad / lemonsqueezy — прямая ссылка в кассу продавца (гайды и книги).
 * aevion — наша касса: страница /pricing выбирает срок и отправляет заказ в
 * `/api/pricing/checkout/session`; провайдера выбирает бэкенд.
 */
export type Processor = "gumroad" | "lemonsqueezy" | "aevion";

export interface Product {
  /** Gumroad permalink или slug модуля — стабильный ключ для атрибуции */
  id: string;
  title: string;
  /** Формат/язык — короткая строка под заголовком */
  format: string;
  desc: string;
  /**
   * Цена в USD. Разовый товар — цена покупки. Срочный доступ (`billing: "term"`) —
   * платёж за самый короткий срок, 1 месяц (ступень Lite); месяц на длинном
   * сроке дешевле — см. `fromPricePerMonth` в `./termPricing`.
   */
  priceUsd: number;
  /**
   * Как списываются деньги. Поле обязательное: 26.07.2026 модули были подписаны
   * «разовой лицензией», а касса списывала ежемесячно — угадывать здесь нельзя.
   *
   *   once  — разовая покупка (гайды, книги);
   *   term  — доступ на выбранный срок (1–12 месяцев), оплата за весь срок
   *           ВПЕРЁД одним платежом (политика 15.09.2026);
   *   monthly — ежемесячное списание. В каталоге с 15.09.2026 не используется:
   *           месячной и годовой оплаты больше нет. Оставлено в типе для
   *           старых подписок, которые ещё доживают свой период.
   */
  billing: "monthly" | "once" | "term";
  kind: ProductKind;
  processor: Processor;
  href: string;
  /** Что входит — показывается только там, где состав неочевиден (подписки) */
  includes?: string[];
  badge?: string;
  /**
   * Предупреждение, которое обязано быть видно ДО оплаты. Ставится, когда сам
   * модуль на своей странице объявляет себя демонстрацией или бетой: продавать
   * помесячно то, что на своей же странице написано «реальные средства не
   * обрабатываются», нельзя молча. Текст берётся с живой страницы модуля.
   */
  notice?: string;
  /** appId для сверки с backend revenue-атрибуцией */
  appId?: string;
}

const GUM = (permalink: string) => `https://aevion.gumroad.com/l/${permalink}?wanted=true`;
// Помощника LS(id) больше нет: с 15.09.2026 ни один товар каталога не ведёт прямо
// в вариант Lemon Squeezy — месячные варианты сняты, новая лестница продаётся
// через /pricing. Появится прямая ссылка — вернуть помощник, а не вписывать адрес.

/** Страница цен, блок сроков подписки на всю планету. */
export const PRICING_TERMS = "/pricing#tiers";

/**
 * Покупка отдельного приложения: страница цен с выбранным приложением.
 * Хеш — в самом конце: параметры после `#` браузер не отправляет, и метка
 * канала, дописанная туда, потерялась бы (см. keepChannel ниже).
 */
export const PRICING_APP = (slug: string) => `/pricing?app=${encodeURIComponent(slug)}#apps`;

const usd = (n: number) => `$${n}`;

/** Приложение, которое продаётся отдельно. Неизвестный id — ошибка сборки
 *  каталога, а не товар без цены: молча продавать «$undefined» нельзя. */
function soldApp(id: string) {
  const app = standaloneApp(id);
  if (!app) throw new Error(`products.ts: «${id}» нет в STANDALONE_APPS — отдельно не продаётся`);
  return app;
}

/** Цена за самый короткий срок (1 месяц, Lite) — то, что стоит в priceUsd. */
const appBase = (id: string) => soldApp(id).baseMonthly;
/** Слаг, который касса ждёт в поле `app`. */
const appHref = (id: string) => PRICING_APP(soldApp(id).slug);
const appFormat = (id: string) =>
  `приложение · от ${usd(fromPricePerMonth(soldApp(id).baseMonthly))}/мес`;

/**
 * Подписка — одна: срок доступа ко ВСЕЙ планете (решение основателя 15.09.2026).
 *
 * Прежние три позиции сняты с продажи: All-Access (Gumroad xpxzam) и
 * Constitution Pro / Team (pyiaz / wjvquw) отдельными подписками больше не
 * продаются — Constitution входит в подписку AEVION. Их permalink на Gumroad
 * покупателю не показываем нигде.
 */
export const SUBSCRIPTIONS: Product[] = [
  {
    id: "aevion-planet",
    title: "Подписка AEVION",
    format: `вся планета · от ${usd(fromPricePerMonth(PLANET_BASE_MONTHLY))}/мес · от ${usd(
      termTotal(PLANET_BASE_MONTHLY, "lite"),
    )} за месяц`,
    desc:
      "Доступ ко всем модулям AEVION на выбранный срок: 1, 3, 6, 9 или 12 месяцев. " +
      "Чем длиннее срок, тем дешевле месяц. Оплата за весь срок вперёд, одним платежом.",
    priceUsd: PLANET_BASE_MONTHLY,
    billing: "term",
    kind: "subscription",
    processor: "aevion",
    href: PRICING_TERMS,
    appId: "aevion-planet",
    badge: "Всё сразу",
    includes: [
      "Все модули AEVION — без доплаты за каждый",
      "Сроки: 1 · 3 · 6 · 9 · 12 месяцев",
      "Месяц дешевеет с длиной срока — вдвое на 12 месяцах",
      "Новые модули, вышедшие в оплаченный срок, — тоже включены",
    ],
  },
];

/** Гайды и книги — разовая покупка, мгновенная выдача файла. */
export const GUIDES: Product[] = [
  {
    id: "oijxmq",
    title: "Протокол долголетия AEVION — 12 недель",
    format: "PDF · 9 стр. · RU",
    desc:
      "Цикл «измерь → воздействуй → перемерь»: панель из 26 маркеров с целевыми коридорами, " +
      "20 вмешательств с градацией доказательности A/B/C/E, 12-недельный таймлайн и таблица результата. " +
      "Отдельный раздел — что переоценено (NMN/NR, теломеры, «волновые» гаджеты).",
    priceUsd: 19,
    billing: "once",
    kind: "guide",
    processor: "gumroad",
    href: GUM("oijxmq"),
    appId: "qrenew",
    badge: "Новое",
  },
  {
    id: "tmuyxw",
    title: "Протокол «Анти-седина»",
    format: "PDF · гайд · RU",
    desc:
      "Наука о том, почему волос седеет и что реально её замедляет — без хайпа. " +
      "Медь/цинк, спермидин, окислительный стресс + 12-недельный протокол.",
    priceUsd: 9,
    billing: "once",
    kind: "guide",
    processor: "gumroad",
    href: GUM("tmuyxw"),
    appId: "qrenew",
  },
  {
    id: "kkiavh",
    title: "The Anti-Grey Protocol",
    format: "PDF · guide · EN",
    desc:
      "The evidence-first science of pigment aging and what actually slows it. " +
      "Copper/zinc, spermidine, oxidative stress + a 12-week protocol.",
    priceUsd: 19,
    billing: "once",
    kind: "guide",
    processor: "gumroad",
    href: GUM("kkiavh"),
    appId: "qrenew",
  },
  {
    id: "ghvzq",
    title: "Gratitude ∞ Forever Young — полный пакет",
    format: "PDF + EPUB + аудио · книга",
    desc: "90-дневная практика благодарности и молодости: 4 минуты в день. Книга, аудиокнига и материалы одним пакетом.",
    priceUsd: 29.99,
    billing: "once",
    kind: "book",
    processor: "gumroad",
    href: GUM("ghvzq"),
    appId: "gratitude-book",
  },
  {
    id: "lelzw",
    title: "Gratitude ∞ Forever Young — книга + аудиокнига",
    format: "PDF + EPUB + аудио",
    desc: "Книга и полная аудиоверсия. Для тех, кто слушает в дороге.",
    priceUsd: 14.99,
    billing: "once",
    kind: "book",
    processor: "gumroad",
    href: GUM("lelzw"),
    appId: "gratitude-book",
  },
  {
    id: "orcfbo",
    title: "Gratitude ∞ Forever Young — книга",
    format: "PDF + EPUB",
    desc: "Только текст книги. Самый доступный вход.",
    priceUsd: 9.99,
    billing: "once",
    kind: "book",
    processor: "gumroad",
    href: GUM("orcfbo"),
    appId: "gratitude-book",
  },
];

/**
 * Отдельные приложения — ТОЛЬКО пять (политика 15.09.2026): CyberChess, Multichat,
 * QVenture, IP Bureau, DevHub. Цена и слаг кассы — из STANDALONE_APPS
 * (`./termPricing`), здесь только подача. Остальные модули отдельно не
 * продаются: они входят в подписку AEVION. Сняты с отдельной продажи Smeta
 * Trainer, QPayNet, QContract — страницы модулей на месте, кнопки покупки нет.
 *
 * Прямых ссылок Lemon Squeezy на новую лестницу нет, поэтому href ведёт на
 * `/pricing?app=<slug>#apps`: там выбирается срок, и заказ уходит в кассу полем
 * `app`. Прежние ссылки LS на месячные варианты покупателю не показываются.
 */
export const MODULES: Product[] = [
  {
    id: "devhub",
    title: "DevHub Studio Pro",
    format: appFormat("devhub"),
    desc: "Браузерная IDE на движке VS Code, генерация кода AI и деплой на Cloudflare Pages.",
    priceUsd: appBase("devhub"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("devhub"),
    appId: "devhub",
    badge: "Флагман",
  },
  {
    id: "multichat",
    title: "AEVION Multichat",
    format: appFormat("multichat"),
    // Текст — с посадочной самого модуля (/multichat-engine/launch), не сочинён здесь.
    desc: "Один вопрос — ответы моделей четырёх независимых поставщиков рядом, с картой расхождений и чеком, который проверяется по ссылке.",
    priceUsd: appBase("multichat"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("multichat"),
    appId: "multichat-engine",
  },
  {
    id: "qventure",
    title: "QVenture",
    format: appFormat("qventure"),
    desc: "Разбор венчурной сделки: TAM/SOM, юнит-экономика, проверка допущений основателя.",
    priceUsd: appBase("qventure"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("qventure"),
    appId: "qventure",
  },
  {
    id: "bureau",
    title: "AEVION IP Bureau",
    // ИСПРАВЛЕНО 21.08.2026. Прежний текст обещал «подпись Ed25519» и
    // «привязку ко времени через OpenTimestamps». Оба обещания уже были
    // признаны неподтверждёнными 19.08 и внесены в catalogClaims.guard —
    // но сторож читал только страницу /apps, а каталог товаров не читал,
    // и на витрине они прожили ещё два дня. Факты на 21.08:
    //
    //   подпись — по умолчанию `demo-hmac-sha256`, и сертификат сам её
    //             называет; настоящей Ed25519 становится ТОЛЬКО при
    //             заданном закрытом ключе (bureau.ts, строка ~2555);
    //   время   — отметка нашего сервера (signedAt DEFAULT NOW()),
    //             внешнего якорения в бюро нет: OpenTimestamps в
    //             bureau.ts не используется ни разу.
    //
    // Продукт продаётся за доказуемость, поэтому неточность здесь дороже
    // обычной: покупатель платит именно за свойство, которого не было.
    desc: "Доказательство авторства: хеш SHA-256, отметка времени и подпись сертификата — алгоритм и режим подписи названы в самом сертификате.",
    format: appFormat("bureau"),
    priceUsd: appBase("bureau"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("bureau"),
    appId: "aevion-ip-bureau",
  },
  {
    id: "cyberchess",
    title: "CyberChess",
    format: appFormat("cyberchess"),
    // Числа задач тут НЕТ намеренно, и вот почему — проверено 28.08.2026.
    // Ручка, дающая настоящий размер банка, нашлась: /api/cyberchess-puzzles/meta
    // отдаёт bankTotal 502584. Я вписал «полмиллиона задач» — и тут же проверил
    // мутацией, поймает ли кто-нибудь ЛОЖНОЕ число. Подменил на «десять миллионов»:
    // ни один сторож не покраснел. То есть цифра на продающей карточке жила бы без
    // всякой защиты и разъехалась бы с продуктом при первом же изменении банка.
    // Вернуть можно, но вместе со сторожем, который сверяет её с ручкой.
    // Слово «пазлы» из описания убрано: в модуле их зовут задачами.
    desc: "Шахматная платформа: задачи, ИИ-тренер и соперники, играющие по-человечески на своём уровне.",
    priceUsd: appBase("cyberchess"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("cyberchess"),
    appId: "cyberchess",
  },
  // 20.09.2026, слово основателя «везде должны быть цены». Товаров в кассе у этих
  // четырёх пока нет: страница цен честно покажет цену и «связаться» вместо кнопки
  // (сторож unsellableTierExplainsItself). Кнопки зажгутся сами, когда появятся
  // варианты и переменные LEMON_SQUEEZY_VARIANT_<SLUG>_<СТУПЕНЬ>.
  {
    id: "qright",
    title: "QRight",
    format: appFormat("qright"),
    desc: "Регистрация авторства: фиксация даты и содержания работы, выгрузка доказательств.",
    priceUsd: appBase("qright"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("qright"),
    appId: "qright",
  },
  {
    id: "qsign",
    title: "QSign",
    format: appFormat("qsign"),
    desc: "Подпись документов и проверка целостности: канонический JSON, сверка по отпечатку.",
    priceUsd: appBase("qsign"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("qsign"),
    appId: "qsign",
  },
  {
    id: "startup-exchange",
    title: "Startup Exchange",
    format: appFormat("startup_exchange"),
    desc: "Витрина идей, MVP и готовых продуктов: разместить, найти, договориться о сделке.",
    priceUsd: appBase("startup_exchange"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("startup_exchange"),
    appId: "startup-exchange",
  },
  {
    id: "qskyway",
    title: "QSkyway",
    format: appFormat("qskyway"),
    desc: "Навигация воздушных коридоров города: маршруты, высоты, ограничения и ветер.",
    priceUsd: appBase("qskyway"),
    billing: "term",
    kind: "module",
    processor: "aevion",
    href: appHref("qskyway"),
    appId: "qskyway",
  },
];

// Сторож на сборке каталога: отдельно продаётся ровно то, что названо в
// STANDALONE_APPS. Шестое приложение в MODULES без строки в лестнице (или
// потерянное пятое) — это кнопка «купить» к товару, которого касса не знает.
{
  const inCatalog = new Set(MODULES.map((m) => soldApp(m.id).slug));
  const missing = STANDALONE_APPS.filter((a) => !inCatalog.has(a.slug)).map((a) => a.slug);
  if (missing.length || inCatalog.size !== MODULES.length) {
    throw new Error(`products.ts: MODULES расходится с STANDALONE_APPS (нет: ${missing.join(", ") || "—"})`);
  }
}

export const ALL_PRODUCTS: Product[] = [...SUBSCRIPTIONS, ...GUIDES, ...MODULES];

/**
 * Оговорки модулей, которые ОТДЕЛЬНО НЕ ПРОДАЮТСЯ, но живут на сайте и входят в
 * подписку AEVION. До 15.09.2026 текст жил в карточках QPayNet и QContract; снять
 * карточку с продажи не значит снять оговорку со страницы модуля — там по-прежнему
 * даются обещания («12-rail checkout», подписи документов), и условие, на котором
 * они верны, человек обязан видеть. Отрисовывает `components/ProductNotice.tsx`.
 */
export const MODULE_NOTICES: Record<string, string> = {
  qpaynet:
    "Демонстрационный режим. AEVION не является лицензированным банком, платёжным " +
    "институтом или эмитентом электронных денег: реальные средства и платежи не " +
    "обрабатываются — только оценка и обучение.",
  qcontract:
    "Демонстрационный режим. Документы и подписи, созданные здесь, не являются " +
    "юридической консультацией и могут не иметь силы без независимой проверки " +
    "квалифицированным специалистом.",
};

/** Оговорка продукта или модуля: сперва карточка каталога, затем MODULE_NOTICES. */
export function productNotice(id: string): string | undefined {
  const own = productById(id)?.notice;
  if (own) return own;
  return Object.prototype.hasOwnProperty.call(MODULE_NOTICES, id) ? MODULE_NOTICES[id] : undefined;
}

const BY_ID = new Map(ALL_PRODUCTS.map((p) => [p.id, p]));

/**
 * Позиция каталога по id. Нужна страницам, у которых своя подача и свои данные
 * (например `/apps` — иконки, категории, highlights), чтобы **цена и ссылка на
 * оплату** брались отсюда, а не дублировались у них. Ровно это дублирование и
 * развело каталоги: на 26.07.2026 `/apps` и `/shop` показывали разные наборы.
 */
export function productById(id: string): Product | undefined {
  return BY_ID.get(id);
}

/** Сумма цен пяти приложений за 1 месяц (Lite) — чтобы честно сравнить с подпиской
 *  на всю планету за тот же срок. Обе суммы — платёж за один месяц доступа. */
export const MODULES_TOTAL_USD = MODULES.reduce((s, p) => s + p.priceUsd, 0);

/* ── Атрибуция канала ────────────────────────────────────────────────────────
 *
 * Вопрос «какой канал принёс продажу» на 27.07.2026 не имел ответа: ссылки
 * уходили в чекаут голыми, и в дашборде выручки видно ЧТО купили, но не откуда
 * пришёл человек. При том что весь смысл раздачи роликов — узнать, что работает.
 *
 * Решение без внешней аналитики и куки: метка едет прямо в чекаут.
 *   - Gumroad кладёт произвольные query-параметры в `url_params` и отдаёт их
 *     обратно в ping-вебхуке;
 *   - LemonSqueezy принимает `checkout[custom][key]` и возвращает в custom_data.
 *
 * ⚠️ Одного `channel=` НЕ ХВАТАЕТ, и это проверено 12.08.2026, до раздачи роликов.
 * Метка честно доезжала до чекаута, но увидеть её было негде:
 *   1. В дашборде продаж Gumroad произвольные параметры не отображаются —
 *      строит отчёт он только по UTM (`utm_source`/`utm_medium`/`utm_campaign`),
 *      создавая ссылку сам при первом переходе. `url_params` доступны лишь
 *      через API и ping.
 *   2. Наш ping-обработчик `gumroadWebhook.ts` `url_params` не читает вообще —
 *      он берёт email, товар и статус. То есть обещание «канал виден рядом с
 *      продажей» не выполнял НИКТО: ни Gumroad, ни мы.
 * Поэтому рядом с `channel=` едет и UTM-тройка: она попадает в тот отчёт, куда
 * основатель действительно смотрит. `channel=` оставлен — он в `url_params`,
 * и по нему можно поднять канал через API, когда вебхук научится его читать.
 *
 * Метка берётся из адреса самой страницы: в шапке профиля Instagram стоит
 * `/go?c=ig`, в TikTok — `/go?c=tt`, и так далее. Одна страница, разные суффиксы.
 */

/** Разрешённые метки. Белый список, а не любая строка: параметр приходит из
 *  адресной строки, и пускать его в чекаут без проверки нельзя. */
export const CHANNELS: Record<string, string> = {
  ig: "instagram",
  tt: "tiktok",
  th: "threads",
  yt: "youtube",
  tg: "telegram",
  fb: "facebook",
  x: "x",
  qr: "qr-code",
  // Дзен и VK добавлены 21.08.2026: по ним идёт русский трафик (см. записи о
  // конвейере «ролик → продажа»), а метки для них не было — ссылка с ?c=dz
  // попадала в «неизвестный канал» и теряла происхождение человека.
  // Неизвестное значение channelFrom превращает в null НАМЕРЕННО, поэтому
  // добавление сюда — единственный способ научить систему новому каналу.
  dz: "dzen",
  vk: "vk",
  // Западные каналы добавлены 08.09.2026, до публикации. Тексты для Show HN и
  // Product Hunt готовы и ждут руки основателя; без метки переход с них
  // вернул бы из channelFrom null, продажа ушла бы в "unattributed", и на
  // вопрос «окупился ли западный канал» ответа бы не было — ровно то, ради
  // чего метки и заводились. Проверять это ПОСЛЕ публикации поздно: канал
  // отрабатывает один раз.
  hn: "hacker-news",
  ph: "product-hunt",
  // LinkedIn и Bluesky добавлены 15.09.2026: пост запуска 20.09 уходит и туда
  // (13-Бренд-медиа-реклама/AEVION-Посты), а метки не было — переход вернул бы
  // null и продажа ушла бы в "unattributed". Проверять после публикации поздно.
  li: "linkedin",
  bs: "bluesky",
};

/** Нормализует ?c= в известный канал; всё неизвестное → null (метки не будет). */
export function channelFrom(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const ключ = v.trim().toLowerCase();

  /*
   * Прямая индексация находит и УНАСЛЕДОВАННОЕ, а `?? null` этого не ловит:
   * оператор отсеивает только null и undefined, а `CHANNELS["constructor"]` —
   * функция Object, она вполне себе значение.
   *
   * Замерено 02.09.2026 пробой: channelFrom("constructor") возвращал ФУНКЦИЮ.
   * Дальше она уезжала как «канал»: в meta события учёта (там JSON.stringify
   * молча выбрасывает функции, и канал исчезал вовсе) и в withChannel(), где
   * подставлялась в адрес кассы строкой «function Object() { [native code] }».
   * То есть достаточно было зайти на страницу с `?c=constructor`, чтобы
   * испортить атрибуцию покупки — своей или чужой.
   *
   * Тот же класс платформа уже ловила у ссылок Gumroad и у вариантов
   * LemonSqueezy; там стоит ровно эта проверка.
   */
  if (!Object.prototype.hasOwnProperty.call(CHANNELS, ключ)) return null;
  return CHANNELS[ключ] ?? null;
}

/** Тип трафика для `utm_medium`. Все метки из CHANNELS — соцсети, кроме
 *  печатного QR-кода: он приходит с бумаги, и мешать его с соцсетями значит
 *  завысить их вклад. Выводится из самой метки, отдельного списка не заводим —
 *  иначе он разъедется с CHANNELS. */
function utmMedium(channel: string): string {
  if (channel === "qr-code") return "qr";
  // Hacker News и Product Hunt — площадки-агрегаторы, а не соцсети: там не
  // подписка на нас, а разовый переход из ленты обсуждений. Смешивать их с
  // instagram/tiktok значит завысить вклад соцсетей ровно на объём западного
  // запуска. Список отдельный не заводим — вывод по-прежнему из самой метки.
  if (channel === "hacker-news" || channel === "product-hunt") return "referral";
  return "social";
}

/**
 * Добавляет метку канала к ссылке оплаты. Для Gumroad и LemonSqueezy параметр
 * называется по-разному, поэтому разбираем по домену, а не по типу товара:
 * товар может переехать с одного процессинга на другой, домен — нет.
 *
 * @param landing страница, с которой ушёл клик («go», «shop», «longevity»).
 *   Едет в `utm_campaign`, чтобы было видно не только КАКОЙ канал принёс
 *   продажу, но и какая витрина. Значение по умолчанию намеренно безликое:
 *   новый вызов без аргумента даст валидную UTM-тройку, а не сломанную.
 */
export function withChannel(href: string, channel: string | null, landing = "site"): string {
  if (!channel) return href;
  // Внутренний адрес (/pricing?app=…#apps) — не касса продавца: странице цен
  // нужна короткая метка ?c=, которую читает channelNow, и её надо вставить ДО
  // хеша. Дописанная после `#` UTM-тройка до сервера не доехала бы вовсе.
  if (href.startsWith("/")) return keepChannel(href, channel);
  const sep = href.includes("?") ? "&" : "?";
  if (href.includes("lemonsqueezy.com")) {
    // 🔴 ПОДПИСАННЫЙ адрес не дополняем НИЧЕМ. Замер 20.09.2026 с контролями:
    // настоящий адрес кассы из `POST /api/pricing/checkout/session` отвечает
    // 200; он же плюс `checkout[custom][channel]=youtube` — **403**; он же
    // снова как есть — опять 200. Посторонний `foo=bar` тоже даёт 403, то есть
    // ломается подпись, а не конкретный параметр. Отвечает сам LemonSqueezy
    // (`x-powered-by: PHP`, в теле «signature» и «invalid»).
    //
    // Кого это било: `withChannel` возвращает адрес без изменений, когда
    // канала нет, — значит без метки всё работало, а с меткой покупатель
    // упирался в 403. Ломался ровно тот, кого мы привели по помеченной
    // ссылке: с YouTube, из профиля, из рассылки. Наши зонды ходили без
    // канала и поэтому дефект не всплывал ни в одной проверке.
    //
    // Метка в LemonSqueezy передаётся при СОЗДАНИИ сессии: фронт кладёт
    // `channel` в тело запроса, бэкенд — в `checkout_data.custom`
    // (checkout.ts принимает его с 31.08, lemonSqueezyProvider.ts:200).
    //
    // Непод­писанные ссылки на товар (`/buy/<uuid>`) параметры принимают, и для
    // них поведение сохранено: признак — наличие `signature` в адресе.
    if (/[?&]signature=/.test(href)) return href;
    return `${href}${sep}checkout[custom][channel]=${encodeURIComponent(channel)}`;
  }
  // UTM-тройка целиком: Gumroad заводит ссылку в отчёте по первому переходу,
  // и неполный набор в этот отчёт не попадает.
  const q = new URLSearchParams({
    channel,
    utm_source: channel,
    utm_medium: utmMedium(channel),
    utm_campaign: landing,
  });
  return `${href}${sep}${q.toString()}`;
}

/** Короткий ключ `?c=` по нормализованному каналу — обратное к channelFrom.
 *
 *  ЗАЧЕМ ОТДЕЛЬНАЯ ФУНКЦИЯ. В CHANNELS ключи короткие (yt), а значения длинные
 *  (youtube). Страница получает от channelFrom уже длинное значение, и подстановка
 *  его в ссылку выглядит правильной, но channelFrom("youtube") вернёт null:
 *  метка исчезает МОЛЧА, ровно на внутреннем переходе. Замер 28.08.2026 — две
 *  такие потери: /en/go → /en/longevity и /longevity → /shop, обе на пути, по
 *  которому человек идёт к покупке после бесплатного материала. */
export function channelParam(channel: string | null): string | null {
  if (!channel) return null;
  const hit = Object.entries(CHANNELS).find(([, value]) => value === channel);
  return hit ? hit[0] : null;
}

/** Внутренний переход, сохраняющий метку канала в том виде, в каком её примет
 *  следующая страница. Для ВНЕШНИХ кассовых ссылок — withChannel: там нужна
 *  UTM-тройка, здесь она только мусорила бы адрес. */
export function keepChannel(path: string, channel: string | null): string {
  const c = channelParam(channel);
  if (!c) return path;
  // Хеш остаётся в конце: `/pricing#tiers?c=yt` потерял бы метку (всё после `#`
  // браузер считает якорем и серверу не отправляет).
  const hashAt = path.indexOf("#");
  const base = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}c=${encodeURIComponent(c)}${hash}`;
}
