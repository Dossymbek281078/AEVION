import { describe, expect, it } from "vitest";
import type { Room } from "./rooms";
import { heatingPlan, stepHint } from "./heating";

const room = (index: number, area: number, perimeter: number): Room =>
  ({ index, area, perimeter, cx: 0, cy: 0 });

describe("тёплый пол", () => {
  it("длина трубы выводится из площади и шага, а не задана числом", () => {
    const r20 = heatingPlan([room(1, 20, 18)], 0.15).rooms[0];
    // греемая площадь = 20 − периметр×0.1 = 20 − 1.8 = 18.2
    expect(r20.heatedArea).toBeCloseTo(18.2, 9);
    // труба = 18.2 / 0.15 × 1.1
    expect(r20.pipeLength).toBeCloseTo((18.2 / 0.15) * 1.1, 6);
  });

  it("шаг вдвое мельче — трубы вдвое больше", () => {
    const wide = heatingPlan([room(1, 20, 18)], 0.2).rooms[0];
    const tight = heatingPlan([room(1, 20, 18)], 0.1).rooms[0];
    expect(tight.pipeLength / wide.pipeLength).toBeCloseTo(2, 6);
  });

  it("под встроенной мебелью трубу не кладут — площадь уменьшается", () => {
    const без = heatingPlan([room(1, 20, 18)], 0.15).rooms[0];
    const с = heatingPlan([room(1, 20, 18)], 0.15, { 1: 5 }).rooms[0];
    expect(без.heatedArea - с.heatedArea).toBeCloseTo(5, 9);
    expect(с.pipeLength).toBeLessThan(без.pipeLength);
  });

  it("длинная труба делится на контуры, и об этом сказано словами", () => {
    // 40 м² при шаге 15 см — это около 290 м трубы, в один контур не влезет
    const r = heatingPlan([room(1, 40, 26)], 0.15);
    expect(r.rooms[0].loops).toBeGreaterThanOrEqual(3);
    expect(r.warnings.join(" ")).toMatch(/не влезает в один контур/);
    expect(r.warnings.join(" ")).toContain("коллектор");
  });

  it("маленькая комната в один контур влезает и предупреждений не даёт", () => {
    const r = heatingPlan([room(1, 10, 13)], 0.15);
    expect(r.rooms[0].loops).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it("мощность считается от ГРЕЕМОЙ площади, а не от всей комнаты", () => {
    const r = heatingPlan([room(1, 20, 18)], 0.15).rooms[0];
    expect(r.power).toBeCloseTo(18.2 * 100, 6);
    expect(r.power).toBeLessThan(20 * 100);
  });

  it("крошечная комната отсеивается с объяснением, а не даёт нулевую строку", () => {
    // 1.2 м² при периметре 5 м: отступы (0.5 м²) оставляют 0.7 м².
    // Раньше тут стояло 1.5 м² — оставалось РОВНО 1.0, а порог «меньше 1»,
    // и проверка падала на моих же данных, не на коде.
    const r = heatingPlan([room(1, 1.2, 5)], 0.15);
    expect(r.rooms).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/меньше 1 м²/);
  });

  it("нелепый шаг отвергается объяснением, а не молча считается", () => {
    for (const bad of [0, 0.05, 0.5, -1]) {
      const r = heatingPlan([room(1, 20, 18)], bad);
      expect(r.rooms, `шаг ${bad} не должен считаться`).toEqual([]);
      expect(r.warnings[0]).toContain("вне разумного");
    }
  });

  it("итоги — сумма строк", () => {
    const r = heatingPlan([room(1, 20, 18), room(2, 12, 14)], 0.15);
    expect(r.totals.pipeLength).toBeCloseTo(r.rooms[0].pipeLength + r.rooms[1].pipeLength, 6);
    expect(r.totals.power).toBeCloseTo(r.rooms[0].power + r.rooms[1].power, 6);
  });

  it("подпись шага объясняет выбор, а не повторяет число", () => {
    expect(stepHint(0.1)).toContain("санузел");
    expect(stepHint(0.15)).toContain("жилая комната");
    expect(stepHint(0.25)).toContain("прохладнее");
  });
});
