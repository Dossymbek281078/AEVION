import { describe, expect, it } from "vitest";
import type { Plan } from "./planModel";
import { checkClearance, type Placed } from "./clearance";

/** Комната 6×4 м с дверью на южной стене. */
function room(): Plan {
  return {
    name: "комната",
    walls: [
      { x1: 0, y1: 0, x2: 6, y2: 0, thickness: 0.3, height: 2.7 },
      { x1: 6, y1: 0, x2: 6, y2: 4, thickness: 0.3, height: 2.7 },
      { x1: 6, y1: 4, x2: 0, y2: 4, thickness: 0.3, height: 2.7 },
      { x1: 0, y1: 4, x2: 0, y2: 0, thickness: 0.3, height: 2.7 },
    ],
    openings: [
      { wall: 0, offset: 2.5, width: 0.9, height: 2.05, sill: 0, kind: "door" },
    ],
    source: "demo",
  };
}

const item = (uid: number, name: string, x: number, y: number, size: [number, number, number], rotY = 0): Placed =>
  ({ uid, name, x, y, rotY, size });

describe("проверка расстановки", () => {
  it("свободно стоящая мебель замечаний не даёт", () => {
    const items = [
      item(1, "Кровать", 1.2, 2.5, [1.6, 2.0, 0.9]),
      item(2, "Шкаф", 5.2, 2.5, [1.8, 0.6, 2.3], Math.PI / 2),
    ];
    expect(checkClearance(room(), items)).toEqual([]);
  });

  it("два предмета друг в друге — находка с обоими именами", () => {
    const items = [
      item(1, "Кровать", 3, 2.5, [1.6, 2.0, 0.9]),
      item(2, "Шкаф", 3.3, 2.6, [1.8, 0.6, 2.3]),
    ];
    const r = checkClearance(room(), items);
    const overlap = r.filter((x) => x.kind === "overlap");
    expect(overlap.length).toBe(1);
    expect(overlap[0].uids.sort()).toEqual([1, 2]);
    expect(overlap[0].text).toContain("Кровать");
    expect(overlap[0].text).toContain("Шкаф");
  });

  it("рядом, но не касаясь — НЕ находка (иначе замечания станут шумом)", () => {
    const items = [
      item(1, "Кровать", 1.0, 2.5, [1.6, 2.0, 0.9]),
      item(2, "Тумбочка", 2.1, 2.5, [0.45, 0.4, 0.5]),
    ];
    expect(checkClearance(room(), items).filter((x) => x.kind === "overlap")).toEqual([]);
  });

  it("поворот учитывается: тот же предмет боком помещается, а вдоль — нет", () => {
    const плашмя = [
      item(1, "Стол", 1.0, 2.0, [2.0, 0.6, 0.75]),
      // стол занимает x от 0.0 до 2.0 — стул ставим с зазором, а не впритык
      item(2, "Стул", 2.5, 2.0, [0.45, 0.45, 0.95]),
    ];
    expect(checkClearance(room(), плашмя).filter((x) => x.kind === "overlap")).toEqual([]);
    // тот же стол, повёрнутый на 90° — теперь он тянется по другой оси и
    // накрывает стул
    const повёрнут = [
      item(1, "Стол", 2.0, 2.0, [2.0, 0.6, 0.75], Math.PI / 2),
      item(2, "Стул", 2.0, 2.6, [0.45, 0.45, 0.95]),
    ];
    expect(checkClearance(room(), повёрнут).filter((x) => x.kind === "overlap").length).toBe(1);
  });

  it("шкаф перед дверью — находка с расстоянием в тексте", () => {
    const items = [item(1, "Шкаф", 2.9, 0.5, [1.8, 0.6, 2.3])];
    const r = checkClearance(room(), items);
    const door = r.filter((x) => x.kind === "door-blocked");
    expect(door.length).toBe(1);
    expect(door[0].text).toContain("0.9 м");
    expect(door[0].text).toContain("Шкаф");
  });

  it("тот же шкаф в стороне от двери — не находка", () => {
    const items = [item(1, "Шкаф", 5.0, 0.5, [1.8, 0.6, 2.3])];
    expect(checkClearance(room(), items).filter((x) => x.kind === "door-blocked")).toEqual([]);
  });

  it("нужное расстояние перед дверью задаётся и меняет результат", () => {
    const items = [item(1, "Комод", 2.9, 1.3, [1.0, 0.45, 0.85])];
    // при 0.9 м предмет уже вне зоны
    expect(checkClearance(room(), items, { doorDepth: 0.9 }).filter((x) => x.kind === "door-blocked")).toEqual([]);
    // при 1.6 м — попадает
    expect(checkClearance(room(), items, { doorDepth: 1.6 }).filter((x) => x.kind === "door-blocked").length).toBe(1);
  });

  it("ковёр и картина не мешают ничему — под ними и над ними стоят", () => {
    const items = [
      item(1, "Ковёр", 3, 2, [2.0, 1.4, 0.02]),
      item(2, "Кровать", 3, 2, [1.6, 2.0, 0.9]),
      item(3, "Картина", 2.9, 0.4, [0.8, 0.05, 0.6]),
    ];
    const r = checkClearance(room(), items);
    expect(r.filter((x) => x.kind === "overlap")).toEqual([]);
    // и ковёр не «загораживает дверь»
    expect(r.filter((x) => x.uids.includes(1))).toEqual([]);
  });

  it("предмет за пределами плана назван прямо", () => {
    const items = [item(1, "Диван", 7.5, 2, [2.2, 0.9, 0.85])];
    const r = checkClearance(room(), items);
    expect(r.some((x) => x.kind === "outside")).toBe(true);
  });

  it("предмет выше потолка не встанет — и сказано, насколько", () => {
    const items = [item(1, "Шкаф под потолок", 1, 1, [1.8, 0.6, 2.9])];
    const r = checkClearance(room(), items);
    const tall = r.filter((x) => x.kind === "passage");
    expect(tall.length).toBe(1);
    expect(tall[0].text).toContain("2.90");
    expect(tall[0].text).toContain("2.70");
  });

  it("пустая расстановка не даёт замечаний и не падает", () => {
    expect(checkClearance(room(), [])).toEqual([]);
  });
});
