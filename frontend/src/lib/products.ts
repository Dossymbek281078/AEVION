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
  /** Цена в USD. Для повторяющихся списаний — за месяц. */
  priceUsd: number;
  /**
   * Как списываются деньги. ПРОВЕРЕНО 26.07.2026 на живых чекаутах, а не по
   * названию товара: все семь модулей на LemonSqueezy отдают «billed every
   * month». До этой проверки они были подписаны в каталоге как «разовая
   * лицензия» — человек, нажав «Купить» за $149, попадал бы на ежемесячное
   * списание. Поле обязательное именно поэтому: угадывать здесь нельзя.
   */
  billing: "monthly" | "once";
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
const LS = (id: string) => `https://aevion.lemonsqueezy.com/checkout/buy/${id}`;

/** Подписки. Состав обязателен — до 26.07.2026 покупатель All-Access видел
 *  цену $59/мес и НИ СЛОВА о том, что входит. */
export const SUBSCRIPTIONS: Product[] = [
  {
    id: "xpxzam",
    title: "AEVION All-Access",
    format: "подписка · $59 / мес",
    // Формулировка сверена с текстом самого продавца на Gumroad, а не сочинена из тарифов.
    desc:
      "Полный доступ к платформе — 15+ модулей: QRight, QSign, QCoreAI, QFusionAI, QPayNet, " +
      "QTradeOffline, Constitution и другие. Одна подписка, без лимитов.",
    priceUsd: 59,
    billing: "monthly",
    kind: "subscription",
    processor: "gumroad",
    href: GUM("xpxzam"),
    appId: "aevion-all-access",
    badge: "Всё сразу",
    includes: [
      // Здесь стояло «30+ модулей», а строкой выше в desc — «15+». Два разных
      // числа в одной карточке товара, при 36 живых по реестру. desc трогать
      // нельзя: он намеренно повторяет текст продавца на Gumroad, и разойтись
      // с чекаутом хуже, чем быть неточным. Поэтому здесь число убрано —
      // покупателю важно «все», а не цифра, которая устареет к следующему релизу.
      "Все живые продукты AEVION",
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
    desc:
      "Симулятор мироустройства: восемь параметров, четыре опоры, живой прогон в исторические режимы. " +
      "Безлимит сохранений, ИИ-советник, чистый PDF, виджет для встраивания.",
    priceUsd: 49,
    billing: "monthly",
    kind: "subscription",
    processor: "gumroad",
    href: GUM("wjvquw"),
    appId: "constitution",
    // ⚠️ На Gumroad у Pro ($9) и Team ($49) СОВПАДАЮЩЕЕ описание — покупателю не видно,
    // за что доплата впятеро. Состав придумывать нельзя; до решения основателя честно
    // говорим то, что известно.
    includes: ["Состав пакета не описан продавцом — уточняется"],
  },
  {
    id: "pyiaz",
    title: "Constitution Pro",
    format: "подписка · $9 / мес",
    desc:
      "Симулятор мироустройства: восемь параметров, четыре опоры, живой прогон в исторические режимы. " +
      "Безлимит сохранений, ИИ-советник, чистый PDF, виджет для встраивания.",
    priceUsd: 9,
    billing: "monthly",
    kind: "subscription",
    processor: "gumroad",
    href: GUM("pyiaz"),
    appId: "constitution",
    includes: ["Безлимит сохранений", "ИИ-советник", "Чистый PDF", "Виджет для встраивания"],
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

/** Модули. ВСЕ СЕМЬ — ежемесячная подписка через LemonSqueezy (проверено на живых
 *  чекаутах 26.07.2026: «billed every month»), а не разовая покупка. Ссылки сверены
 *  с `/apps/page.tsx` — там же живут описания и highlights. */
export const MODULES: Product[] = [
  {
    id: "devhub",
    title: "DevHub Studio Pro",
    format: "модуль · подписка",
    desc: "Браузерная IDE на движке VS Code, генерация кода AI и деплой на Cloudflare Pages.",
    priceUsd: 149,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("ab30b6f3-1d69-4db6-b7ab-86ef0d363a57"),
    appId: "devhub",
    badge: "Флагман",
  },
  {
    id: "smeta",
    title: "Smeta Trainer",
    format: "модуль · подписка",
    desc: "AI-тренажёр сметного дела РК: корпус ССЦ/ЭСН, разбор ошибок студента, формы 1–3 и КС-2/КС-3.",
    priceUsd: 49,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("91c430c8-74f8-46f2-9499-816c93533ef4"),
    appId: "smeta-trainer",
  },
  {
    id: "qventure",
    title: "QVenture",
    format: "модуль · подписка",
    desc: "Разбор венчурной сделки: TAM/SAM/SOM, юнит-экономика, проверка допущений основателя.",
    priceUsd: 39,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("79ca3e07-6c75-4de7-8052-0f3bb99277a2"),
    appId: "qventure",
  },
  {
    id: "bureau",
    title: "AEVION IP Bureau",
    format: "модуль · подписка",
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
    desc: "Доказательство авторства: хеш SHA-256, отметка времени и подпись нотариуса. Алгоритм подписи назван в самом сертификате.",
    priceUsd: 29,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("be5cf241-159f-4f1c-9818-1e9634ba5fab"),
    appId: "aevion-ip-bureau",
  },
  {
    id: "qpaynet",
    title: "QPayNet",
    format: "модуль · подписка",
    desc: "Инфраструктура встроенных платежей: мультивалютность, виртуальные карты, API и вебхуки.",
    notice:
      "Демонстрационный режим. AEVION не является лицензированным банком, платёжным " +
      "институтом или эмитентом электронных денег: реальные средства и платежи не " +
      "обрабатываются — только оценка и обучение.",
    priceUsd: 29,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("f0966b9a-6c3c-41ee-9b36-e2fd1a0a82a3"),
    appId: "qpaynet-embedded",
    badge: "Бета · демо",
  },
  {
    id: "cyberchess",
    title: "CyberChess",
    format: "модуль · подписка",
    // Число пазлов НЕ указываем: в памяти проекта значится 500k из CC0-дампа, а живая
    // страница в шапке показывает «400 puzzles», и эндпоинта, который бы дал реальный
    // размер пула, найти не удалось. Непроверенная цифра на продающей карточке хуже,
    // чем её отсутствие — вернуть, когда будет чем подтвердить.
    desc: "Шахматная платформа: пазлы, AI-коуч и боты, играющие по-человечески на своём уровне.",
    priceUsd: 19,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("11a4bb2a-2549-4352-a87f-80a8bdad64bd"),
    appId: "cyberchess",
  },
  {
    id: "qcontract",
    title: "QContract",
    format: "модуль · подписка",
    desc: "Самоуничтожающиеся защищённые документы: лимиты просмотров и срока, пароль и подпись.",
    notice:
      "Демонстрационный режим. Документы и подписи, созданные здесь, не являются " +
      "юридической консультацией и могут не иметь силы без независимой проверки " +
      "квалифицированным специалистом.",
    priceUsd: 19,
    billing: "monthly",
    kind: "module",
    processor: "lemonsqueezy",
    href: LS("8175a6b2-f3fa-4b51-bed6-da993267701d"),
    appId: "qcontract",
    badge: "Бета · демо",
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

/** Сумма месячных цен модулей — используется, чтобы честно показать выгоду подписки.
 *  Все модули списываются ежемесячно, поэтому сумма тоже месячная. */
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
};

/** Нормализует ?c= в известный канал; всё неизвестное → null (метки не будет). */
export function channelFrom(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  return CHANNELS[v.trim().toLowerCase()] ?? null;
}

/** Тип трафика для `utm_medium`. Все метки из CHANNELS — соцсети, кроме
 *  печатного QR-кода: он приходит с бумаги, и мешать его с соцсетями значит
 *  завысить их вклад. Выводится из самой метки, отдельного списка не заводим —
 *  иначе он разъедется с CHANNELS. */
function utmMedium(channel: string): string {
  return channel === "qr-code" ? "qr" : "social";
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
  const sep = href.includes("?") ? "&" : "?";
  if (href.includes("lemonsqueezy.com")) {
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
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}c=${encodeURIComponent(c)}`;
}
