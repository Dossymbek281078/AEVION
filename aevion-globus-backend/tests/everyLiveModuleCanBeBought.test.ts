import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { projects } from "../src/data/projects";
import { MODULES_PRICING, TERM_TIERS, STANDALONE_APPS } from "../src/data/pricing";
import { TERM_REFERENCES } from "../src/data/lemonSqueezyVariants";

/**
 * У каждого живого модуля есть способ заплатить — или явная причина, почему нет.
 *
 * Замер 19.08.2026, из-за которого сторож и появился: в реестре 41 модуль, и
 * **10 нельзя было оплатить никак**. Человек доходит до страницы, читает описание
 * и не находит цены. Уходит молча. Это не падает и не попадает в Sentry.
 *
 * С 15.09.2026 (слово основателя) способ заплатить за модуль — подписка на срок:
 * любой платный срок (lite … max) открывает всю планету. Значит «оплачиваемый»
 * модуль — тот, что входит в платный срок, у которого есть касса (`tier_<ступень>`),
 * либо отдельное приложение магазина. Отдельно продаются только пять приложений
 * (STANDALONE_APPS), и это сторож тоже держит.
 *
 * Почему сторож, а не разовая уборка: модули добавляют по одному, и каждый новый
 * рождается без записи в прайсе. Без проверки список молча растёт.
 */

/** Осознанно не продаётся. Причина обязательна — иначе список станет свалкой. */
const NOT_FOR_SALE: Record<string, string> = {
  "revenue-hub": "внутренняя панель выручки, наружу не показывается",
  globus: "3D-карта платформы — навигация, а не товар",
  ventures: "витрина «внутри AEVION строят бизнесы»; продавать доступ к списку идей нечем",
};

/**
 * Ждёт решения основателя. Цена и состав подписки — его зона (правило 6), поэтому
 * сторож их пропускает, но НЕ забывает: ниже отдельная проверка на протухание.
 *
 * Формат тот же, что у priceLadderCoherence и sameEntitlementSamePrice —
 * money-map.mjs читает эти блоки. Строка исчезнет, как только решение принято.
 *
 * 15.09.2026: qmaskcard, qchaingov, veilnetx, mapreality, voice-of-earth,
 * shadownet и z-tide ушли отсюда — решение принято политикой: они входят в каждый
 * срок подписки (проверка «не протух» потребовала их убрать).
 */
const AWAITING_FOUNDER: Record<string, string> = {
  qspace: "3D-модельер помещений, MVP 07.09.2026: в прайсе (MODULES_PRICING) нет записи, значит в подписку не включён. Решить: включить в срок подписки или оставить бесплатным просмотром",
  qreal: "AI-видео: рендер стоит реальных денег ($0.13-0.30/с), поэтому в подписку не включён — только Enterprise по запросу. Решить: цена или квота рендера в подписке",
};

const SHOP = join(__dirname, "..", "..", "frontend", "src", "lib", "products.ts");

/**
 * Каталог магазина читаем ТЕКСТОМ: фронт и бэк — раздельные TS-проекты, общего
 * импорта между ними нет. Для сторожа этого достаточно: нам нужен факт «модуль
 * там упомянут», а не его типы.
 */
function shopIds(): Set<string> {
  if (!existsSync(SHOP)) return new Set();
  const src = readFileSync(SHOP, "utf8");
  const ids = new Set<string>();
  for (const m of src.matchAll(/\bappId:\s*["']([a-z0-9-]+)["']/g)) ids.add(m[1]);
  for (const m of src.matchAll(/^\s{4}id:\s*["']([a-z0-9-]+)["']/gm)) ids.add(m[1]);
  return ids;
}

const SHOP_IDS = shopIds();
const ССЫЛКИ = new Set<string>(TERM_REFERENCES);
/** Платные сроки, у которых есть касса. */
const СРОКИ_С_КАССОЙ = TERM_TIERS.filter((t) => ССЫЛКИ.has(`tier_${t}`));
/** Модули, которые можно получить, купив срок подписки. */
const BY_SUBSCRIPTION = new Set(
  MODULES_PRICING.filter((m) => m.includedIn.some((t) => (СРОКИ_С_КАССОЙ as readonly string[]).includes(t))).map((m) => m.id),
);
/**
 * Видимость модуля на /pricing даёт НАЛИЧИЕ ЗАПИСИ в прайсе.
 */
const IN_CATALOG = new Set(MODULES_PRICING.map((m) => m.id));
const SELLABLE = projects.filter((p) => p.status === "live" || p.status === "mvp");

function canBeBought(id: string): boolean {
  return BY_SUBSCRIPTION.has(id) || SHOP_IDS.has(id);
}

/**
 * Приложения магазина, которые продаются на срок. Разбор БЕЗ регулярок
 * намеренно: в одноразовых шаблонах на этой машине экранирование теряется на
 * границе вызова, и шаблон молча перестаёт совпадать (см. правила, §2е).
 */
function termShopModules(): string[] {
  if (!existsSync(SHOP)) return [];
  const src = readFileSync(SHOP, "utf8");
  const out: string[] = [];
  const parts = src.split('    id: "');
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf('"');
    if (end <= 0) continue;
    const id = parts[i].slice(0, end);
    // Границей берём КОНЕЦ ОБЪЕКТА, а не окно в N символов: у bureau перед
    // ценой лежит двадцатистрочный комментарий, и окно в 900 знаков обрезало
    // запись до появления `kind` — приложение молча выпадало из разбора, а
    // сверка «магазин = политика» краснела на исправном каталоге.
    const body = parts[i].split("\n  },")[0];
    if (!body.includes('kind: "module"')) continue;
    if (!body.includes('billing: "term"') && !body.includes('billing: "monthly"')) continue;
    // Модуль засчитывается и по appId: в магазине сокращённое имя (bureau,
    // multichat), а в каталоге цен полное (aevion-ip-bureau, multichat-engine).
    const aidAt = body.indexOf('appId: "');
    let alias = '';
    if (aidAt >= 0) {
      const rest = parts[i].slice(aidAt + 8);
      alias = rest.slice(0, rest.indexOf('"'));
    }
    out.push(alias && IN_CATALOG.has(alias) ? alias : id);
  }
  return out;
}

describe("живой модуль можно оплатить или сказано, почему нет", () => {
  test("контроль: все три источника прочитаны и не пусты", () => {
    // Пустой источник обнулил бы проверку и оставил её зелёной навсегда.
    expect(SELLABLE.length, "реестр модулей пуст").toBeGreaterThan(20);
    expect(СРОКИ_С_КАССОЙ.length, "ни у одного срока подписки нет кассы").toBe(TERM_TIERS.length);
    expect(BY_SUBSCRIPTION.size, "подпиской не открывается ни один модуль").toBeGreaterThan(10);
    expect(SHOP_IDS.size, "каталог магазина не прочитан — путь до products.ts сломан").toBeGreaterThan(5);
  });

  test("контроль: проверка умеет отвечать «да» и «нет»", () => {
    // Иначе canBeBought мог бы всегда возвращать true и всё пропускать.
    const yes = [...BY_SUBSCRIPTION][0];
    expect(canBeBought(yes), `${yes} входит в подписку, но проверка его не видит`).toBe(true);
    expect(canBeBought("net-takogo-modulya-xyz"), "выдуманный модуль признан оплачиваемым").toBe(false);
    // Модуль только для Enterprise (без кассы) подпиской не покупается.
    const толькоПоЗапросу = MODULES_PRICING.find((m) => m.includedIn.length === 1 && m.includedIn[0] === "enterprise");
    if (толькоПоЗапросу) expect(BY_SUBSCRIPTION.has(толькоПоЗапросу.id)).toBe(false);
  });

  test("у каждого живого модуля есть способ оплаты, причина или решение в работе", () => {
    const orphans = SELLABLE.filter(
      (p) => !canBeBought(p.id) && !NOT_FOR_SALE[p.id] && !AWAITING_FOUNDER[p.id],
    ).map((p) => `${p.id} (${p.status})`);

    expect(
      orphans,
      "человек дойдёт до страницы модуля и не найдёт, как заплатить — уйдёт молча, " +
        "и мы об этом не узнаем. Включите модуль в срок подписки либо впишите в NOT_FOR_SALE с причиной",
    ).toEqual([]);
  });

  test("причина «не продаётся» обязана быть содержательной", () => {
    const empty = Object.entries(NOT_FOR_SALE).filter(([, why]) => why.trim().length < 15);
    expect(empty.map(([id]) => id), "причина в одно слово — это не причина").toEqual([]);
  });

  test("список ожидающих решения не протух", () => {
    const stale: string[] = [];
    for (const id of Object.keys(AWAITING_FOUNDER)) {
      if (canBeBought(id)) stale.push(`${id}: способ оплаты появился — уберите из AWAITING_FOUNDER`);
      if (NOT_FOR_SALE[id]) stale.push(`${id}: он же в NOT_FOR_SALE — решите, где ему место`);
    }
    // Иначе список станет вечным «мы про это знаем» и перестанет что-либо значить.
    expect(stale).toEqual([]);
  });

  test("ожидающие решения существуют в реестре", () => {
    const known = new Set(projects.map((p) => p.id));
    const ghosts = [...Object.keys(AWAITING_FOUNDER), ...Object.keys(NOT_FOR_SALE)].filter((id) => !known.has(id));
    expect(ghosts, "строка про модуль, которого нет в реестре — опечатка или он переименован").toEqual([]);
  });

  /**
   * НЕДОСТАЮЩЕЕ НАПРАВЛЕНИЕ СВЕРКИ (добавлено 31.08.2026).
   *
   * Страница /pricing строится ТОЛЬКО из MODULES_PRICING, а /apps — только из
   * products.ts. Замер 31.08.2026: DevHub продавался на /apps и отсутствовал в
   * каталоге цен — самого дорогого модуля не было на странице «цены».
   */
  test("контроль: разбор магазина находит приложения на срок и умеет промахнуться", () => {
    const shop = termShopModules();
    // Пустой разбор дал бы «расхождений нет» на любом состоянии каталогов.
    expect(shop.length, "разбор магазина не нашёл ни одного приложения — путь или формат изменились").toBeGreaterThan(3);
    expect(shop, "разбор не видит DevHub, хотя он в магазине есть").toContain("devhub");
    expect(shop, "разбор признал модулем то, чего в магазине нет").not.toContain("net-takogo-modulya-xyz");
  });

  test("приложение магазина есть и в каталоге цен", () => {
    const missing = termShopModules().filter((id) => !IN_CATALOG.has(id));
    expect(
      missing,
      "модуль продаётся на /apps, но на /pricing его нет вовсе: " +
        "покупатель, сравнивающий цены, его не найдёт. Добавьте запись в MODULES_PRICING.",
    ).toEqual([]);
  });

  test("отдельно в магазине продаются ровно пять приложений политики (STANDALONE_APPS)", () => {
    // 15.09.2026: каждое лишнее отдельное приложение снижает причину брать планету
    // целиком. Появилось шестое — это решение основателя, а не правка каталога.
    const магазин = [...new Set(termShopModules())].sort();
    const политика = STANDALONE_APPS.map((a) => a.moduleId).sort();
    expect(магазин, "магазин продаёт отдельно не то, что разрешает политика").toEqual(политика);
  });
});
