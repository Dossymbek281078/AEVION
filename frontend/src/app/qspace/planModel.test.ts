import { describe, expect, it } from "vitest";
import { findRooms } from "./rooms";
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
    // Числа ЛИТЕРАЛАМИ, а не через HEIGHTS: сравнение константы с той же
    // константой зелено всегда. Проверено мутацией — подмена OUTLET_H на
    // 1.9 м проходила незамеченной, пока тут стояло HEIGHTS.outlet.
    for (const o of outlets) expect(o.z, "розетка не на 0.3 м").toBe(0.3);
    for (const s of switches) expect(s.z, "выключатель не на 0.9 м").toBe(0.9);
    expect(panels[0].z, "щиток не на 1.5 м").toBe(1.5);
    // и сами константы модуля должны совпадать с этими числами
    expect(HEIGHTS.outlet).toBe(0.3);
    expect(HEIGHTS.switch).toBe(0.9);
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

  it("КАЖДЫЙ горизонтальный участок канализации идёт с уклоном 2 см/м К стояку", () => {
    // Горизонтальный = концы на разной высоте при ненулевой длине по плану.
    // Вертикальный стояк сюда не попадает: у него длина по плану нулевая.
    const horizontal = pl.drain.filter(
      (r) => Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) > 0.1,
    );
    // На демо-плане подводки две: к кухне и к санузлу. Число закреплено
    // намеренно — «хотя бы один» пережил бы потерю уклона на одном из них
    // (проверено мутацией: уклон убрали у участка X, тест был зелёным).
    expect(horizontal.length, "участков канализации должно быть 2").toBe(2);

    for (const r of horizontal) {
      const len = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]);
      const dz = Math.abs(r[1][2] - r[0][2]);
      expect(dz, `участок длиной ${len.toFixed(2)} м без уклона`).toBeGreaterThan(0);
      expect(dz).toBeCloseTo(0.02 * len, 6);
      // нижний конец обязан быть ближе к стояку, иначе вода потечёт от него
      const [lo, hi] = r[0][2] < r[1][2] ? [r[0], r[1]] : [r[1], r[0]];
      const dLo = Math.hypot(lo[0] - pl.riser.x, lo[1] - pl.riser.y);
      const dHi = Math.hypot(hi[0] - pl.riser.x, hi[1] - pl.riser.y);
      expect(dLo).toBeLessThan(dHi);
    }
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

describe("светильники знают про помещения", () => {
  // Найдено замером 08.09: сетка по габариту оставляла комнату 6.8 м² в узкой
  // квартире БЕЗ единого светильника, а один светильник вешала в стену.
  // На демо та же сетка ложится удачно — поэтому проверяем на ДВУХ планировках.
  const w2 = (x1: number, y1: number, x2: number, y2: number, t = 0.15) =>
    ({ x1, y1, x2, y2, thickness: t, height: 2.7 });
  const узкая: Plan = {
    name: "узкая", source: "demo", openings: [],
    walls: [
      w2(0, 0, 12, 0, 0.3), w2(12, 0, 12, 3, 0.3), w2(12, 3, 0, 3, 0.3), w2(0, 3, 0, 0, 0.3),
      w2(9, 0, 9, 3), w2(10.5, 0, 10.5, 1.4),
    ],
  };

  for (const [имя, plan] of [["демо", demoPlan()], ["узкая", узкая]] as const) {
    it(`«${имя}»: ни одно помещение не осталось без светильника`, () => {
      const rooms = findRooms(plan);
      const ls = generateLights(plan, rooms);
      expect(rooms.rooms.length, "помещений не выделено — проверка пуста").toBeGreaterThan(1);
      for (const r of rooms.rooms) {
        const n = ls.filter((l) => rooms.roomAt(l.x, l.y) === r.index).length;
        expect(n, `помещение ${r.index} (${r.area.toFixed(1)} м²) без света`).toBeGreaterThan(0);
      }
    });

    it(`«${имя}»: ни один светильник не висит в стене`, () => {
      const rooms = findRooms(plan);
      const вСтене = generateLights(plan, rooms).filter((l) => rooms.roomAt(l.x, l.y) === null);
      expect(вСтене.length, "светильники вне помещений").toBe(0);
    });
  }

  it("контроль: БЕЗ помещений остаётся прежняя сетка, а не пустой потолок", () => {
    // разбиение может не получиться (открытый контур) — лучше грубо, чем никак
    expect(generateLights(demoPlan()).length).toBeGreaterThan(0);
  });

  it("контроль прибора: старое поведение действительно давало дефект", () => {
    // без этого «теперь хорошо» неотличимо от «и раньше было хорошо»
    const rooms = findRooms(узкая);
    const безУчёта = generateLights(узкая); // прежний путь: сетка по габариту
    const пустые = rooms.rooms.filter(
      (r) => !безУчёта.some((l) => rooms.roomAt(l.x, l.y) === r.index));
    expect(пустые.length, "на узкой планировке прежняя сетка была исправна — тест ничего не доказывает")
      .toBeGreaterThan(0);
  });
});
