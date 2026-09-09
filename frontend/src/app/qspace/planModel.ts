/**
 * QSpace — модель плана помещения и генераторы инженерных слоёв.
 *
 * Всё в МЕТРАХ, ось Y плана — «на север» (в 3D станет осью Z).
 * Файл намеренно без DOM и three.js: генераторы чистые, тестируются vitest-ом.
 *
 * Честная граница (написана и на странице): разводка электрики и труб —
 * ЧЕРНОВИК по типовым правилам (розетки 0.3 м, выключатели 0.9 м, магистраль
 * под потолком), ориентир для обсуждения с прорабом, а не проектная
 * документация под подпись.
 */

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** толщина, м */
  thickness: number;
  /** высота, м */
  height: number;
}

export interface Opening {
  /** индекс стены в plan.walls */
  wall: number;
  /** отступ начала проёма от начала стены вдоль неё, м */
  offset: number;
  width: number;
  height: number;
  /** высота низа проёма от пола (у двери 0) */
  sill: number;
  kind: "door" | "window";
}

export interface Plan {
  name: string;
  walls: Wall[];
  openings: Opening[];
  /**
   * Откуда пришёл план. Поле уезжает в сохранённый файл проекта, то есть
   * его человек уносит с собой и передаёт подрядчику.
   *
   * До 09.09.2026 тип знал только demo и dxf, и планы из PDF и из картинки
   * называли себя dxf — поле было, а правды в нём нет. Читателей у него
   * пока нет, поэтому ничего не ломалось — и именно поэтому неверное
   * значение могло жить долго. Расширение совместимое: старые файлы
   * со значением "dxf" по-прежнему читаются.
   */
  source: "demo" | "dxf" | "pdf" | "raster";
}

/** Точка электрики. */
export interface WirePoint {
  x: number;
  y: number;
  z: number;
  kind: "outlet" | "switch" | "panel";
}

/** Полилиния кабеля/трубы: массив [x, y, z]. */
export type Run = Array<[number, number, number]>;

export interface WiringDraft {
  points: WirePoint[];
  runs: Run[];
}

export interface PlumbingDraft {
  /** холодная вода */
  cold: Run[];
  /** горячая вода */
  hot: Run[];
  /** канализация */
  drain: Run[];
  /** точка стояка */
  riser: { x: number; y: number };
}

export interface CeilingLight {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------

const WALL_H = 2.7;
const OUTLET_H = 0.3; // розетки — 30 см от пола (евростандарт)
const SWITCH_H = 0.9; // выключатели — 90 см
const TRUNK_H = WALL_H - 0.25; // магистраль кабеля под потолком
const OUTLET_STEP = 2.5; // шаг розеток вдоль стены

function wallLen(w: Wall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

function wallDir(w: Wall): { dx: number; dy: number } {
  const L = wallLen(w) || 1;
  return { dx: (w.x2 - w.x1) / L, dy: (w.y2 - w.y1) / L };
}

/** Точка на стене на расстоянии t от начала. */
export function pointOnWall(w: Wall, t: number): { x: number; y: number } {
  const { dx, dy } = wallDir(w);
  return { x: w.x1 + dx * t, y: w.y1 + dy * t };
}

export function planBounds(plan: Plan) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2);
    maxY = Math.max(maxY, w.y1, w.y2);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  return { minX, minY, maxX, maxY };
}

/** Участки стены, свободные от проёмов (для розеток). */
function freeSegments(plan: Plan, wallIdx: number): Array<[number, number]> {
  const w = plan.walls[wallIdx];
  const L = wallLen(w);
  const holes = plan.openings
    .filter((o) => o.wall === wallIdx)
    .map((o) => [o.offset, o.offset + o.width] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const segs: Array<[number, number]> = [];
  let cur = 0;
  for (const [a, b] of holes) {
    if (a > cur) segs.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < L) segs.push([cur, L]);
  return segs;
}

/**
 * Черновик электрики: розетки по свободным участкам стен, выключатели у
 * дверей, щиток у входной двери, магистрали под потолком со спусками.
 */
export function generateWiring(plan: Plan): WiringDraft {
  const points: WirePoint[] = [];
  const runs: Run[] = [];

  // Щиток — рядом с первой дверью (вход), 15 см от края проёма, высота 1.5 м.
  const entrance = plan.openings.find((o) => o.kind === "door");
  if (entrance) {
    const w = plan.walls[entrance.wall];
    const t = Math.max(0.2, entrance.offset - 0.35);
    const p = pointOnWall(w, t);
    points.push({ x: p.x, y: p.y, z: 1.5, kind: "panel" });
  }

  plan.walls.forEach((w, wi) => {
    const segs = freeSegments(plan, wi);
    for (const [a, b] of segs) {
      const segLen = b - a;
      if (segLen < 0.6) continue;
      // розетки: минимум одна на участок длиннее 1.2 м, дальше шагом
      const n = Math.max(segLen >= 1.2 ? 1 : 0, Math.floor(segLen / OUTLET_STEP));
      for (let i = 1; i <= n; i++) {
        const t = a + (segLen * i) / (n + 1);
        const p = pointOnWall(w, t);
        points.push({ x: p.x, y: p.y, z: OUTLET_H, kind: "outlet" });
        // спуск кабеля от магистрали к розетке
        runs.push([[p.x, p.y, TRUNK_H], [p.x, p.y, OUTLET_H]]);
      }
    }
    // магистраль под потолком вдоль всей стены
    if (wallLen(w) >= 0.6) {
      runs.push([[w.x1, w.y1, TRUNK_H], [w.x2, w.y2, TRUNK_H]]);
    }
  });

  // выключатель у каждой двери — 15 см от края проёма со стороны начала стены
  for (const o of plan.openings) {
    if (o.kind !== "door") continue;
    const w = plan.walls[o.wall];
    const t = Math.max(0.15, o.offset - 0.2);
    const p = pointOnWall(w, t);
    points.push({ x: p.x, y: p.y, z: SWITCH_H, kind: "switch" });
    runs.push([[p.x, p.y, TRUNK_H], [p.x, p.y, SWITCH_H]]);
  }

  return { points, runs };
}

/**
 * Черновик водоснабжения и канализации. Стояк ставится в угол плана,
 * ближайший к минимальному углу габарита (типовое место мокрой зоны на
 * демо-плане); подводки идут вдоль двух примыкающих стен.
 * Канализация — с уклоном 2 см/м от дальней точки к стояку.
 */
export function generatePlumbing(plan: Plan): PlumbingDraft {
  const b = planBounds(plan);
  // ближайший к (maxX, maxY) угол какой-либо стены — правый верхний угол
  // (на демо-плане там санузел; для DXF это честное допущение черновика)
  let riser = { x: b.maxX, y: b.maxY };
  let best = Infinity;
  for (const w of plan.walls) {
    for (const c of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
      const d = Math.hypot(c.x - b.maxX, c.y - b.maxY);
      if (d < best) { best = d; riser = c; }
    }
  }
  // отступ внутрь помещения на 0.25 м
  const rx = riser.x - Math.sign(riser.x - (b.minX + b.maxX) / 2) * 0.25 || riser.x - 0.25;
  const ry = riser.y - Math.sign(riser.y - (b.minY + b.maxY) / 2) * 0.25 || riser.y - 0.25;

  const cold: Run[] = [];
  const hot: Run[] = [];
  const drain: Run[] = [];

  // стояк вертикально
  cold.push([[rx, ry, 0], [rx, ry, WALL_H]]);
  hot.push([[rx + 0.08, ry, 0], [rx + 0.08, ry, WALL_H]]);
  drain.push([[rx - 0.12, ry, 0], [rx - 0.12, ry, WALL_H]]);

  // подводка вдоль стены к кухонной зоне (влево от стояка) на высоте 0.5 м
  const spanX = Math.min(3, rx - b.minX - 0.4);
  if (spanX > 0.5) {
    cold.push([[rx, ry, 0.5], [rx - spanX, ry, 0.5]]);
    hot.push([[rx + 0.0, ry, 0.55], [rx - spanX, ry, 0.55]]);
    // канализация Ø50 с уклоном 2 см/м К стояку; уклон считается от
    // фактической длины трубы (стояк смещён на 0.12 м от точки riser)
    const drainLenX = spanX - 0.12;
    drain.push([[rx - spanX, ry, 0.05 + 0.02 * drainLenX], [rx - 0.12, ry, 0.05]]);
  }
  // и вниз вдоль второй стены (к ванной) на ту же высоту
  const spanY = Math.min(2.5, ry - b.minY - 0.4);
  if (spanY > 0.5) {
    cold.push([[rx, ry, 0.5], [rx, ry - spanY, 0.5]]);
    hot.push([[rx + 0.08, ry, 0.55], [rx + 0.08, ry - spanY, 0.55]]);
    drain.push([[rx - 0.12, ry - spanY, 0.05 + 0.02 * spanY], [rx - 0.12, ry, 0.05]]);
  }

  return { cold, hot, drain, riser: { x: rx, y: ry } };
}

/** Потолочные светильники сеткой ~3 м внутри габарита плана. */
/**
 * Светильники на потолке.
 *
 * Сетка с шагом около 3 м — так их и вешают. Но сетка сама по себе НЕ знает
 * про комнаты, и это стоило дефекта: замер 08.09.2026 на длинной узкой
 * квартире 12 × 3 м дал комнату 6.8 м² БЕЗ единого светильника и один
 * светильник в стене. На демо-квартире та же сетка ложится удачно, поэтому
 * дефект не всплывал — показательный случай проверять на ДВУХ планировках.
 *
 * Поэтому, когда разбиение на помещения известно, сетка через него
 * ПРОСЕИВАЕТСЯ: точки в стенах и на улице отбрасываются, а комната, которой
 * не досталось ни одной, получает светильник в свой центр. Без разбиения
 * остаётся прежнее поведение: лучше грубая сетка, чем пустой потолок.
 */
export function generateLights(
  plan: Plan,
  rooms?: { rooms: Array<{ index: number; cx: number; cy: number }>; roomAt(x: number, y: number): number | null },
): CeilingLight[] {
  const b = planBounds(plan);
  const W = b.maxX - b.minX;
  const H = b.maxY - b.minY;
  const nx = Math.max(1, Math.round(W / 3));
  const ny = Math.max(1, Math.round(H / 3));
  const grid: CeilingLight[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      grid.push({
        x: b.minX + (W * (i + 0.5)) / nx,
        y: b.minY + (H * (j + 0.5)) / ny,
      });
    }
  }
  if (!rooms || rooms.rooms.length === 0) return grid;

  const out: CeilingLight[] = [];
  const попало = new Set<number>();
  for (const l of grid) {
    const r = rooms.roomAt(l.x, l.y);
    if (r === null) continue; // в стене или на улице — светильник туда не вешают
    попало.add(r);
    out.push(l);
  }
  for (const r of rooms.rooms) {
    if (попало.has(r.index)) continue;
    // ⚠️ Центр комнаты НЕ ГОДИТСЯ как запасная точка: у Г-образного помещения
    // центроид попадает в перегородку. Замер на узкой квартире: светильник по
    // центру комнаты 6.8 м² оказывался в стене, то есть починка меняла один
    // дефект на другой. Ищем настоящую точку внутри — решёткой в четверть метра.
    let точка: CeilingLight | null = null;
    if (rooms.roomAt(r.cx, r.cy) === r.index) {
      точка = { x: r.cx, y: r.cy };
    } else {
      for (let y = b.minY; y <= b.maxY && !точка; y += 0.25) {
        for (let x = b.minX; x <= b.maxX; x += 0.25) {
          if (rooms.roomAt(x, y) === r.index) { точка = { x, y }; break; }
        }
      }
    }
    if (точка) out.push(точка);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Демо-план: однокомнатная квартира 8 × 6 м. Показывается сразу при входе,
// чтобы человек видел результат ДО того, как ему понадобился свой DXF.

const T = 0.15; // внутренние
const TE = 0.3; // наружные

export function demoPlan(): Plan {
  const walls: Wall[] = [
    // наружный контур, по часовой от юго-запада
    { x1: 0, y1: 0, x2: 8, y2: 0, thickness: TE, height: WALL_H }, // 0 юг
    { x1: 8, y1: 0, x2: 8, y2: 6, thickness: TE, height: WALL_H }, // 1 восток
    { x1: 8, y1: 6, x2: 0, y2: 6, thickness: TE, height: WALL_H }, // 2 север
    { x1: 0, y1: 6, x2: 0, y2: 0, thickness: TE, height: WALL_H }, // 3 запад
    // спальня справа-снизу
    { x1: 4.8, y1: 0, x2: 4.8, y2: 3.6, thickness: T, height: WALL_H }, // 4
    { x1: 4.8, y1: 3.6, x2: 8, y2: 3.6, thickness: T, height: WALL_H }, // 5
    // санузел справа-сверху
    { x1: 5.6, y1: 3.6, x2: 5.6, y2: 6, thickness: T, height: WALL_H }, // 6
  ];
  const openings: Opening[] = [
    // входная дверь — на западной стене (стена 3 идёт от (0,6) к (0,0))
    { wall: 3, offset: 1.2, width: 0.95, height: 2.05, sill: 0, kind: "door" },
    // окна: два на юг, одно на восток, одно на север (кухня)
    { wall: 0, offset: 1.4, width: 1.5, height: 1.45, sill: 0.85, kind: "window" },
    { wall: 0, offset: 5.6, width: 1.5, height: 1.45, sill: 0.85, kind: "window" },
    { wall: 1, offset: 1.2, width: 1.4, height: 1.45, sill: 0.85, kind: "window" },
    { wall: 2, offset: 5.4, width: 1.5, height: 1.45, sill: 0.85, kind: "window" },
    // дверь в спальню (стена 4, от (4.8,0) вверх)
    { wall: 4, offset: 2.5, width: 0.85, height: 2.05, sill: 0, kind: "door" },
    // дверь в санузел (стена 6, от (5.6,3.6) вверх)
    { wall: 6, offset: 0.3, width: 0.75, height: 2.05, sill: 0, kind: "door" },
  ];
  return { name: "Демо: квартира 8 × 6 м", walls, openings, source: "demo" };
}

export const WALL_HEIGHT = WALL_H;
export const HEIGHTS = { outlet: OUTLET_H, switch: SWITCH_H, trunk: TRUNK_H };
