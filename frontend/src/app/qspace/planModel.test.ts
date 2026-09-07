import { describe, expect, it } from "vitest";
import {
  demoPlan,
  generateLights,
  generatePlumbing,
  generateWiring,
  planBounds,
  pointOnWall,
  HEIGHTS,
} from "./planModel";

describe("демо-план", () => {
  it("проёмы ссылаются на существующие стены и умещаются в их длину", () => {
    const p = demoPlan();
    expect(p.walls.length).toBe(7);
    for (const o of p.openings) {
      expect(o.wall).toBeGreaterThanOrEqual(0);
      expect(o.wall).toBeLessThan(p.walls.length);
      const w = p.walls[o.wall];
      const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      // проём целиком внутри стены — иначе перемычка повиснет в воздухе
      expect(o.offset).toBeGreaterThanOrEqual(0);
      expect(o.offset + o.width).toBeLessThanOrEqual(L + 1e-9);
    }
  });

  it("габарит демо-плана ровно 8 × 6 м", () => {
    const b = planBounds(demoPlan());
    expect(b.maxX - b.minX).toBe(8);
    expect(b.maxY - b.minY).toBe(6);
  });
});

describe("электрика (черновик)", () => {
  const p = demoPlan();
  const w = generateWiring(p);

  it("розетки ровно на 0.3 м, выключатели на 0.9 м, щиток на 1.5 м", () => {
    const outlets = w.points.filter((x) => x.kind === "outlet");
    const switches = w.points.filter((x) => x.kind === "switch");
    const panels = w.points.filter((x) => x.kind === "panel");
    expect(outlets.length).toBeGreaterThanOrEqual(8); // 7 стен, у длинных — по нескольку
    expect(switches.length).toBe(3); // по одному на каждую из трёх дверей
    expect(panels.length).toBe(1);
    for (const o of outlets) expect(o.z).toBe(HEIGHTS.outlet);
    for (const s of switches) expect(s.z).toBe(HEIGHTS.switch);
    expect(panels[0].z).toBe(1.5);
  });

  it("к каждой розетке и выключателю идёт спуск кабеля от магистрали", () => {
    for (const pt of w.points) {
      if (pt.kind === "panel") continue;
      const drop = w.runs.find(
        (r) =>
          r.length === 2 &&
          Math.abs(r[0][0] - pt.x) < 1e-9 &&
          Math.abs(r[0][1] - pt.y) < 1e-9 &&
          r[0][2] === HEIGHTS.trunk &&
          r[1][2] === pt.z,
      );
      expect(drop, `нет спуска к точке ${pt.kind} (${pt.x}, ${pt.y})`).toBeTruthy();
    }
  });

  it("розетки не попадают в проёмы (на двери розетку не повесить)", () => {
    for (const pt of w.points.filter((x) => x.kind === "outlet")) {
      for (const o of p.openings) {
        const wall = p.walls[o.wall];
        const a = pointOnWall(wall, o.offset);
        const b = pointOnWall(wall, o.offset + o.width);
        // точка внутри отрезка проёма на той же стене?
        const insideX = pt.x >= Math.min(a.x, b.x) - 1e-9 && pt.x <= Math.max(a.x, b.x) + 1e-9;
        const insideY = pt.y >= Math.min(a.y, b.y) - 1e-9 && pt.y <= Math.max(a.y, b.y) + 1e-9;
        const onWallLine =
          Math.abs((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)) < 1e-6;
        expect(insideX && insideY && onWallLine).toBe(false);
      }
    }
  });
});

describe("сантехника (черновик)", () => {
  const p = demoPlan();
  const pl = generatePlumbing(p);

  it("канализация идёт с уклоном 2 см/м К стояку", () => {
    // горизонтальные участки канализации (кроме вертикального стояка)
    const horizontal = pl.drain.filter((r) => r[0][2] !== 0 || r[1][2] !== r[0][2]);
    const sloped = pl.drain.filter((r) => {
      const dz = Math.abs(r[1][2] - r[0][2]);
      const len = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]);
      return len > 0.1 && dz > 0;
    });
    expect(sloped.length).toBeGreaterThanOrEqual(1);
    for (const r of sloped) {
      const len = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]);
      const dz = Math.abs(r[1][2] - r[0][2]);
      expect(dz).toBeCloseTo(0.02 * len, 6);
      // нижний конец — тот, что ближе к стояку
      const [lo, hi] = r[0][2] < r[1][2] ? [r[0], r[1]] : [r[1], r[0]];
      const dLo = Math.hypot(lo[0] - pl.riser.x, lo[1] - pl.riser.y);
      const dHi = Math.hypot(hi[0] - pl.riser.x, hi[1] - pl.riser.y);
      expect(dLo).toBeLessThan(dHi);
    }
    void horizontal;
  });

  it("стояк внутри габарита плана", () => {
    const b = planBounds(p);
    expect(pl.riser.x).toBeGreaterThan(b.minX);
    expect(pl.riser.x).toBeLessThan(b.maxX);
    expect(pl.riser.y).toBeGreaterThan(b.minY);
    expect(pl.riser.y).toBeLessThan(b.maxY);
  });
});

describe("свет", () => {
  it("все светильники внутри габарита, сетка по размеру плана", () => {
    const p = demoPlan();
    const b = planBounds(p);
    const lights = generateLights(p);
    // 8×6 м, шаг ~3 м → 3×2 = 6 светильников: сетка считается от размеров
    expect(lights.length).toBe(6);
    for (const l of lights) {
      expect(l.x).toBeGreaterThan(b.minX);
      expect(l.x).toBeLessThan(b.maxX);
      expect(l.y).toBeGreaterThan(b.minY);
      expect(l.y).toBeLessThan(b.maxY);
    }
  });
});
