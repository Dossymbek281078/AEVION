import { describe, expect, it } from "vitest";
import { MATERIALS, materialById, materialsFor } from "./materials";

describe("каталог материалов", () => {
  it("идентификаторы уникальны — иначе выбор материала молча возьмёт не тот", () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("у каждого материала есть палитра и осмысленный размер элемента", () => {
    for (const m of MATERIALS) {
      expect(m.colors.length, `${m.id}: пустая палитра`).toBeGreaterThanOrEqual(1);
      for (const c of m.colors) {
        expect(c, `${m.id}: цвет «${c}» не HEX`).toMatch(/^#[0-9a-f]{6}$/i);
      }
      // 1 см .. 3 м — вне этого масштаб рисунка заведомо неверен
      expect(m.unitM, `${m.id}: unitM=${m.unitM}`).toBeGreaterThanOrEqual(0.01);
      expect(m.unitM).toBeLessThanOrEqual(3);
    }
  });

  it("рисунок stripes и planks требует минимум двух цветов", () => {
    for (const m of MATERIALS) {
      if (m.pattern === "stripes" || m.pattern === "planks") {
        expect(m.colors.length, `${m.id}: одноцветный рисунок = сплошная заливка`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("выборка по поверхности не пуста и не смешивает пол со стенами", () => {
    const floors = materialsFor("floor");
    const walls = materialsFor("wall");
    expect(floors.length).toBeGreaterThanOrEqual(4);
    expect(walls.length).toBeGreaterThanOrEqual(4);
    expect(floors.every((m) => m.surface === "floor")).toBe(true);
    expect(walls.every((m) => m.surface === "wall")).toBe(true);
    expect(floors.length + walls.length).toBe(MATERIALS.length);
  });

  it("поиск по id находит существующий и НЕ находит выдуманный", () => {
    expect(materialById("parquet-oak")?.name).toBe("Паркет дуб");
    // контроль прибора: без него «находит всё» неотличимо от «работает»
    expect(materialById("net-takogo-materiala-zzz")).toBeUndefined();
  });

  it("цены в каталоге НЕТ — объёмы считаем, деньги назначает основатель", () => {
    for (const m of MATERIALS) {
      const keys = Object.keys(m);
      expect(keys.some((k) => /price|цена|cost|usd|kzt/i.test(k)), `${m.id}: появилось поле цены`).toBe(false);
    }
  });
});
