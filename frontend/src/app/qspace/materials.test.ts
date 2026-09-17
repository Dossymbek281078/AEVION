import { describe, expect, it } from "vitest";
import { MATERIALS, materialById, materialsFor, variantsOf, composeMaterialId, parseMaterialId } from "./materials";

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

describe("подписи материалов не расходятся с рисунком", () => {
  // Подписи вида «доска 1.2 м» и «полоса 10 см» повторяют unitM числом.
  // Сегодня совпадают, но это копия: поменяют unitM — подпись соврёт, не
  // уронив ни одного теста. Тот же класс, что сегодня дал ярлыки сметы,
  // нормы вентиляции и подпись шага тёплого пола.
  const длинаИзПодписи = (note: string): number | null => {
    const м = /(\d+(?:[.,]\d+)?)\s*м(?![²³а-яё])/.exec(note);
    if (м) return Number(м[1].replace(",", "."));
    const см = /(\d+(?:[.,]\d+)?)\s*см/.exec(note);
    if (см) return Number(см[1].replace(",", ".")) / 100;
    return null;
  };

  it("если подпись называет размер, он равен unitM", () => {
    let проверено = 0;
    for (const m of MATERIALS) {
      const L = длинаИзПодписи(m.note);
      if (L === null) continue;
      проверено++;
      expect(L, `«${m.name}»: подпись «${m.note}» против unitM ${m.unitM}`)
        .toBeCloseTo(m.unitM, 2);
    }
    // знаменатель: без него цикл по подписям без чисел проходит молча
    expect(проверено, "ни одной подписи с размером не проверено — тест пуст")
      .toBeGreaterThan(1);
  });

  it("контроль прибора: разбор подписи НАХОДИТ число и не путает единицы", () => {
    expect(длинаИзПодписи("доска 1.2 м, вразбежку")).toBeCloseTo(1.2, 3);
    expect(длинаИзПодписи("полоса 10 см")).toBeCloseTo(0.1, 3);
    expect(длинаИзПодписи("матовая")).toBeNull();
    // «3 мм» и «м²» не должны читаться как метры
    expect(длинаИзПодписи("шов 3 мм условный")).toBeNull();
  });
});

describe("цвет и укладка плитки/доски — составной id", () => {
  it("плитка даёт 7 цветов и 4 укладки, доска — 4 цвета и 3, краска — ничего", () => {
    expect(variantsOf(materialById("tile-white")!).colorways.length).toBe(7);
    expect(variantsOf(materialById("tile-white")!).layouts).toEqual(["straight", "offset", "diagonal", "herringbone"]);
    expect(variantsOf(materialById("parquet-oak")!).layouts).toEqual(["straight", "diagonal", "herringbone"]);
    expect(variantsOf(materialById("paint-sage")!)).toEqual({ colorways: [], layouts: [] });
  });
  it("составной id разбирается обратно, имя несёт цвет и укладку, палитра — цвета выбора", () => {
    const id = composeMaterialId("tile-white", "beige", "diagonal");
    expect(id).toBe("tile-white|c=beige|l=diagonal");
    expect(parseMaterialId(id)).toEqual({ base: "tile-white", colorway: "beige", layout: "diagonal" });
    const m = materialById(id)!;
    expect(m.name).toBe("Плитка белая 60×60 · бежевый · по диагонали");
    expect(m.colors[0]).toBe("#dccdb8");
    expect(m.layout).toBe("diagonal");
    expect(m.unitM).toBe(0.6);
    // прямая укладка в id не пишется — это умолчание
    expect(composeMaterialId("tile-white", undefined, "straight")).toBe("tile-white");
  });
  it("чужой цвет или укладка не являются позицией каталога", () => {
    expect(materialById("tile-white|c=purple")).toBeUndefined();
    expect(materialById("paint-sage|l=diagonal")).toBeUndefined();
    expect(materialById("tile-white|c=grey")?.id).toBe("tile-white|c=grey");
  });
});
