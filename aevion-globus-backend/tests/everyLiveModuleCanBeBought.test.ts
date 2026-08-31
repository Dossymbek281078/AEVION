import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { projects } from "../src/data/projects";
import { MODULES_PRICING } from "../src/data/pricing";

/**
 * У каждого живого модуля есть способ заплатить — или явная причина, почему нет.
 *
 * Замер 19.08.2026, из-за которого сторож и появился: в реестре 41 модуль,
 * подпиской берутся 32, разово 16, а **10 нельзя оплатить никак**. Из них два
 * внутренние, остальные восемь выглядят как продукт: человек доходит до
 * страницы, читает описание и не находит цены. Уходит молча.
 *
 * Это не падает и не попадает в Sentry. Модуль отвечает 200, страница
 * отрисована, всё «работает» — просто денег нет.
 *
 * Почему сторож, а не разовая уборка: модули добавляют по одному, и каждый
 * новый рождается без цены. Без проверки список молча растёт, и заметить это
 * можно только пересчитав вручную — я так и заметил, случайно, через месяц.
 */

/** Осознанно не продаётся. Причина обязательна — иначе список станет свалкой. */
const NOT_FOR_SALE: Record<string, string> = {
  "revenue-hub": "внутренняя панель выручки, наружу не показывается",
  globus: "3D-карта платформы — навигация, а не товар",
  ventures: "витрина «внутри AEVION строят бизнесы»; продавать доступ к списку идей нечем",
};/**
 * Ждёт решения основателя о цене. Цена — его зона (правило 6), поэтому сторож
 * их пропускает, но НЕ забывает: ниже отдельная проверка на протухание.
 *
 * Формат тот же, что у priceLadderCoherence и sameEntitlementSamePrice —
 * money-map.mjs читает эти блоки и показывает их в блоке «И» ежедневной карты.
 * Строка исчезнет оттуда сама, как только цена появится.
 */
const AWAITING_FOUNDER: Record<string, string> = {
  qmaskcard: "карты-маски: 14 активных масок в проде, смоук 14/14. Аналог Privacy.com $10–25. Предложено $19/мес",
  qchaingov: "управление DAO: три режима голосования с кворумом, смоук 15/15. Предложено $29/мес",
  veilnetx: "инструмент проверки утечек; /health сам говорит phase live-tool, eta Q4 2026, 9 в списке ожидания. Предложено $9/мес — или дождаться Q4",
  qskyway: "аэрокоридоры над тремя городами на реальных зданиях OSM; статус mvp. Ведёт отдельная вкладка — цену назначать вместе с ней",

  // 🔴 Эти четыре я СНАЧАЛА записал в NOT_FOR_SALE как «концепт-доски, продавать
  // нечего» — по слову «concept board» в описании. Проверил прод и оказался
  // неправ: у mapreality 22 живых сигнала, у voice-of-earth 27 треков, shadownet
  // и ztide отвечают с postgres. Слово в описании относилось к ДОПОЛНИТЕЛЬНОЙ
  // доске, а не к модулю целиком — тот же ложный сигнал дал 11 «проданных
  // концептов», из которых ни один концептом не оказался.
  //
  // Поэтому здесь, а не там: отказ от денег — такое же решение, как цена, и
  // принимать его по слову в тексте нельзя.
  mapreality: "карта потребностей: 22 сигнала в проде, база отвечает. Цена не назначена",
  "voice-of-earth": "музыкальный проект: 27 треков в проде, база отвечает. Цена не назначена",
  shadownet: "приватная сеть: отвечает с postgres; сам себя называет симулятором моделей угроз — сперва решить, что именно продаём",
  "z-tide": "координация вкладов: отвечает; в описании упомянуто хранение в памяти — проверить, переживают ли данные перезапуск",
};const SHOP = join(__dirname, "..", "..", "frontend", "src", "lib", "products.ts");

/**
 * Каталог магазина читаем ТЕКСТОМ: фронт и бэк — раздельные TS-проекты, общего
 * импорта между ними нет (см. шапку products.ts). Для сторожа этого достаточно:
 * нам нужен факт «модуль там упомянут», а не его типы.
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
const PRICED = new Set(
  MODULES_PRICING.filter((m) => typeof m.addonMonthly === "number" && (m.addonMonthly as number) > 0).map((m) => m.id),
);
/**
 * Видимость модуля на /pricing даёт НАЛИЧИЕ ЗАПИСИ, а не цена надстройки.
 * Первая редакция проверки ниже мерила видимость через PRICED (цена > 0) и
 * из-за этого требовала цену там, где цену ставить нельзя: у DevHub оплата
 * надстройки прошла бы, а доступ не выдался (см. devhubAddonOnlyWhenEntitled).
 * Мерило было неверным, требование — верным.
 */
const IN_CATALOG = new Set(MODULES_PRICING.map((m) => m.id));
const SELLABLE = projects.filter((p) => p.status === "live" || p.status === "mvp");

function canBeBought(id: string): boolean {
  return PRICED.has(id) || SHOP_IDS.has(id);
}

/**
 * Подписочные модули магазина. Разбор БЕЗ регулярок намеренно: в
 * одноразовых шаблонах на этой машине экранирование теряется на границе
 * вызова, и шаблон молча перестаёт совпадать (см. правила, §2е).
 */
function monthlyShopModules(): string[] {
  if (!existsSync(SHOP)) return [];
  const src = readFileSync(SHOP, "utf8");
  const out: string[] = [];
  const parts = src.split('    id: "');
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf('"');
    if (end <= 0) continue;
    const id = parts[i].slice(0, end);
    const body = parts[i].slice(0, 600);
    if (!body.includes('kind: "module"')) continue;
    if (!body.includes('billing: "monthly"')) continue;
    // Модуль засчитывается и по appId: в магазине сокращённое имя
    // (smeta, qpaynet), а в каталоге цен полное (smeta-trainer,
    // qpaynet-embedded). Первая редакция этой проверки смотрела только
    // id и назвала оба расхождением — ложно, они на месте. Настоящей из
    // трёх находок была одна.
    const aidAt = parts[i].indexOf('appId: "');
    let alias = '';
    if (aidAt >= 0 && aidAt < 600) {
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
    expect(PRICED.size, "каталог подписок пуст").toBeGreaterThan(10);
    expect(SHOP_IDS.size, "каталог магазина не прочитан — путь до products.ts сломан").toBeGreaterThan(5);
  });

  test("контроль: проверка умеет отвечать «да» и «нет»", () => {
    // Иначе canBeBought мог бы всегда возвращать true и всё пропускать.
    const yes = [...PRICED][0];
    expect(canBeBought(yes), `${yes} есть в каталоге цен, но проверка его не видит`).toBe(true);
    expect(canBeBought("net-takogo-modulya-xyz"), "выдуманный модуль признан оплачиваемым").toBe(false);
  });

  test("у каждого живого модуля есть цена, причина или решение в работе", () => {
    const orphans = SELLABLE.filter(
      (p) => !canBeBought(p.id) && !NOT_FOR_SALE[p.id] && !AWAITING_FOUNDER[p.id],
    ).map((p) => `${p.id} (${p.status})`);

    expect(
      orphans,
      "человек дойдёт до страницы модуля и не найдёт цены — уйдёт молча, " +
        "и мы об этом не узнаем. Либо назначьте цену, либо впишите в NOT_FOR_SALE с причиной",
    ).toEqual([]);
  });

  test("причина «не продаётся» обязана быть содержательной", () => {
    const empty = Object.entries(NOT_FOR_SALE).filter(([, why]) => why.trim().length < 15);
    expect(empty.map(([id]) => id), "причина в одно слово — это не причина").toEqual([]);
  });

  test("список ожидающих решения не протух", () => {
    const stale: string[] = [];
    for (const id of Object.keys(AWAITING_FOUNDER)) {
      if (canBeBought(id)) stale.push(`${id}: цена появилась — уберите из AWAITING_FOUNDER`);
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
   * canBeBought() выше считает два каталога ВЗАИМОЗАМЕНЯЕМЫМИ: модуль
   * засчитывается, если он есть в ценах ИЛИ в магазине. Для вопроса «можно
   * ли вообще заплатить» это верно, и именно поэтому расхождение между
   * каталогами было невидимо: страница /pricing строится ТОЛЬКО из
   * MODULES_PRICING, а /apps — только из products.ts.
   *
   * Замер 31.08.2026: DevHub Studio Pro продавался на /apps за $149/мес
   * (касса отвечала 302 при 404 у выдуманного товара) и отсутствовал в
   * каталоге цен — то есть самого дорогого модуля платформы не было на
   * странице с названием «цены». Прежние проверки этого не видели и не
   * могли: SELLABLE берётся из реестра проектов, а DevHub в реестре нет.
   */
  test("контроль: разбор магазина находит подписки и умеет промахнуться", () => {
    const monthly = monthlyShopModules();
    // Пустой разбор дал бы «расхождений нет» на любом состоянии каталогов.
    expect(monthly.length, "разбор магазина не нашёл ни одной подписки — путь или формат изменились").toBeGreaterThan(3);
    expect(monthly, "разбор не видит DevHub, хотя он в магазине есть").toContain("devhub");
    expect(monthly, "разбор признал модулем то, чего в магазине нет").not.toContain("net-takogo-modulya-xyz");
  });

  test("модуль-подписка из магазина есть и в каталоге цен", () => {
    const missing = monthlyShopModules().filter((id) => !IN_CATALOG.has(id));
    expect(
      missing,
      "модуль продаётся на /apps как подписка, но на /pricing его нет вовсе: " +
        "покупатель, сравнивающий цены, его не найдёт. Добавьте запись в MODULES_PRICING.",
    ).toEqual([]);
  });
});
