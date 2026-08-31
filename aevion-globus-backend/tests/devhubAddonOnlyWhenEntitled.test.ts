import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULES_PRICING } from "../src/data/pricing";

/**
 * DevHub продаётся как надстройка тарифа ТОЛЬКО если он признаёт подписку.
 *
 * Замер 31.08.2026. Модуль стоит $149/мес на /apps и определяет тариф
 * человека ТОЛЬКО по таблице «почта → тариф» (getUserTierChecked в
 * routes/devhub.ts): подписку платформы он не читает вовсе. При этом
 * калькулятор на /pricing берёт в надстройки любой модуль с положительной
 * addonMonthly, а касса считает его через buildQuote.
 *
 * Сложить два факта — получится оплата, после которой доступа нет. Это не
 * гипотеза о будущем: ровно эту кнопку я и завёл сам, добавляя DevHub в
 * каталог цен, и убрал в том же заходе.
 *
 * Сторож закрепляет СВЯЗЬ, а не одно из состояний: цену можно вернуть в тот
 * день, когда DevHub начнёт спрашивать isModuleEntitled(). Проверка не
 * наказывает за прогресс — она краснеет только если половины разойдутся.
 */
const DEVHUB_ROUTE = join(__dirname, "..", "src", "routes", "devhub.ts");
const SRC = readFileSync(DEVHUB_ROUTE, "utf8");
const entry = MODULES_PRICING.find((m) => m.id === "devhub");
const honoursPlan = SRC.includes("isModuleEntitled");

describe("DevHub: надстройка только там, где выдача работает", () => {
  test("контроль: запись и исходник прочитаны", () => {
    // Без этого «расхождений нет» означало бы «я ничего не нашёл».
    expect(entry, "DevHub пропал из каталога цен — проверка обнулилась").toBeTruthy();
    expect(SRC.length, "исходник маршрута не прочитан — путь изменился").toBeGreaterThan(5000);
    expect(SRC, "читается не тот файл").toContain("getUserTierChecked");
  });

  test("цена надстройки есть только при признании подписки", () => {
    const sellable = typeof entry?.addonMonthly === "number" && entry.addonMonthly > 0;
    if (!sellable) return;
    expect(
      honoursPlan,
      "у DevHub есть цена надстройки на /pricing, но модуль не спрашивает " +
        "isModuleEntitled(): человек оплатит подписку с этой надстройкой и " +
        "останется на Free. Либо уберите цену, либо научите модуль читать план.",
    ).toBe(true);
  });

  test("если модуль научился читать план — вернуть цену", () => {
    if (!honoursPlan) return;
    expect(
      typeof entry?.addonMonthly === "number" && (entry.addonMonthly as number) > 0,
      "DevHub теперь признаёт подписку платформы, но на /pricing у него нет " +
        "цены надстройки — покупатель не может выбрать его в калькуляторе. " +
        "Цена на /apps: $149/мес.",
    ).toBe(true);
  });
});
