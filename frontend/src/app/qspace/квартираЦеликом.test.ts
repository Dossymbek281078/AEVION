import { describe, expect, it } from "vitest";
import { parseDxf } from "./dxf";
import { findRooms } from "./rooms";
import { estimatePlan } from "./estimate";
import { generateLights, generatePlumbing, generateWiring, planWallHeight } from "./planModel";
import { roomSpec } from "./roomSpec";

/**
 * Связка возможностей, а не каждая по отдельности.
 *
 * Сегодняшний урок с телефона: каждый кусок исправен, а вместе они дают дефект,
 * которого не видит ни один тест куска. У разбора чертежа ровно та же поверхность:
 * сведение двойных стен, закрытие дверных разрывов и выделение помещений
 * проверены порознь, а встречаются в ОДНОМ файле — именно так чертит любой
 * архитектор.
 *
 * Здесь один файл проходит весь путь: разбор → стены → комнаты → смета. Числа
 * сверены с геометрией руками, а не взяты из прогона: квартира 8x6 со стенами
 * 0.2 даёт внутри 7.6 x 5.6 = 42.6 м², минус перегородка 1.1 — около 41.5 м².
 * Найденные 39.3 меньше на сетку 5 см и радиус разметки стен, и это ожидаемо.
 */
const NL = String.fromCharCode(10);
const файл = (тело: string) =>
  ["0", "SECTION", "2", "ENTITIES", тело, "0", "ENDSEC", "0", "EOF"].join(NL) + NL;
const L = (x1: number, y1: number, x2: number, y2: number) =>
  ["0", "LINE", "8", "СТЕНЫ", "10", String(x1), "20", String(y1),
    "11", String(x2), "21", String(y2)].join(NL);

/** Квартира 8x6: стены ДВУМЯ линиями (0.2), перегородка с дверным проёмом 0.9. */
function квартира(): string {
  const t = 0.2, W = 8, H = 6, xп = 5, d0 = 2.4, d1 = 3.3;
  const части: string[] = [];
  for (const [y1, y2] of [[0, t], [H - t, H]]) части.push(L(0, y1, W, y1), L(0, y2, W, y2));
  for (const [x1, x2] of [[0, t], [W - t, W]]) части.push(L(x1, 0, x1, H), L(x2, 0, x2, H));
  for (const x of [xп, xп + t]) части.push(L(x, t, x, d0), L(x, d1, x, H - t));
  return части.join(NL);
}

describe("квартира целиком: разбор, стены, комнаты, смета", () => {
  const r = parseDxf(файл(квартира()));

  it("двенадцать граней сводятся в шесть стен, толщина из чертежа", () => {
    expect(r.plan, "чертёж перестал разбираться").not.toBeNull();
    expect(r.plan!.walls.length, "пары граней перестали сводиться").toBe(6);
    const толщины = new Set(r.plan!.walls.map((w) => Number(w.thickness.toFixed(2))));
    expect([...толщины], "толщина взята не из чертежа").toEqual([0.2]);
  });

  it("дверной разрыв РАЗДЕЛЯЕТ помещения, а не сливает их в одно", () => {
    const rooms = findRooms(r.plan!);
    // Главное: комнат ДВЕ. При слиянии была бы одна, сумма площадей та же —
    // и разбивка, по которой покупают плитку и обои, оказалась бы неверной
    // при верном итоге. Это тот случай, когда сумма не спасает.
    expect(rooms.rooms.length, "проём слил комнаты в одну").toBe(2);
    const площади = rooms.rooms.map((c) => c.area).sort((a, b) => b - a);
    expect(площади[0]).toBeGreaterThan(20);
    expect(площади[1]).toBeGreaterThan(8);
    expect(rooms.warnings.join(" "), "проём закрыт молча — человек не узнает о допущении")
      .toMatch(/проём|дверн/i);
  });

  it("смета считается по комнатам и остаётся в физических пределах", () => {
    const rooms = findRooms(r.plan!);
    const h = planWallHeight(r.plan!);
    const pr = roomSpec(rooms.rooms, h);
    const est = estimatePlan(
      r.plan!, generateWiring(r.plan!), generatePlumbing(r.plan!),
      generateLights(r.plan!, rooms).length, rooms.totalArea, pr.totals.wallArea,
    );
    // Пол не может быть больше габарита 8x6 и не может быть нулём.
    expect(est.floorArea).toBeGreaterThan(30);
    expect(est.floorArea).toBeLessThanOrEqual(48);
    // Стены: периметр комнат на высоту. Заведомые пределы, а не подогнанное число.
    expect(est.wallArea).toBeGreaterThan(est.floorArea);
    expect(est.wallArea).toBeLessThan(est.floorArea * 5);
    // Краска выводится из площади стен, а не из воздуха.
    expect(est.paintLitres).toBeCloseTo(est.wallArea * 0.12 * 2, 1);
  });
});
