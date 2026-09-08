import { describe, expect, it } from "vitest";
import type { Plan } from "./planModel";
import type { Placed } from "./clearance";
import { checkPassage } from "./passage";

/**
 * Комната 6×4 м, дверь на южной стене слева, перегородка справа с проходом:
 * получается «прихожая» и дальняя часть, соединённые проёмом шириной 1 м.
 */
function twoParts(): Plan {
  return {
    name: "две части",
    walls: [
      { x1: 0, y1: 0, x2: 6, y2: 0, thickness: 0.2, height: 2.7 },
      { x1: 6, y1: 0, x2: 6, y2: 4, thickness: 0.2, height: 2.7 },
      { x1: 6, y1: 4, x2: 0, y2: 4, thickness: 0.2, height: 2.7 },
      { x1: 0, y1: 4, x2: 0, y2: 0, thickness: 0.2, height: 2.7 },
      // перегородка с проходом: две части стены, между ними метр пустоты
      { x1: 3, y1: 0, x2: 3, y2: 1.5, thickness: 0.15, height: 2.7 },
      { x1: 3, y1: 2.5, x2: 3, y2: 4, thickness: 0.15, height: 2.7 },
    ],
    openings: [
      { wall: 0, offset: 1.0, width: 0.9, height: 2.05, sill: 0, kind: "door" },
    ],
    source: "demo",
  };
}

const item = (uid: number, name: string, x: number, y: number, size: [number, number, number], rotY = 0): Placed =>
  ({ uid, name, x, y, rotY, size });

describe("проходимость", () => {
  it("пустая комната: дойти можно везде, замечаний нет", () => {
    const r = checkPassage(twoParts(), []);
    expect(r.issues).toEqual([]);
    expect(r.reachableArea).toBeGreaterThan(15);
  });

  it("шкаф в проходе отрезает дальнюю часть — и площадь названа", () => {
    // шкаф 1.8 м поперёк прохода шириной 1 м
    const items = [item(1, "Шкаф", 3, 2, [0.6, 1.8, 2.3])];
    const r = checkPassage(twoParts(), items);
    expect(r.issues.length).toBe(1);
    expect(r.issues[0].area).toBeGreaterThan(4);
    expect(r.issues[0].text).toContain("не дойти от двери");
    // отрезана именно ДАЛЬНЯЯ часть (за перегородкой, x > 3)
    expect(r.issues[0].cx).toBeGreaterThan(3);
  });

  it("тот же шкаф у стены НЕ отрезает ничего — сторож не шумит", () => {
    const items = [item(1, "Шкаф", 5.2, 2, [0.6, 1.8, 2.3])];
    expect(checkPassage(twoParts(), items).issues).toEqual([]);
  });

  it("тумбочка вплотную к кровати — это НЕ ошибка", () => {
    // главная причина, по которой проверка сделана так, а не «зазор < 60 см»
    const items = [
      item(1, "Кровать", 4.5, 2.5, [1.6, 2.0, 0.9], Math.PI / 2),
      item(2, "Тумбочка", 4.5, 1.3, [0.45, 0.4, 0.5]),
    ];
    expect(checkPassage(twoParts(), items).issues).toEqual([]);
  });

  it("ковёр и низкий стол проход не перекрывают — через них переступают", () => {
    const items = [
      item(1, "Ковёр", 3, 2, [2.0, 1.4, 0.02]),
      item(2, "Журнальный стол", 3, 2, [0.9, 0.55, 0.45]),
    ];
    expect(checkPassage(twoParts(), items).issues).toEqual([]);
  });

  it("высокий предмет в том же месте проход перекрывает — высота решает", () => {
    const low = [item(1, "Низкий", 3, 2, [0.6, 1.8, 0.35])];
    const high = [item(1, "Высокий", 3, 2, [0.6, 1.8, 1.2])];
    expect(checkPassage(twoParts(), low).issues.length).toBe(0);
    expect(checkPassage(twoParts(), high).issues.length).toBe(1);
  });

  it("щель меньше квадратного метра не считается отрезанной комнатой", () => {
    // шкаф прижат к перегородке, за ним остаётся крошечный карман
    const items = [item(1, "Шкаф", 3.4, 3.4, [0.6, 0.6, 2.3])];
    const r = checkPassage(twoParts(), items);
    for (const i of r.issues) expect(i.area).toBeGreaterThanOrEqual(1);
  });

  // Дверь бывает ТОЛЬКО внутренняя — так рисуют, когда чертят одну комнату
  // квартиры. Тогда наружу из плана не выйти, и вся улица оказалась бы
  // «недостижимым куском площадью 200 м²». Это поймала мутация: без отсечки
  // «область касается края» ни один тест не краснел.
  it("улица снаружи плана НЕ выдаётся за отрезанную комнату", () => {
    const base = twoParts();
    const interiorDoorOnly: Plan = {
      ...base,
      // тонкие стены: при толстых наружный зазор целиком съедается их
      // толщиной, и улицы в сетке не остаётся — проверка была бы пустой
      walls: base.walls.map((w) => ({ ...w, thickness: 0.05 })),
      openings: [
        // дверь в перегородке (стена 4), наружных дверей нет
        { wall: 4, offset: 0.3, width: 0.9, height: 2.05, sill: 0, kind: "door" },
      ],
    };
    const r = checkPassage(interiorDoorOnly, []);
    // В пустой комнате отрезать нечего — находок не должно быть ВОВСЕ.
    // Прежнее утверждение («площадь находки меньше 24 м²») было слишком
    // слабым: наружное кольцо в сетке узкое, его площадь около метра, и
    // проверка пропускала его. Померил и исправил, а не догадался.
    expect(
      r.issues.map((i) => i.area.toFixed(1)),
      "улица снаружи плана засчитана как отрезанная комната",
    ).toEqual([]);
    // и сама проверка при этом работает: доступная площадь ненулевая
    expect(r.reachableArea).toBeGreaterThan(1);
  });

  it("без дверей проверка честно говорит, что считать не от чего", () => {
    const noDoor: Plan = { ...twoParts(), openings: [] };
    const r = checkPassage(noDoor, []);
    expect(r.issues).toEqual([]);
    expect(r.warnings.join(" ")).toContain("Дверей в плане нет");
  });

  it("доступная площадь уменьшается, когда мебель занимает место", () => {
    const empty = checkPassage(twoParts(), []).reachableArea;
    const withBed = checkPassage(twoParts(), [
      item(1, "Кровать", 1.5, 2.5, [1.6, 2.0, 0.9]),
    ]).reachableArea;
    expect(withBed).toBeLessThan(empty);
    // ровно на площадь кровати, с точностью до сетки 5 см
    expect(empty - withBed).toBeGreaterThan(2.5);
    expect(empty - withBed).toBeLessThan(4.0);
  });
});
