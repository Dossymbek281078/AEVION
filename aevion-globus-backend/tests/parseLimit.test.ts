import { describe, test, expect } from "vitest";
import { parseLimit } from "../src/routes/pricing";

/**
 * `?limit=` в админских списках (лиды, промо, партнёры).
 *
 * Повод: старое выражение `Math.min(Math.max(parseInt(String(raw ?? "100"), 10), 1), 500)`
 * читается как «есть фолбэк 100 и пол 1», но `Math.max(NaN, 1)` — это `NaN`,
 * и `.slice(0, NaN)` даёт ПУСТОЙ массив. `?limit=abc` показывал пустой список
 * вместо ста записей. Класс «не падает, а тихо врёт».
 */
describe("parseLimit", () => {
  test("мусор откатывается на фолбэк, а не в NaN", () => {
    for (const raw of ["abc", "", " ", undefined, null, 42, ["3", "7"], {}, true, "NaN", "Infinity"]) {
      const got = parseLimit(raw);
      expect(Number.isFinite(got), `limit=${JSON.stringify(raw)} дал ${got}`).toBe(true);
      expect(got).toBe(100);
    }
  });

  test("нормальные значения проходят и зажимаются в границы", () => {
    // Без этой половины проверка выше совместима с «функция всегда возвращает 100».
    expect(parseLimit("7")).toBe(7);
    expect(parseLimit("500")).toBe(500);
    expect(parseLimit("100000")).toBe(500); // потолок
    expect(parseLimit("0")).toBe(1);        // пол
    expect(parseLimit("-5")).toBe(1);
    expect(parseLimit("7.9")).toBe(7);      // дробь не течёт в slice
  });

  test("срез с результатом никогда не пустой на непустом входе", () => {
    // Настоящее последствие бага: именно .slice(0, limit) отдавал [].
    const rows = [1, 2, 3, 4, 5];
    for (const raw of ["abc", "", "7", "1"]) {
      expect(rows.slice(0, parseLimit(raw)).length, `limit=${raw}`).toBeGreaterThan(0);
    }
  });
});
