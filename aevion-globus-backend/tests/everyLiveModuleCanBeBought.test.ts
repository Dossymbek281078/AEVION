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

  // Помечены live, но по описанию это концепт-доски и демонстрации. Брать за
  // них деньги значило бы обещать больше, чем продукт делает, — а это ровно
  // тот дефект, который мы ловим на витрине. Появится настоящая функция —
  // строка уходит отсюда и модуль просит цену сам.
  "voice-of-earth": "музыкальный проект: 8 посевных треков и доска концепта, платить пока не за что",
  mapreality: "MVP карты потребностей с доской концепта — сигналы есть, продукта вокруг них нет",
  shadownet: "сам себя называет симулятором моделей угроз; продавать «приватную сеть» нельзя",
  "z-tide": "координация с доской концепта и хранением В ПАМЯТИ — данные не переживают перезапуск",
};
/**
 * Ждёт решения основателя о цене. Цена — его зона (правило 6), поэтому сторож
 * их пропускает, но НЕ забывает: ниже отдельная проверка на протухание.
 *
 * Формат тот же, что у priceLadderCoherence и sameEntitlementSamePrice —
 * money-map.mjs читает эти блоки и показывает их в блоке «И» ежедневной карты.
 * Строка исчезнет оттуда сама, как только цена появится.
 */
const AWAITING_FOUNDER: Record<string, string> = {
  qmaskcard: "карты-маски: 14 активных масок в проде, смоук 14/14. Аналог Privacy.com $10–25. Предложено $19/мес",
  qchaingov: "управление DAO: три режима голосования с кворумом, смоук 15/15. Платит организация. Предложено $29/мес",
  veilnetx: "проверка утечек приватности — рабочий инструмент, аналоги-VPN $5–12. Предложено $9/мес",
  qskyway: "аэрокоридоры над тремя городами на реальных зданиях OSM; статус mvp. Ведёт отдельная вкладка — цену назначать вместе с ней",
};
const SHOP = join(__dirname, "..", "..", "frontend", "src", "lib", "products.ts");

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
const SELLABLE = projects.filter((p) => p.status === "live" || p.status === "mvp");

function canBeBought(id: string): boolean {
  return PRICED.has(id) || SHOP_IDS.has(id);
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
});
