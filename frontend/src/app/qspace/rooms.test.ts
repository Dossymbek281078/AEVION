import { describe, expect, it } from "vitest";
import { demoPlan, type Plan } from "./planModel";
import { findRooms } from "./rooms";

/** Одна комната: замкнутый прямоугольник W×H, стены тонкие. */
function boxRoom(W: number, H: number, thickness = 0.1): Plan {
  return {
    name: "коробка",
    walls: [
      { x1: 0, y1: 0, x2: W, y2: 0, thickness, height: 2.7 },
      { x1: W, y1: 0, x2: W, y2: H, thickness, height: 2.7 },
      { x1: W, y1: H, x2: 0, y2: H, thickness, height: 2.7 },
      { x1: 0, y1: H, x2: 0, y2: 0, thickness, height: 2.7 },
    ],
    openings: [],
    source: "demo",
  };
}

describe("выделение комнат", () => {
  it("замкнутый прямоугольник 6×4 даёт ОДНУ комнату площадью около 24 м²", () => {
    const r = findRooms(boxRoom(6, 4));
    expect(r.rooms.length).toBe(1);
    // стены толщиной 10 см съедают по 5 см с каждой стороны: 5.9 × 3.9 ≈ 23.0
    expect(r.rooms[0].area).toBeGreaterThan(21.5);
    expect(r.rooms[0].area).toBeLessThan(24.1);
    expect(r.warnings).toEqual([]);
  });

  it("центр комнаты — это её середина, а не угол", () => {
    const r = findRooms(boxRoom(6, 4));
    expect(r.rooms[0].cx).toBeCloseTo(3, 1);
    expect(r.rooms[0].cy).toBeCloseTo(2, 1);
  });

  it("перегородка делит комнату НА ДВЕ, и сумма примерно равна целому", () => {
    const one = findRooms(boxRoom(6, 4));
    const split: Plan = {
      ...boxRoom(6, 4),
      walls: [...boxRoom(6, 4).walls, { x1: 3, y1: 0, x2: 3, y2: 4, thickness: 0.1, height: 2.7 }],
    };
    const two = findRooms(split);
    expect(two.rooms.length).toBe(2);
    // площади близки друг к другу — перегородка ровно посередине
    expect(Math.abs(two.rooms[0].area - two.rooms[1].area)).toBeLessThan(0.5);
    // сумма меньше целой комнаты ровно на объём перегородки
    expect(two.totalArea).toBeLessThan(one.rooms[0].area);
    expect(two.totalArea).toBeGreaterThan(one.rooms[0].area - 1.0);
  });

  it("комнаты идут по убыванию площади и пронумерованы подряд", () => {
    const plan: Plan = {
      ...boxRoom(8, 4),
      walls: [...boxRoom(8, 4).walls, { x1: 2, y1: 0, x2: 2, y2: 4, thickness: 0.1, height: 2.7 }],
    };
    const r = findRooms(plan);
    expect(r.rooms.length).toBe(2);
    expect(r.rooms[0].area).toBeGreaterThan(r.rooms[1].area);
    expect(r.rooms.map((x) => x.index)).toEqual([1, 2]);
  });

  it("незамкнутый контур честно говорит, что помещений нет", () => {
    const open: Plan = {
      ...boxRoom(6, 4),
      walls: boxRoom(6, 4).walls.slice(0, 3), // одной стены нет
    };
    const r = findRooms(open);
    expect(r.rooms.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/не образуют контур/);
  });

  it("дверь между комнатами НЕ сливает их в одну", () => {
    // проёмы намеренно не вычитаются из стен
    const plan: Plan = {
      ...boxRoom(6, 4),
      walls: [...boxRoom(6, 4).walls, { x1: 3, y1: 0, x2: 3, y2: 4, thickness: 0.1, height: 2.7 }],
      openings: [{ wall: 4, offset: 1.5, width: 0.9, height: 2.05, sill: 0, kind: "door" }],
    };
    expect(findRooms(plan).rooms.length).toBe(2);
  });

  it("щели между стенами не считаются комнатами", () => {
    // две стены рядом с зазором 8 см — это не помещение
    const plan: Plan = {
      ...boxRoom(6, 4),
      walls: [
        ...boxRoom(6, 4).walls,
        { x1: 3, y1: 0, x2: 3, y2: 4, thickness: 0.1, height: 2.7 },
        { x1: 3.18, y1: 0, x2: 3.18, y2: 4, thickness: 0.1, height: 2.7 },
      ],
    };
    const r = findRooms(plan);
    // только две настоящие части, зазор между перегородками отброшен
    expect(r.rooms.length).toBe(2);
    for (const room of r.rooms) expect(room.area).toBeGreaterThan(0.5);
  });

  it("периметр растёт вместе с комнатой", () => {
    const small = findRooms(boxRoom(3, 3)).rooms[0];
    const big = findRooms(boxRoom(6, 6)).rooms[0];
    expect(big.perimeter).toBeGreaterThan(small.perimeter * 1.5);
  });

  it("демо-план разбивается на комнаты, а не на одну область", () => {
    const r = findRooms(demoPlan());
    // квартира 8×6 с двумя перегородками: жилая часть, спальня, санузел
    expect(r.rooms.length).toBeGreaterThanOrEqual(3);
    expect(r.totalArea).toBeGreaterThan(35);
    expect(r.totalArea).toBeLessThan(48); // меньше габарита 8×6 = 48
  });

  it("план без стен не падает и говорит об этом", () => {
    const empty: Plan = { name: "пусто", walls: [], openings: [], source: "demo" };
    const r = findRooms(empty);
    expect(r.rooms).toEqual([]);
    expect(r.warnings[0]).toContain("нет стен");
  });
});
