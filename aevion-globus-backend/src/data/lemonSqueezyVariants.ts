/**
 * Lemon Squeezy variant mapping — Lite / Medium / Full subscription tiers.
 *
 * LS is now the LIVE subscription processor (account activated 2026-06-04).
 * Each tier:period maps to one LS variant id, supplied via env so new variant
 * IDs are pasted without code changes:
 *
 *   LEMON_SQUEEZY_VARIANT_LITE_MONTHLY     LEMON_SQUEEZY_VARIANT_LITE_ANNUAL
 *   LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY   LEMON_SQUEEZY_VARIANT_MEDIUM_ANNUAL
 *   LEMON_SQUEEZY_VARIANT_FULL_MONTHLY     LEMON_SQUEEZY_VARIANT_FULL_ANNUAL
 *   LEMON_SQUEEZY_VARIANT_PLANET_MONTHLY   LEMON_SQUEEZY_VARIANT_PLANET_ANNUAL
 *
 * Setup:
 *   1. LS dashboard → Store → Products → New product (subscription)
 *      - Lite   $19/mo  + $190/yr variant
 *      - Medium $29/mo  + $290/yr variant
 *      - Full   $49/mo  + $490/yr variant
 *   2. Open each variant; the numeric variant id is in the URL:
 *      lemonsqueezy.com/dashboard/.../products/<pid>/variants/<VARIANT_ID>
 *   3. Paste each id into the matching env var on Railway.
 *
 * Prices on the LS variant are the source of truth — they MUST match the tier
 * prices in data/pricing.ts (lite 19/190, medium 29/290, full 49/490).
 *
 * ⚠️ ЦЕНЫ МЕНЯЛИСЬ ДВАЖДЫ. 22.07.2026 их подняли до 24/39/89, а 13.08.2026
 * вернули к 19/29/49 (коммит d424fbf07, «цены приведены к рынку»). Числа выше —
 * действующие, они совпадают с data/pricing.ts и с ответом /api/pricing на проде
 * (проверено 29.08.2026). Прежняя редакция этого файла велела ставить в кассе
 * 24/39/89 — то есть БОЛЬШЕ, чем показывает витрина; настроивший по ней вариант
 * списывал бы с покупателя лишнее. Если вариант уже заведён со старой ценой,
 * with the old prices, the dashboard price on each variant MUST be updated
 * (or a new variant created and the env var repointed) — this file only
 * changes what data/pricing.ts *displays/computes*, it cannot change what an
 * already-configured LS variant actually charges.
 *
 * ПОПРАВКА 28.08.2026. Здесь стояло «cyberchess's addonMonthly moved 19 → 9.99»
 * — это неверно и стоило мне поисков несуществующего расхождения за два дня до
 * запуска шахмат. 9.99 принадлежит `qcoreai` (data/pricing.ts), у cyberchess
 * там же стоит 19. Проверено по всей цепочке: products.ts — 19, pricing.ts —
 * 19, витрина /shop показывает «$19/мес», касса Lemon Squeezy берёт
 * «$19.00 billed every month». Расхождения нет. There is currently no `tier_pro_*` reference for the Universe
 * tier — a "pro" checkout falls through to Gumroad/stub, not LS, until one
 * is added here.
 *
 * A checkout reference is "tier_<tier>_<period>" (built by routes/checkout.ts),
 * e.g. "tier_lite_monthly". The webhook reverse-maps an incoming variant_id
 * back to that reference to provision the right tier.
 */

import type { TierId } from "./pricing";

export type LemonSqueezyReference =
  | "tier_lite_monthly"
  | "tier_lite_annual"
  | "tier_medium_monthly"
  | "tier_medium_annual"
  | "tier_full_monthly"
  | "tier_full_annual"
  | "tier_planet_monthly"
  | "tier_planet_annual"
  | "app_qventure"
  | "app_qpaynet"
  | "app_qcontract"
  | "app_constitution"
  | "app_ip_bureau"
  | "app_qrenew"
  | "app_smeta"
  | "app_cyberchess"
  | "app_devhub";

/** reference → env var holding the LS variant id. */
const TIER_VARIANT_ENV: Record<LemonSqueezyReference, string> = {
  tier_lite_monthly: "LEMON_SQUEEZY_VARIANT_LITE_MONTHLY",
  tier_lite_annual: "LEMON_SQUEEZY_VARIANT_LITE_ANNUAL",
  tier_medium_monthly: "LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY",
  tier_medium_annual: "LEMON_SQUEEZY_VARIANT_MEDIUM_ANNUAL",
  tier_full_monthly: "LEMON_SQUEEZY_VARIANT_FULL_MONTHLY",
  tier_full_annual: "LEMON_SQUEEZY_VARIANT_FULL_ANNUAL",
  tier_planet_monthly: "LEMON_SQUEEZY_VARIANT_PLANET_MONTHLY",
  tier_planet_annual: "LEMON_SQUEEZY_VARIANT_PLANET_ANNUAL",
  app_qventure:    "LEMON_SQUEEZY_VARIANT_QVENTURE",
  app_qpaynet:     "LEMON_SQUEEZY_VARIANT_QPAYNET",
  app_qcontract:   "LEMON_SQUEEZY_VARIANT_QCONTRACT",
  app_constitution:"LEMON_SQUEEZY_VARIANT_CONSTITUTION",
  app_ip_bureau:   "LEMON_SQUEEZY_VARIANT_IP_BUREAU",
  app_qrenew:      "LEMON_SQUEEZY_VARIANT_QRENEW",
  app_smeta:       "LEMON_SQUEEZY_VARIANT_SMETA",
  app_cyberchess:  "LEMON_SQUEEZY_VARIANT_CYBERCHESS",
  // DevHub Studio Pro продаётся в магазине ПОДПИСКОЙ ($149/мес, is_subscription:
  // true, interval: month — проверено на витрине 12.08.2026), а не разовой
  // покупкой. Переменная та же, что использовал разовый путь `order_created`, —
  // новой настройки на Railway не требуется. Без этой строки обратный поиск
  // возвращал null, и подписка за $149 провижинила тариф «lite» ($19).
  app_devhub:      "LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO",
};

/**
 * Сопоставлены ли ссылки товаров с идентификаторами вариантов магазина.
 *
 * Повод (28.08.2026). `/api/health/channels` отвечал `canPay: true`, потому что
 * у Lemon Squeezy заданы ключ и магазин. Но выдача доступа висит НЕ на этом, а
 * на переменной КОНКРЕТНОГО варианта: в вебхуке ветка товара берётся по
 * `process.env[...VARIANT_X]`, и при незаданной переменной сравнение не
 * совпадает, обработчик доходит до `return res.json({ ok: true, ignored })` —
 * заплативший получает успешный ответ и НИ ОДНОГО права. Магазин при этом
 * деньги принял.
 *
 * То есть имя поля `canPay` шире того, о чём оно отчитывалось: «провайдер
 * настроен» и «покупка превращается в доступ» — разные вопросы, и второй
 * снаружи спросить было нечем.
 *
 * СЕКРЕТОВ НЕ ОТДАЁМ: наружу идут только ссылки товаров (`app_devhub`) — это
 * наши внутренние имена, а не значения. Идентификаторы вариантов и длины
 * переменных здесь не появляются, как и во всей ручке состояния каналов.
 */
/**
 * ⚠️ ПОПРАВКА 02.09.2026, находка соседнего окна с контролем.
 *
 * Поле называлось `mapped` и считало ровно одно: переменная НЕПУСТА. То есть
 * «mapped: 17» означало «17 переменных заданы», а не «17 верных
 * идентификаторов». Опечатка или устаревшее значение — и состояние зелёное,
 * а покупатель платит и не получает доступ при исправной с виду цепочке.
 *
 * Это тот же класс, ради которого функция и написана («имя поля шире того,
 * о чём оно отчитывается»), только на уровень глубже: починив `canPay`, мы
 * завели `mapped` с ровно тем же дефектом.
 *
 * СВЕРИТЬ С ЭТАЛОНОМ НЕЛЬЗЯ: идентификаторы вариантов живут ТОЛЬКО в
 * переменных окружения, в каталоге товаров их нет. Поэтому «верный» здесь
 * недостижим, и обещать его именем поля нечестно.
 *
 * ЧТО ПРОВЕРИТЬ МОЖНО — формат, и это не косметика. Значение уходит в
 * `Number.parseInt(variantId, 10)` (lemonSqueezyProvider.ts:158), а
 * документация в шапке того же файла требует ЧИСЛОВОЙ идентификатор. Любое
 * нечисловое значение превращается в `NaN` и уезжает в кассу: плейсхолдер
 * из инструкции, UUID из адресной строки (это ДРУГОЙ идентификатор,
 * встречается в ссылке чекаута и легко перепутать), лишние кавычки.
 *
 * Поэтому теперь три числа вместо одного, и каждое означает ровно себя:
 *
 *   varsSet    переменная задана и непуста
 *   malformed  задана, но НЕ число — до кассы доедет NaN
 *   unmapped   не задана вовсе
 *
 * `mapped` убран намеренно, а не переименован с сохранением синонима: два
 * указателя на одно расходятся молча, и мы это уже проходили. Единственный
 * читатель (`routes/channelsHealth.ts`) поправлен тем же коммитом.
 *
 * СЕКРЕТОВ НЕ ОТДАЁМ по-прежнему: наружу идут ТОЛЬКО счётчики и наши
 * внутренние имена ссылок. Значения переменных не появляются ни здесь, ни в
 * ручке состояния.
 */
export function variantMappingStatus(): {
  total: number;
  varsSet: number;
  malformed: LemonSqueezyReference[];
  unmapped: LemonSqueezyReference[];
} {
  const refs = Object.keys(TIER_VARIANT_ENV) as LemonSqueezyReference[];
  const unmapped = refs.filter((r) => !process.env[TIER_VARIANT_ENV[r]]?.trim());
  const malformed = refs.filter((r) => {
    const raw = process.env[TIER_VARIANT_ENV[r]]?.trim();
    if (!raw) return false; // это уже unmapped, второй раз не считаем
    return !/^[0-9]+$/.test(raw) || Number.parseInt(raw, 10) <= 0;
  });
  return { total: refs.length, varsSet: refs.length - unmapped.length, malformed, unmapped };
}

function isReference(s: string): s is LemonSqueezyReference {
  // hasOwnProperty.call, а не `in`: `in` идёт по цепочке прототипов, и
  // isReference("constructor") возвращал true.
  //
  // ПРОВЕРЕНО 28.07.2026: прямо сейчас это НЕ дефект — дальше идёт
  // process.env[TIER_VARIANT_ENV[ref]], а TIER_VARIANT_ENV["constructor"] — это
  // функция, поэтому поиск в env даёт undefined и результат null, тот же, что у
  // неизвестной ссылки. Замерено: constructor/__proto__/toString/hasOwnProperty
  // → null, настоящая ссылка → свой id.
  //
  // Защита стоит здесь не от сегодняшнего поведения, а от завтрашнего: она
  // держится ТОЛЬКО на том, что значения словаря — имена переменных окружения.
  // Начни он хранить сами идентификаторы вариантов — и ключ прототипа поехал бы
  // дальше по платёжному пути как настоящая ссылка.
  return Object.prototype.hasOwnProperty.call(TIER_VARIANT_ENV, s);
}

/**
 * Resolve the LS variant id for a checkout reference ("tier_lite_monthly").
 * Returns null if the reference is unknown or its variant env isn't set yet —
 * the provider then falls back to LEMON_SQUEEZY_DEFAULT_VARIANT_ID.
 */
export function resolveLemonSqueezyVariant(reference: string): string | null {
  if (!isReference(reference)) return null;
  const id = process.env[TIER_VARIANT_ENV[reference]]?.trim();
  return id || null;
}

/** True when at least one tier variant id is configured (LS checkout is live). */
export function lemonSqueezyTiersConfigured(): boolean {
  return Object.values(TIER_VARIANT_ENV).some((k) => Boolean(process.env[k]?.trim()));
}

/**
 * Название товара на витрине магазина → ссылка в коде.
 *
 * ЗАЧЕМ. Витрина `aevion.lemonsqueezy.com` перечисляет живые товары, а код
 * знает ссылки — но связать одно с другим было нечем: 13.08.2026 я сопоставлял
 * семнадцать товаров вручную, глазами. Пока такой таблицы нет, вопрос «этот
 * товар вообще кто-нибудь выдаёт?» решается только покупкой.
 *
 * Сопоставляем по НАЗВАНИЮ, а не по идентификатору варианта: идентификаторы
 * живут в переменных Railway, и держать их копию в коде значило бы завести
 * второго писателя для одного числа. Названия мы задаём сами, и они устойчивы.
 *
 * Товар, которого здесь нет, — не ошибка сам по себе, но и выдать его нечем:
 * сверка скажет об этом до того, как его кто-то купит.
 */
export const STOREFRONT_NAME_TO_REFERENCE: Record<string, LemonSqueezyReference> = {
  "AEVION Lite — Monthly": "tier_lite_monthly",
  "AEVION Lite — Annual": "tier_lite_annual",
  "AEVION Medium — Monthly": "tier_medium_monthly",
  "AEVION Medium — Annual": "tier_medium_annual",
  "AEVION Full — Monthly": "tier_full_monthly",
  "AEVION Full — Annual": "tier_full_annual",
  "AEVION Planet — Monthly": "tier_planet_monthly",
  "AEVION Planet — Annual": "tier_planet_annual",
  "AEVION DevHub Studio Pro": "app_devhub",
  "AEVION Smeta Trainer": "app_smeta",
  "AEVION QVenture": "app_qventure",
  "AEVION QPayNet": "app_qpaynet",
  "AEVION QContract": "app_qcontract",
  "AEVION IP Bureau": "app_ip_bureau",
  "AEVION CyberChess Pro": "app_cyberchess",
  "AEVION QRenew": "app_qrenew",
  "AEVION Constitution Lab": "app_constitution",
};

/**
 * Какие товары РЕАЛЬНО можно выдать: у каких ссылок задан вариант в окружении.
 *
 * Зачем наружу. Соответствие «товар → модуль» держится на переменных Railway.
 * Снаружи не видно, какие из них заданы, поэтому вопрос «что случится, если это
 * купят» до сих пор не имел ответа иначе как покупкой. Отдаём ТОЛЬКО признаки,
 * сами идентификаторы остаются в процессе.
 *
 * Отсюда же считается сверка с витриной магазина: товар в продаже, у которого
 * здесь `false`, — это будущий отказ на живом покупателе.
 */
export function lemonSqueezyVariantStatus(): Record<LemonSqueezyReference, boolean> {
  const out = {} as Record<LemonSqueezyReference, boolean>;
  for (const ref of Object.keys(TIER_VARIANT_ENV) as LemonSqueezyReference[]) {
    out[ref] = Boolean(process.env[TIER_VARIANT_ENV[ref]]?.trim());
  }
  return out;
}

/**
 * Reverse lookup: a numeric LS variant_id from a webhook payload → the
 * checkout reference it belongs to. Returns null for an unrecognised id.
 */
export function referenceForVariantId(
  variantId: string | number | null | undefined,
): LemonSqueezyReference | null {
  if (variantId == null) return null;
  const id = String(variantId);
  for (const ref of Object.keys(TIER_VARIANT_ENV) as LemonSqueezyReference[]) {
    if (process.env[TIER_VARIANT_ENV[ref]]?.trim() === id) return ref;
  }
  return null;
}

/** A checkout reference → tier id. Defaults to "lite" (safest paid entry). */
export function tierForLemonSqueezyReference(ref: LemonSqueezyReference | null): TierId {
  if (!ref) return "lite";
  if (ref.includes("medium")) return "medium";
  if (ref.includes("full")) return "full";
  if (ref.includes("planet")) return "full";
  return "lite";
}

/** True when the reference is for an individual app (not a platform tier). */
export function isAppReference(ref: LemonSqueezyReference | null): boolean {
  return ref?.startsWith("app_") ?? false;
}

/** Extract the app slug from an app reference ("app_qventure" → "qventure"). */
export function appSlugForReference(ref: LemonSqueezyReference | null): string | null {
  if (!ref?.startsWith("app_")) return null;
  return ref.slice(4);
}

/**
 * Slug купленной подписки (то, что вебхук пишет в `AppSubscription`) → id модуля
 * в реестре и в политике пейволла. Совпадают не все: `ip_bureau` против
 * `aevion-ip-bureau`, `smeta` против `smeta-trainer`.
 *
 * Держим ОДНОЙ таблицей рядом со ссылками на товары. Второй такой список
 * (в гейте, в отчёте, в UI) через месяц разошёлся бы с этим — и разошёлся бы
 * молча, потому что расхождение видно только на пересечении.
 */
const APP_SLUG_TO_MODULE_ID: Record<string, string> = {
  ip_bureau: "aevion-ip-bureau",
  smeta: "smeta-trainer",
  // Найдено 13.08.2026 сверкой с реестром модулей: в `MODULES_PRICING` он
  // называется `qpaynet-embedded`. Без этой строки гейт не нашёл бы покупку и
  // развернул бы заплатившего за QPayNet — ровно тот же класс дефекта, ради
  // которого таблица и заведена. Охраняется тестом appSlugModuleIds.
  qpaynet: "qpaynet-embedded",
};

/**
 * Модули со СВОИМ механизмом доступа, мимо `MODULES_PRICING` и общего гейта.
 * Их отсутствие в реестре — не ошибка сопоставления.
 */
const OWN_GATE_SLUGS = new Set(["devhub"]);

/** Продаётся ли модуль поштучно и не имеет ли он собственного гейта. */
export function appSlugHasOwnGate(slug: string): boolean {
  return OWN_GATE_SLUGS.has(slug);
}

/** Все slug'и, которые продаются отдельной подпиской. */
export function allAppSlugs(): string[] {
  return (Object.keys(TIER_VARIANT_ENV) as LemonSqueezyReference[])
    .filter((r) => r.startsWith("app_"))
    .map((r) => r.slice(4));
}

/** "ip_bureau" → "aevion-ip-bureau"; для совпадающих имён вернёт как есть. */
export function moduleIdForAppSlug(slug: string): string {
  return APP_SLUG_TO_MODULE_ID[slug] ?? slug;
}

/** Обратное: id модуля → slug подписки, если такой модуль вообще продаётся. */
export function appSlugForModuleId(moduleId: string): string | null {
  for (const [slug, id] of Object.entries(APP_SLUG_TO_MODULE_ID)) {
    if (id === moduleId) return slug;
  }
  return isReference(`app_${moduleId}`) ? moduleId : null;
}

/**
 * Что реально можно купить прямо сейчас.
 *
 * ЗАЧЕМ. `/api/pricing/checkout/healthz` отвечал `lemonsqueezy.configured:
 * true`, глядя только на ключ API и магазин. Но начать покупку нельзя без
 * ВАРИАНТА товара, а варианты задаются отдельными переменными. То есть
 * «настроен» и «покупку можно начать» — разные вопросы под одним словом,
 * и второй снаружи был не виден вовсе.
 *
 * Замечено 29.08.2026 накануне запуска модуля: проверка готовности
 * говорила «цена $19», а можно ли эту цену заплатить — не отвечал никто.
 *
 * Возвращаем ИМЕНА переменных, не значения: имя не секрет, значение —
 * идентификатор товара в чужой панели, ему в ответе не место.
 */
export function lemonSqueezySellable(): {
  configured: string[];
  missing: string[];
} {
  const configured: string[] = [];
  const missing: string[] = [];
  for (const [ref, env] of Object.entries(TIER_VARIANT_ENV)) {
    (process.env[env]?.trim() ? configured : missing).push(ref);
  }
  return { configured: configured.sort(), missing: missing.sort() };
}
