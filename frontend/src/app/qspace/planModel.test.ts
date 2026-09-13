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

describe("розетки расставлены по правилу, а не как вышло", () => {
  // Мутация «шаг розеток 25 м вместо 2.5» проходила молча: числа розеток не
  // проверял никто, а оно идёт прямо в закупку. При шаге в десять раз больше
  // квартира осталась бы с одной розеткой на стену.
  const plan = demoPlan();
  const w = generateWiring(plan);
  const outlets = w.points.filter((p) => p.kind === "outlet");

  it("розеток столько, сколько даёт шаг вдоль стен, а не единицы", () => {
    // Проверяется ОТНОШЕНИЕ к длине стен, а не сегодняшнее число: тест на
    // «ровно 11» наказывал бы за любое улучшение расстановки.
    const общаяДлина = plan.walls.reduce(
      (s, x) => s + Math.hypot(x.x2 - x.x1, x.y2 - x.y1), 0);
    expect(outlets.length, "розеток подозрительно мало для такой длины стен")
      .toBeGreaterThan(общаяДлина / 6);
    expect(outlets.length, "розеток больше, чем помещается по шагу")
      .toBeLessThan(общаяДлина / 1.2);
  });

  it("шаг проверяется на стене БЕЗ проёмов — иначе он ни на что не влияет", () => {
    // Разбор, стоивший двух неудачных попыток: розетки ставятся по участкам
    // МЕЖДУ проёмами, и на демо-квартире окна с дверями уже дробят стены на
    // куски короче пяти метров. На таких кусках правило «минимум одна» даёт
    // тот же результат, что и шаг, — поэтому мутация «шаг 25 м» проходила
    // мимо любых проверок, сделанных на демо. Правило видно только там, где
    // участок длиннее нескольких шагов.
    const прямая: Plan = {
      name: "зал", source: "demo", openings: [],
      walls: [
        { x1: 0, y1: 0, x2: 12, y2: 0, thickness: 0.3, height: 2.7 },
        { x1: 12, y1: 0, x2: 12, y2: 6, thickness: 0.3, height: 2.7 },
        { x1: 12, y1: 6, x2: 0, y2: 6, thickness: 0.3, height: 2.7 },
        { x1: 0, y1: 6, x2: 0, y2: 0, thickness: 0.3, height: 2.7 },
      ],
    };
    const точки = generateWiring(прямая).points.filter((p) => p.kind === "outlet");
    // 12 м при шаге 2.5 — это четыре розетки на стене, а не одна
    expect(точки.length, `на четырёх стенах без проёмов всего ${точки.length} розеток`)
      .toBeGreaterThan(8);
    // и сверху: слишком частый шаг это лишние розетки в закупке, а не забота
    expect(точки.length, `${точки.length} розеток на 36 м стен — шаг стал слишком частым`)
      .toBeLessThan(20);
  });

  it("длинная стена ДЕЛИТСЯ шагом, а не получает одну розетку", () => {
    // ⚠️ Это и есть проверка самого шага. Первый вариант теста мутацию «шаг
    // 25 м» не ловил: правило даёт минимум одну розетку на участок длиннее
    // 1.2 м, поэтому при любом шаге стена получает хотя бы одну, общее число
    // почти не падает, а цикл по ПАРАМ розеток на стене просто не выполняется —
    // пустой проход выглядит как успех.
    const длинная = [...plan.walls].sort(
      (a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))[0];
    const L = Math.hypot(длинная.x2 - длинная.x1, длинная.y2 - длинная.y1);
    const наНей = outlets.filter((p) => Math.abs(
      (p.x - длинная.x1) * (длинная.y2 - длинная.y1)
      - (p.y - длинная.y1) * (длинная.x2 - длинная.x1)) < 0.4);
    expect(L, "самая длинная стена короче 5 м — проверка не про то").toBeGreaterThan(5);
    expect(наНей.length, `на стене ${L.toFixed(1)} м всего ${наНей.length} розеток — шаг не работает`)
      .toBeGreaterThan(1);
  });

  it("две соседние розетки на одной стене стоят не дальше шага", () => {
    // прямая проверка самого правила, а не его следствия
    let пар = 0;
    for (const wall of plan.walls) {
      const наСтене = outlets
        .filter((p) => Math.abs(
          (p.x - wall.x1) * (wall.y2 - wall.y1) - (p.y - wall.y1) * (wall.x2 - wall.x1)) < 0.4)
        .map((p) => Math.hypot(p.x - wall.x1, p.y - wall.y1))
        .sort((a, b) => a - b);
      for (let i = 1; i < наСтене.length; i++) {
        пар++;
        expect(наСтене[i] - наСтене[i - 1], "разрыв между розетками больше шага")
          .toBeLessThan(4);
      }
    }
    // знаменатель: без него цикл по пустым спискам проходит молча
    expect(пар, "ни одной пары розеток на стене не проверено — тест пуст")
      .toBeGreaterThan(2);
  });

  it("контроль прибора: розетки вообще найдены", () => {
    // без этого обе проверки выше проходят на пустом списке
    expect(outlets.length, "розеток не найдено — проверки пусты").toBeGreaterThan(4);
  });
});
