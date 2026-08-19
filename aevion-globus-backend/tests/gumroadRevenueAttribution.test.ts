import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Каждый товар Gumroad должен попадать в выручку СВОЕГО модуля.
 *
 * 14.08.2026 каталог сверен с живым кабинетом Gumroad: товаров ровно девять.
 * Восемь были в таблице привязки бэкенда, а девятый — «Протокол долголетия
 * AEVION — 12 недель» ($19) — нет. Его продажи уходили бы в запасной вариант
 * "platform", хотя витрина с самого начала объявляет ему appId "qrenew".
 *
 * Опасность здесь не в падении, а в тихой неправде: выручка модуля выглядела бы
 * меньше настоящей, платформа — больше, и по дашборду нельзя было бы понять,
 * что продаётся. Ровно то, на чём принимаются решения о цене и рекламе.
 *
 * Сторож сравнивает ДВА независимых источника: витрину (frontend/src/lib/
 * products.ts — то, что видит покупатель) и таблицу бэкенда. Расхождение в
 * любую сторону — ошибка, потому что оба списка описывают один и тот же
 * магазин.
 */

const FRONTEND_PRODUCTS = join(__dirname, "..", "..", "frontend", "src", "lib", "products.ts");
const REVENUE_ROUTE = join(__dirname, "..", "src", "routes", "revenue.ts");

/** Пары {id, appId} из витрины — только товары Gumroad. */
function storefrontGumroadProducts(): Array<{ id: string; appId: string }> {
  const src = readFileSync(FRONTEND_PRODUCTS, "utf8");
  const out: Array<{ id: string; appId: string }> = [];

  // Записи товаров идут блоками `{ ... }`; берём те, где processor — gumroad.
  for (const block of src.split(/\n\s*\{\s*\n/).slice(1)) {
    const body = block.split(/\n\s*\},?\s*\n/)[0] ?? "";
    if (!/processor:\s*"gumroad"/.test(body)) continue;
    const id = /(?:^|\n)\s*id:\s*"([^"]+)"/.exec(body)?.[1];
    const appId = /(?:^|\n)\s*appId:\s*"([^"]+)"/.exec(body)?.[1];
    if (id && appId) out.push({ id, appId });
  }
  return out;
}

/** Таблица бэкенда GUMROAD_PERMALINK_APP. */
function backendAttribution(): Record<string, string> {
  const src = readFileSync(REVENUE_ROUTE, "utf8");
  const table = /GUMROAD_PERMALINK_APP:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\};/.exec(src)?.[1];
  expect(table, "таблица GUMROAD_PERMALINK_APP не найдена — сторож ослеп").toBeTruthy();

  const map: Record<string, string> = {};
  for (const m of (table as string).matchAll(/(?:^|\n)\s*([a-z0-9]+):\s*"([^"]+)"/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

describe("привязка выручки Gumroad", () => {
  test("контроль: оба источника вообще читаются и не пусты", () => {
    // Без этого пустой разбор дал бы зелёный на любом расхождении.
    expect(existsSync(FRONTEND_PRODUCTS)).toBe(true);
    expect(storefrontGumroadProducts().length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(backendAttribution()).length).toBeGreaterThanOrEqual(5);
  });

  test("у каждого товара витрины есть привязка в бэкенде", () => {
    const backend = backendAttribution();
    const missing = storefrontGumroadProducts()
      .filter((p) => !backend[p.id])
      .map((p) => `${p.id} (${p.appId})`);

    expect(missing, `товары без привязки — их продажи уйдут в "platform": ${missing.join(", ")}`).toEqual([]);
  });

  test("модуль в витрине и в бэкенде совпадает", () => {
    const backend = backendAttribution();
    const mismatched = storefrontGumroadProducts()
      .filter((p) => backend[p.id] && backend[p.id] !== p.appId)
      .map((p) => `${p.id}: витрина ${p.appId} ≠ бэкенд ${backend[p.id]}`);

    expect(mismatched, mismatched.join("; ")).toEqual([]);
  });
});
