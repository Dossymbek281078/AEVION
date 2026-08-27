import { describe, test, expect } from "vitest";

import { __engineForTests } from "../src/routes/qskyway";
import type { CityData } from "../src/routes/qskyway.city";

/**
 * Страховочный запас за неуверенность бывает СЪЕДЕН полом коридора.
 *
 * Замер 27.08.2026 по живому твину Астаны: из 237 зданий с угаданной высотой
 * 199 сидят на слепом дефолте 12 м, и для них 12 + 15 запаса + 16 штрафа = 43,
 * что меньше пола в 50 м. Ступеней вверх ноль — коридор ложится ровно туда же,
 * куда лёг бы без всякого штрафа. Снаружи это неотличимо от работающей защиты:
 * /health перечисляет confidence-clearance, а byHeightSourceM показывает 16
 * метров, которые в эти участки не идут.
 *
 * Поле `blindHeight` — единственное место, где это видно. Здесь проверяются обе
 * стороны, потому что односторонний сторож не отличить от сломанного:
 *
 *  1) он СЧИТАЕТ участок, где высота угадана низко и штраф не сработал;
 *  2) он МОЛЧИТ, когда угаданное здание достаточно высокое, чтобы штраф
 *     действительно поднял коридор.
 */

function twin(height: number, hs: number): CityData {
  const cols = 12, rows = 1, cell = 20;
  const heights = new Array(cols * rows).fill(0);
  const src = new Array(cols * rows).fill(0);
  heights[6] = height;
  src[6] = hs;
  const buildings: CityData["buildings"] = [
    { h: height, hs, r: [[121, 1], [139, 1], [139, 19], [121, 19]] },
  ];
  return {
    city: "тестовый твин",
    bbox: { minLat: 51.1, maxLat: 51.11, minLon: 71.4, maxLon: 71.41 },
    meters: { w: cols * cell, h: rows * cell },
    grid: { cols, rows, cell, heights, src },
    buildings,
    vertiports: [{ c: 0, r: 0, x: 10, y: 10 }, { c: 11, r: 0, x: 230, y: 10 }],
    dataQuality: {
      total: 1, measured: 0, derived: 0, guessed: 1, measuredPct: 0, realPct: 0,
      source: "test", note: "test",
    },
  };
}

describe("слепая высота: видно, когда страховочный запас ничего не дал", () => {
  test("угаданные 12 м — штраф съеден полом, участок посчитан", () => {
    const route = __engineForTests.buildRoute("astana", twin(12, 2), 0, 1, false);
    expect(route).not.toBeNull();
    const b = route!.blindHeight;

    expect(b.guessedSegments).toBeGreaterThan(0);
    // Ровно тот случай, ради которого поле заведено.
    expect(b.inertPenaltySegments).toBeGreaterThan(0);

    // Высота коридора над этим зданием — пол, а не пол плюс штраф.
    const overBuilding = Math.min(...route!.alts);
    expect(overBuilding).toBe(50);

    // Заявленный просвет держится только до (пол − запас).
    expect(b.clearedUpToM).toBe(35);
    expect(b.note).toContain("35");
  });

  test("угаданные 59 м — штраф реально поднимает коридор, участок НЕ считается", () => {
    const route = __engineForTests.buildRoute("astana", twin(59, 2), 0, 1, false);
    expect(route).not.toBeNull();
    const b = route!.blindHeight;

    expect(b.guessedSegments).toBeGreaterThan(0);
    expect(b.inertPenaltySegments).toBe(0);

    // 59 + 15 + 16 = 90 против 59 + 15 = 74: штраф добавляет ступень.
    expect(route!.cruiseAltM).toBeGreaterThan(75);
  });

  test("обмеренная высота в счётчик угаданных не попадает", () => {
    const route = __engineForTests.buildRoute("astana", twin(12, 0), 0, 1, false);
    expect(route).not.toBeNull();
    expect(route!.blindHeight.guessedSegments).toBe(0);
    expect(route!.blindHeight.inertPenaltySegments).toBe(0);
    expect(route!.blindHeight.note).toContain("настоящий страховочный запас");
  });
});
