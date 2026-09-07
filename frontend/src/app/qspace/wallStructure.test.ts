import { describe, expect, it } from "vitest";
import {
  CEILING_STRETCH,
  FLOOR_WET,
  STRUCTURES,
  WALL_BLOCK,
  WALL_FRAME,
  finishedHeightM,
  heightLostMm,
  totalMm,
} from "./wallStructure";

describe("состав конструкций", () => {
  it("у каждого слоя есть роль — число без объяснения нечем проверить", () => {
    for (const s of STRUCTURES) {
      expect(s.layers.length, `${s.id}: пустой пирог`).toBeGreaterThanOrEqual(2);
      for (const l of s.layers) {
        expect(l.name.length, `${s.id}: слой без имени`).toBeGreaterThan(1);
        expect(l.note.length, `${s.id}/${l.name}: слой без объяснения`).toBeGreaterThan(5);
        expect(l.thicknessMm, `${s.id}/${l.name}: отрицательная толщина`).toBeGreaterThanOrEqual(0);
        expect(l.thicknessMm, `${s.id}/${l.name}: толщина ${l.thicknessMm} мм неправдоподобна`).toBeLessThanOrEqual(300);
      }
    }
  });

  it("идентификаторы уникальны", () => {
    const ids = STRUCTURES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("толщина пирога — сумма слоёв, а не отдельно записанное число", () => {
    // пересчёт независимо от реализации
    for (const s of STRUCTURES) {
      let sum = 0;
      for (const l of s.layers) sum += l.thicknessMm;
      expect(totalMm(s)).toBe(sum);
    }
    expect(totalMm(FLOOR_WET)).toBe(80);      // 0 + 5 + 60 + 3 + 12
    expect(totalMm(WALL_BLOCK)).toBe(123);    // 10 + 100 + 10 + 3
    expect(totalMm(CEILING_STRETCH)).toBe(61); // 0 + 60 + 1
  });

  it("каркасная перегородка тоньше блочной — иначе её незачем выбирать", () => {
    expect(totalMm(WALL_FRAME)).toBeLessThan(totalMm(WALL_BLOCK));
  });

  it("пол и потолок съедают высоту, и это главное, ради чего считается", () => {
    expect(heightLostMm(FLOOR_WET, CEILING_STRETCH)).toBe(141);
    // 2.70 «в бетоне» превращается в 2.559 после ремонта
    expect(finishedHeightM(2.7, FLOOR_WET, CEILING_STRETCH)).toBeCloseTo(2.559, 6);
  });

  it("итоговая высота выводится из пирога: тоньше стяжка — выше потолок", () => {
    const thin = {
      ...FLOOR_WET,
      layers: FLOOR_WET.layers.map((l) =>
        l.name === "Стяжка" ? { ...l, thicknessMm: 40 } : l,
      ),
    };
    const before = finishedHeightM(2.7, FLOOR_WET, CEILING_STRETCH);
    const after = finishedHeightM(2.7, thin, CEILING_STRETCH);
    // ровно 20 мм разницы, а не «стало больше»
    expect(after - before).toBeCloseTo(0.02, 9);
  });
});
