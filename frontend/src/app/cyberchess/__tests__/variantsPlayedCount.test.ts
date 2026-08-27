/**
 * Сторож: «попробовал вариант» — это сыгранная партия, а не наличие ключа.
 *
 * 27.08.2026 на живом сайте новичок получал достижение «Экспериментатор ·
 * Попробуй 5 вариантов шахмат · +50 Chessy» в первую секунду, ещё ничего не
 * открыв. Причина не в щедрости и не в условии достижения — оно верное.
 * Считался неверный вход: `Object.keys(variantStats)`, а заготовка
 * `makeEmptyStats()` заводит запись КАЖДОМУ варианту сразу, с нулями. Ключей
 * дюжина, партий ноль.
 *
 * Награда без действия обесценивает остальные восемь достижений, а
 * повторяющееся уведомление на первом экране читается как поломка.
 */
import { describe, it, expect } from "vitest";
import { ldVariantStats, recordVariantResult, variantsPlayedCount } from "../variants";
import type { VariantStats } from "../variants";

describe("счёт испробованных вариантов", () => {
  it("чистая заготовка — ноль испробованных, хотя ключей много", () => {
    // Именно этот случай и был дефектом: у новичка ключей дюжина.
    const пусто = ldVariantStats();
    expect(
      Object.keys(пусто).length,
      "контроль: заготовка должна содержать записи всех вариантов",
    ).toBeGreaterThan(5);
    expect(variantsPlayedCount(пусто), "ключи заготовки посчитаны как партии").toBe(0);
  });

  it("сыгранная партия считается — по любому исходу", () => {
    let s = ldVariantStats();
    s = recordVariantResult(s, "atomic", "w");
    expect(variantsPlayedCount(s)).toBe(1);
    s = recordVariantResult(s, "kingofthehill", "l");
    expect(variantsPlayedCount(s)).toBe(2);
    s = recordVariantResult(s, "fischer960", "d");
    expect(variantsPlayedCount(s)).toBe(3);
  });

  it("несколько партий одного варианта — это всё ещё один вариант", () => {
    let s = ldVariantStats();
    s = recordVariantResult(s, "atomic", "w");
    s = recordVariantResult(s, "atomic", "l");
    s = recordVariantResult(s, "atomic", "d");
    expect(variantsPlayedCount(s)).toBe(1);
  });

  it("обычные шахматы вариантом не считаются", () => {
    let s = ldVariantStats();
    s = recordVariantResult(s, "standard", "w");
    expect(variantsPlayedCount(s)).toBe(0);
  });

  it("порог достижения не достигается без пяти РАЗНЫХ вариантов", () => {
    let s = ldVariantStats();
    for (const v of ["atomic", "kingofthehill", "fischer960", "threecheck"] as const) {
      s = recordVariantResult(s, v, "w");
    }
    expect(variantsPlayedCount(s), "четырёх хватило для награды за пять").toBeLessThan(5);
    s = recordVariantResult(s, "knightriders", "w");
    expect(variantsPlayedCount(s)).toBe(5);
  });

  it("пустое и битое состояние не роняет счёт", () => {
    expect(variantsPlayedCount(null)).toBe(0);
    expect(variantsPlayedCount(undefined)).toBe(0);
    expect(variantsPlayedCount({} as VariantStats)).toBe(0);
  });
});
