import { describe, test, expect } from "vitest";
import { allAppSlugs, moduleIdForAppSlug, appSlugForModuleId, appSlugHasOwnGate } from "../src/data/lemonSqueezyVariants";
import { MODULES_PRICING } from "../src/data/pricing";

/**
 * Каждый модуль, который продаётся отдельной подпиской, обязан находиться в
 * реестре модулей — иначе гейт не свяжет покупку с доступом и развернёт
 * заплатившего.
 *
 * Найдено 13.08.2026 на СВОЕЙ ЖЕ правке того же дня: покупка называется
 * `qpaynet`, а модуль в реестре — `qpaynet-embedded`. Сопоставления не было, и
 * подписчик QPayNet упёрся бы в отказ, хотя платит каждый месяц. Проверка
 * таблицы «на глаз» этого не показывала: девять строк, восемь совпадают.
 *
 * Дефект живёт на ПЕРЕСЕЧЕНИИ двух исправных списков — там, куда по отдельности
 * никто не смотрит. Поэтому и проверяем пересечение, а не каждый список.
 */

const MODULE_IDS = new Set(MODULES_PRICING.map((m) => m.id));

describe("продаваемые модули существуют в реестре", () => {
  test("у каждой покупки есть модуль — либо свой механизм доступа", () => {
    const broken: string[] = [];

    for (const slug of allAppSlugs()) {
      if (appSlugHasOwnGate(slug)) continue;
      const id = moduleIdForAppSlug(slug);
      if (!MODULE_IDS.has(id)) broken.push(`${slug} → ${id} (в реестре нет)`);
    }

    expect(broken).toEqual([]);
  });

  test("обратный поиск возвращает ту же покупку", () => {
    for (const slug of allAppSlugs()) {
      if (appSlugHasOwnGate(slug)) continue;
      const id = moduleIdForAppSlug(slug);
      expect(appSlugForModuleId(id), `${id} должен вести обратно к ${slug}`).toBe(slug);
    }
  });

  test("контроль: проверка ловит выдуманный модуль", () => {
    // Иначе первый случай прошёл бы на пустом множестве и ничего не доказывал.
    expect(MODULE_IDS.has("qpaynet-embedded")).toBe(true);
    expect(MODULE_IDS.has("этого-модуля-нет")).toBe(false);
    expect(allAppSlugs().length).toBeGreaterThanOrEqual(8);
  });

  test("модуль со своим механизмом в реестре может отсутствовать — это не ошибка", () => {
    expect(appSlugHasOwnGate("devhub")).toBe(true);
    expect(appSlugHasOwnGate("qventure")).toBe(false);
  });
});
