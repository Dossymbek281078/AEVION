import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * У модуля, который продаётся, на его собственной странице есть путь к оплате.
 *
 * Замер 30.08.2026. Ссылки на модули мы раздаём — в соцсетях, в письмах, в
 * карточках. Пришедший по прямой ссылке видит страницу модуля, а не витрину. Если
 * там нет ни цены, ни кнопки, он не узнаёт, что продукт платный, и уходит.
 *
 * Это тише всего, что ловится: противоречие человек видит и спрашивает, молчание
 * не видит по определению.
 *
 * ⚠️ ИСТОРИЯ ПРИБОРА, потому что она полезнее самой проверки.
 *
 * Путь к оплате искали двумя способами, и оба соврали. Обход по разметке искал
 * `<BuyLink`; браузерная проба соседнего окна искала кнопку со словом «Купить».
 * У DevHub кнопка называется «Upgrade — $149/mo» и сделана обычной ссылкой —
 * оба прибора её пропустили, и находка «DevHub не продаётся со своей страницы»
 * прожила несколько часов, попав в отчёт основателю, пока не была отозвана.
 *
 * Оба вопроса были заданы ИМЕНЕМ, а не смыслом. Поэтому здесь список признаков,
 * и он про способность: плашка цены, кнопка апгрейда, ссылка в кассу, вызов
 * ручки чекаута, платная стена. Любой из них означает, что путь к оплате есть.
 *
 * Признак `ModulePricingChip` добавлен последним и закрыл главную слепоту:
 * четыре модуля продают именно им, а он живёт в общих компонентах, вне
 * поддерева модуля.
 *
 * ⚠️ ГРАНИЦА, названная честно. Проверка статическая: она видит, что путь
 * ЕСТЬ В КОДЕ, но не видит, отрисуется ли он живому посетителю. У шахмат
 * плашка обёрнута в пять условий, и браузерная проба показала, что цены на
 * экране нет вовсе. Такое ловится только браузером — здесь оно записано в
 * список известных, а не притворяется проверенным.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const SRC = resolve(APP, "..");

/** Известные случаи. Список обязан только сокращаться. */
const KNOWN_SILENT = [
  // $29 в каталоге, на странице ни плашки, ни кнопки, ни стены.
  // Подтверждено живым замером соседнего окна 30.08.
  "bureau",
  // Плашка есть, но за пятью условиями (идёт партия, задача, режим стримера,
  // онбординг). В обычном состоянии цены на экране нет — измерено браузером.
  // Статически этот случай выглядит здоровым, поэтому он ЗДЕСЬ, а не в
  // результате проверки: иначе сторож молчал бы о нём вечно.
  "cyberchess",
];

const SIGNALS: Array<[string, (s: string) => boolean]> = [
  ["плашка цены", (s) => s.includes("ModulePricingChip")],
  ["кнопка апгрейда", (s) => s.includes("UpgradeButton")],
  ["BuyLink", (s) => s.includes("<BuyLink")],
  ["ссылка в кассу", (s) => s.includes("lemonsqueezy.com") || s.includes("gumroad.com")],
  ["ручка чекаута", (s) => s.includes("/api/pricing/checkout") || s.includes("checkout/session")],
  ["платная стена", (s) => s.includes("PaywallScreen") || s.includes("PaywallModal")],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__") continue;
    const p = join(dir, entry);
    try {
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
    } catch {
      /* каталог исчез между обходом и чтением — не наш случай */
    }
  }
  return out;
}

/** Продаваемые модули каталога: есть цена и это модуль, а не книга. */
function soldModules(): Array<{ id: string; dir: string }> {
  const cat = readFileSync(join(SRC, "lib", "products.ts"), "utf8");
  const anchors = [...cat.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => ({
    id: m[1],
    at: m.index ?? 0,
  }));
  const dirs = readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const out: Array<{ id: string; dir: string }> = [];
  for (let i = 0; i < anchors.length; i += 1) {
    const end = i + 1 < anchors.length ? anchors[i + 1].at : cat.length;
    const win = cat.slice(anchors[i].at, end);
    if (!/priceUsd:\s*\d+/.test(win)) continue;
    const kind = /kind:\s*"([a-z]+)"/.exec(win);
    if (kind && kind[1] !== "module") continue;
    const app = /appId:\s*"([a-z0-9-]+)"/.exec(win);
    const dir = [app?.[1], anchors[i].id].find((d) => d && dirs.includes(d));
    if (dir) out.push({ id: anchors[i].id, dir });
  }
  return out;
}

function signalsFor(dir: string): string[] {
  const found = new Set<string>();
  for (const f of walk(join(APP, dir))) {
    const s = readFileSync(f, "utf8");
    for (const [name, test] of SIGNALS) if (test(s)) found.add(name);
  }
  return [...found];
}

describe("продаваемый модуль предлагает оплату на своей странице", () => {
  const sold = soldModules();
  const silent = sold.filter((m) => signalsFor(m.dir).length === 0).map((m) => m.id);

  test("контроль: продаваемые модули найдены", () => {
    // Пустой список сделал бы всё ниже зелёным при любом состоянии сайта.
    expect(sold.length, `найдено: ${sold.map((m) => m.id).join(", ")}`).toBeGreaterThanOrEqual(5);
  });

  test("контроль: способ различает страницу с оплатой и без", () => {
    // Витрина обязана определяться как продающая — иначе список признаков слеп,
    // и «все продают» будет означать «я ничего не умею видеть».
    const shop = readFileSync(join(APP, "shop", "page.tsx"), "utf8");
    expect(
      SIGNALS.some(([, t]) => t(shop)),
      "витрина не опознана как продающая — список признаков слеп",
    ).toBe(true);
    // И наоборот: страница заведомо не продающая не должна давать признаков.
    const legal = join(APP, "terms", "page.tsx");
    if (existsSync(legal)) {
      expect(
        SIGNALS.some(([, t]) => t(readFileSync(legal, "utf8"))),
        "условия использования опознаны как продающая страница — признак слишком широк",
      ).toBe(false);
    }
  });

  test("новых молчащих модулей нет", () => {
    const fresh = silent.filter((id) => !KNOWN_SILENT.includes(id));
    expect(
      fresh,
      `модуль продаётся, а со своей страницы купить нельзя: ${fresh.join(", ")}`,
    ).toEqual([]);
  });

  test("храповик не протух: bureau всё ещё без пути к оплате", () => {
    // cyberchess в списке по ДРУГОЙ причине — его путь есть в коде, но не
    // виден на экране. Статически он выглядит здоровым, поэтому проверять
    // «всё ещё молчит» для него здесь нельзя: это работа браузера.
    expect(
      silent,
      "bureau уже предлагает оплату — убрать из списка известных",
    ).toContain("bureau");
  });
});
