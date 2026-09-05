import { describe, it, expect } from "vitest";
import { dayOffsetHash } from "../src/routes/cyberchessDaily";

/**
 * Задача дня — единственное, ради чего человек возвращается на второй день
 * (ворота §3.5 запуска). Выбор был спрятан внутри модуля и не закреплён
 * ничем: сломайся он — задача перестала бы меняться, и никто бы не узнал,
 * потому что ручка продолжала бы отвечать 200 с валидной задачей.
 *
 * Закрепляю СВОЙСТВА, а не числа: конкретное смещение зависит от размера
 * банка, а он растёт.
 */

const БАНК = 10_818; // столько задач в public/puzzles.json на 01.09.2026
const дни = (n: number, старт = "2026-09-01") => {
  const d = new Date(старт + "T00:00:00Z");
  const out: string[] = [];
  for (let i = 0; i < n; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};

describe("задача дня", () => {
  it("для одного дня всегда одна и та же", () => {
    for (const d of дни(10)) {
      expect(dayOffsetHash(d, БАНК)).toBe(dayOffsetHash(d, БАНК));
    }
  });

  it("два дня подряд не дают одну задачу — иначе возвращаться незачем", () => {
    const о = дни(365).map((d) => dayOffsetHash(d, БАНК));
    const подряд = о.filter((v, i) => i > 0 && v === о[i - 1]).length;
    expect(подряд).toBe(0);
  });

  it("за год задачи почти не повторяются", () => {
    const о = дни(365).map((d) => dayOffsetHash(d, БАНК));
    // допускаю единичные совпадения — это дни рождения на 10 818 корзин,
    // но не «половина года одна и та же задача»
    expect(new Set(о).size).toBeGreaterThan(350);
  });

  it("выбор расходится по всему банку, а не жмётся к началу", () => {
    const о = дни(365).map((d) => dayOffsetHash(d, БАНК));
    const низ = о.filter((v) => v < БАНК / 10).length;
    const верх = о.filter((v) => v >= (БАНК * 9) / 10).length;
    // ожидание ~36 в каждой десятой; проверяю порядок величины, не точность
    expect(низ).toBeGreaterThan(10);
    expect(верх).toBeGreaterThan(10);
  });

  it("смещение всегда внутри банка, даже на вырожденных входах", () => {
    for (const [день, банк] of [["2026-09-01", 1], ["", 5], ["2026-09-01", 0]] as const) {
      const o = dayOffsetHash(день, банк);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(Math.max(1, банк));
    }
  });
});
