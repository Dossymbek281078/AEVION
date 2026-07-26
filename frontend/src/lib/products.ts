/**
 * AEVION — каталог ПОКУПАЕМЫХ товаров. Единый источник правды для витрины.
 *
 * Зачем файл появился (инвентарь 2026-07-26): про товары знали ЧЕТЫРЕ места, и они
 * расходились между собой —
 *   1. `/shop/page.tsx`      — 3 товара хардкодом;
 *   2. `/apps/page.tsx`      — 7 модулей с checkoutUrl (LemonSqueezy + Gumroad);
 *   3. `lib/gumroad.ts`      — GUMROAD_PERMALINKS полностью закомментирован, из-за чего
 *                              gumroadPermalink() всегда отдаёт дефолт `xpxzam` (All-Access $59)
 *                              — то есть кнопка «купить» в любом модуле вела в подписку;
 *   4. backend `revenue.ts`  — PERMALINK_TO_APP, самый полный список (8 permalink'ов).
 * Покупатель при этом видел на витрине 3 позиции из 15 живых.
 *
 * Цены сверены 2026-07-26 напрямую с дашбордом Gumroad (8 позиций Published) и
 * с `/apps/page.tsx` (LemonSqueezy). Не выдумывать записи: товар попадает сюда,
 * только если у него есть живой чекаут.
 *
 * Бэкенд-зеркало: `aevion-globus-backend/src/routes/gumroadWebhook.ts` (permalink → tier)
 * и `routes/revenue.ts` (permalink → appId). Фронт и бэк — раздельные TS-проекты,
 * общего импорта нет, поэтому связь через комментарии, как и в `lib/gumroad.ts`.
 */

export type ProductKind = "subscription" | "guide" | "book" | "module";
export type Processor = "gumroad" | "lemonsqueezy";

export interface Product {
  /** Gumroad permalink или slug модуля — стабильный ключ для атрибуции */
  id: string;
  title: string;
  /** Формат/язык — короткая строка под заголовком */
  format: string;
  desc: string;
  /** Цена в USD. Для подписок — за месяц. */
  priceUsd: number;
  kind: ProductKind;
  processor: Processor;
  href: string;
  /** Что входит — показывается только там, где состав неочевиден (подписки) */
  includes?: string[];
  badge?: string;
  /** appId для сверки с backend revenue-атрибуцией */
  appId?: string;
}

const GUM = (permalink: string) => `https://aevion.gumroad.com/l/${permalink}?wanted=true`;
const LS = (id: string) => `https://aevion.lemonsqueezy.com/checkout/buy/${id}`;

/** Подписки. Состав обязателен — до 26.07.2026 покупатель All-Access видел
 *  цену $59/мес и НИ СЛОВА о том, что входит. */
export const SUBSCRIPTIONS: Product[] = [
  {
    id: "xpxzam",
    title: "AEVION All-Access",
    format: "подписка · $59 / мес",
    desc: "Доступ ко всей экосистеме AEVION одной подпиской — вместо покупки модулей поштучно.",
    priceUsd: 59,
    kind: "subscription",
    processor: "gumroad",
    href: GUM("xpxzam"),
    appId: "aevion-all-access",
    badge: "Всё сразу",
    includes: [
      "Все живые продукты AEVION (30+ модулей)",
      "QRight · QSign · IP Bureau — полный доступ",
      "Финтех-стек: QTrade, QPayNet, QContract",
      "QCoreAI и Multichat Engine",
      "Новые модули по мере выхода — без доплаты",
    ],
  },
  {
    id: "wjvquw",
    title: "Constitution Team",
    format: "подписка · $49 / мес",
    desc: "Constitution Design Lab для команды: совместная работа над IP-конституцией, общие объекты и подписи.",
    priceUsd: 49,
    kind: "subscription",
    processor: "gumroad",
    href: GUM("wjvquw"),
    appId: "constitution",
    includes: ["Всё из Constitution Pro", "Командные места", "Общая база объектов и подписей"],
  },
  {
    id: "pyiaz",
    title: "Constitution Pro",
    format: "подписка · $9 / мес",
    desc: "Конструктор IP-конституции на 12 страниц, 27+ эндпоинтов подачи, криптографическое подтверждение через QSign.",
    priceUsd: 9,
    kind: "subscription",
    processor: "gumroad",
    href: GUM("pyiaz"),
    appId: "constitution",
    includes: ["Конструктор конституции", "Подача документов", "QSign-подпись"],
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
    kind: "book",
    processor: "gumroad",
    href: GUM("orcfbo"),
    appId: "gratitude-book",
  },
];

/** Модули с разовой лицензией. Ссылки сверены с `/apps/page.tsx` — там же живут
 *  описания и highlights; здесь короткая витринная строка. */
export const MODULES: Product[] = [
  {
    id: "devhub",
    title: "DevHub Studio Pro",
    format: "модуль · лицензия",
    desc: "Браузерная IDE на движке VS Code, генерация кода AI и деплой на Railway / Vercel / Cloudflare Pages.",
    priceUsd: 149,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("ab30b6f3-1d69-4db6-b7ab-86ef0d363a57"),
    appId: "devhub",
    badge: "Флагман",
  },
  {
    id: "smeta",
    title: "Smeta Trainer",
    format: "модуль · лицензия",
    desc: "AI-тренажёр сметного дела РК: корпус ССЦ/ЭСН, разбор ошибок студента, формы 1–3 и КС-2/КС-3.",
    priceUsd: 49,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("91c430c8-74f8-46f2-9499-816c93533ef4"),
    appId: "smeta-trainer",
  },
  {
    id: "qventure",
    title: "QVenture",
    format: "модуль · лицензия",
    desc: "Разбор венчурной сделки: TAM/SAM/SOM, юнит-экономика, проверка допущений основателя.",
    priceUsd: 39,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("79ca3e07-6c75-4de7-8052-0f3bb99277a2"),
    appId: "qventure",
  },
  {
    id: "bureau",
    title: "AEVION IP Bureau",
    format: "модуль · лицензия",
    desc: "Доказательство авторства: подпись Ed25519, хеш SHA-256, привязка ко времени через OpenTimestamps.",
    priceUsd: 29,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("be5cf241-159f-4f1c-9818-1e9634ba5fab"),
    appId: "aevion-ip-bureau",
  },
  {
    id: "qpaynet",
    title: "QPayNet",
    format: "модуль · лицензия",
    desc: "Встраиваемые платежи и расчёты внутри продукта.",
    priceUsd: 29,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("f0966b9a-6c3c-41ee-9b36-e2fd1a0a82a3"),
    appId: "qpaynet-embedded",
  },
  {
    id: "cyberchess",
    title: "CyberChess",
    format: "модуль · лицензия",
    desc: "Шахматная платформа: 500k пазлов, AI-коуч, человечные боты по уровням.",
    priceUsd: 19,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("11a4bb2a-2549-4352-a87f-80a8bdad64bd"),
    appId: "cyberchess",
  },
  {
    id: "qcontract",
    title: "QContract",
    format: "модуль · лицензия",
    desc: "Разбор и генерация договоров с проверкой рисков.",
    priceUsd: 19,
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("8175a6b2-f3fa-4b51-bed6-da993267701d"),
    appId: "qcontract",
  },
];

export const ALL_PRODUCTS: Product[] = [...SUBSCRIPTIONS, ...GUIDES, ...MODULES];

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

/** Сумма разовых цен модулей — используется, чтобы честно показать выгоду подписки. */
export const MODULES_TOTAL_USD = MODULES.reduce((s, p) => s + p.priceUsd, 0);
