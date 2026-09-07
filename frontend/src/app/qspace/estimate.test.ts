import { describe, expect, it } from "vitest";
import { demoPlan, generateLights, generatePlumbing, generateWiring } from "./planModel";
import { estimatePlan } from "./estimate";

describe("спецификация из демо-плана", () => {
  const p = demoPlan();
  const w = generateWiring(p);
  const pl = generatePlumbing(p);
  const est = estimatePlan(p, w, pl, generateLights(p).length);

  it("площадь пола — ровно габарит 8 × 6 = 48 м², покрытие с запасом 5 %", () => {
    expect(est.floorArea).toBe(48);
    expect(est.flooringArea).toBeCloseTo(50.4, 6);
  });

  it("площадь стен считается из длин и высот минус проёмы — не константа", () => {
    // независимый пересчёт той же формулы по данным плана
    let expected = 0;
    for (const wall of p.walls) {
      expected += Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) * wall.height;
    }
    for (const o of p.openings) expected -= o.width * o.height;
    expect(est.wallArea).toBeCloseTo(expected, 9);
    // и порядок величины осмысленный: 37 м стен × 2.7 минус ~15 м² проёмов
    expect(est.wallArea).toBeGreaterThan(80);
    expect(est.wallArea).toBeLessThan(101);
  });

  it("краска = площадь стен × 0.12 л/м² × 2 слоя", () => {
    expect(est.paintLitres).toBeCloseTo(est.wallArea * 0.24, 9);
  });

  it("счётчики точек совпадают со слоем электрики (не с собственной копией)", () => {
    expect(est.outlets).toBe(w.points.filter((x) => x.kind === "outlet").length);
    expect(est.switches).toBe(3);
  });

  it("метры кабеля и труб — суммы настоящих полилиний, не нули", () => {
    // магистрали идут вдоль всех 7 стен: одних магистралей уже больше 37 м
    expect(est.cableMeters).toBeGreaterThan(37);
    expect(est.pipeMeters).toBeGreaterThan(5);
    expect(est.drainMeters).toBeGreaterThan(5);
  });

  it("удлинение стены увеличивает и стены, и краску (число выводится из плана)", () => {
    const p2 = demoPlan();
    p2.walls[0].x2 += 2; // юг длиннее на 2 м
    const est2 = estimatePlan(p2, w, pl, 6);
    expect(est2.wallArea).toBeCloseTo(est.wallArea + 2 * 2.7, 6);
    expect(est2.paintLitres).toBeGreaterThan(est.paintLitres);
  });
});
