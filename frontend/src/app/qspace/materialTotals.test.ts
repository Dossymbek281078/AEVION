import { describe, expect, it } from "vitest";
import { materialShopping } from "./materialTotals";
import { estimateCsv, type Estimate, type RoomCsvLine } from "./estimate";

const строки: RoomCsvLine[] = [
  { index: 1, area: 20, flooring: 21, wallArea: 40, paint: 8, skirting: 18 },
  { index: 2, area: 12, flooring: 12.6, wallArea: 30, paint: 6, skirting: 14 },
  { index: 3, area: 4, flooring: 4.2, wallArea: 20, paint: 4, skirting: 8 },
];

describe("список к покупке по материалам", () => {
  it("одинаковый материал в двух комнатах складывается в одну строку с обеими комнатами", () => {
    const r = materialShopping(строки, { 3: "porcelain-grey" }, { 3: "tile-wall-white" }, "laminate-light", "paint-warm-white");
    const пол = r.filter((x) => x.surface === "floor");
    expect(пол.map((x) => [x.name, +x.area.toFixed(1), x.rooms])).toEqual([
      ["Ламинат светлый", 33.6, [1, 2]],
      ["Керамогранит серый 60×60", 4.2, [3]],
    ]);
    const стены = r.filter((x) => x.surface === "wall");
    expect(стены.map((x) => [x.name, x.area, x.rooms])).toEqual([
      ["Краска: тёплый белый", 70, [1, 2]],
      ["Плитка стеновая 20×30", 20, [3]],
    ]);
  });

  it("сумма площадей по материалам равна сумме по комнатам — ничего не потеряно и не удвоено", () => {
    const r = materialShopping(строки, { 1: "parquet-oak", 2: "laminate-grey" }, {}, "tile-white", "paint-sage");
    const пол = r.filter((x) => x.surface === "floor").reduce((s, x) => s + x.area, 0);
    const стены = r.filter((x) => x.surface === "wall").reduce((s, x) => s + x.area, 0);
    expect(пол).toBeCloseTo(21 + 12.6 + 4.2, 6);
    expect(стены).toBeCloseTo(90, 6);
  });

  it("полы идут раньше стен, внутри — по убыванию площади", () => {
    const r = materialShopping(строки, { 1: "parquet-oak" }, { 1: "paint-grey" }, "laminate-light", "paint-warm-white");
    expect(r.map((x) => x.surface)).toEqual(["floor", "floor", "wall", "wall"]);
    expect(r[0].area).toBeGreaterThan(r[1].area);
  });

  it("неизвестный id материала не роняет расчёт — строка с самим id", () => {
    const r = materialShopping(строки.slice(0, 1), { 1: "нет-такого" }, {}, "laminate-light", "paint-warm-white");
    expect(r[0].name).toBe("нет-такого");
  });

  it("CSV: блок «Материалы к покупке» с названием, площадью и комнатами", () => {
    const est = {
      floorArea: 36, floorAreaSource: "rooms", wallArea: 90, wallAreaSource: "rooms", paintLitres: 18,
      flooringArea: 37.8, outlets: 10, switches: 5, cableMeters: 100, pipeMeters: 20, drainMeters: 8, ceilingLights: 4,
    } as Estimate;
    const csv = estimateCsv(est, "тест", строки, materialShopping(строки, { 3: "porcelain-grey" }, {}, "laminate-light", "paint-warm-white"));
    expect(csv).toContain('"Материалы к покупке');
    // название в кавычках: в нём бывают «;» и кавычки, а это разделители CSV
    expect(csv).toContain('Пол;"Ламинат светлый";33,6;м²;1, 2');
    expect(csv).toContain('Пол;"Керамогранит серый 60×60";4,2;м²;3');
    expect(csv).toContain('Стены;"Краска: тёплый белый";90,0;м²;1, 2, 3');
  });
});
