/**
 * QSpace — выделение комнат и их площадей.
 *
 * Зачем. Спецификация по габариту плана («63 м²») для ремонта бесполезна:
 * плитку считают в санузел, паркет — в комнату, обои — по периметру каждой
 * стены. Человеку нужны площади ПОМЕЩЕНИЙ, а их в чертеже нет — есть только
 * отрезки стен.
 *
 * Как считается. План растеризуется в сетку 5 см, клетки под стенами
 * помечаются занятыми, дальше обычная заливка по свободным клеткам. Связная
 * область, не касающаяся края габарита, — комната.
 *
 * Почему заливка, а не поиск циклов в графе стен: чертежи приходят грязными —
 * отрезки не сходятся в узлах на пару миллиметров, дублируются, идут внахлёст.
 * Граф на таких данных разваливается молча, а заливка просто даёт чуть менее
 * точную площадь и честно говорит, если контур не замкнут.
 *
 * 🔴 ГРАНИЦА: проёмы НЕ вычитаются из стен намеренно. Дверь между комнатами не
 * делает их одной комнатой; иначе вся квартира слилась бы в одну область.
 */

import type { Plan } from "./planModel";

export interface Room {
  /** порядковый номер, 1..N — им комнату называют человеку */
  index: number;
  /** площадь пола, м² */
  area: number;
  /** периметр по границе области, м — для плинтуса и обоев */
  perimeter: number;
  /** центр области в плане — куда ставить подпись */
  cx: number;
  cy: number;
}

export interface RoomsResult {
  rooms: Room[];
  /** сумма площадей комнат, м² */
  totalArea: number;
  /** предупреждения человеку: почему результат может быть не тем, что ждали */
  warnings: string[];
  /**
   * В какой комнате лежит точка плана: номер из `rooms` или null (стена,
   * улица, слишком мелкая область).
   *
   * Нужно, чтобы отнести поставленный предмет к комнате — например, посчитать
   * площадь под встроенной мебелью для тёплого пола. Заливка уже разметила
   * каждую клетку, и выбрасывать эту разметку значило бы считать её заново
   * другим способом, то есть завести второй источник правды.
   */
  roomAt(x: number, y: number): number | null;
  /**
   * Клетки комнаты полосами по строкам, в метрах плана: y — середина строки,
   * x0..x1 — сплошной отрезок клеток этой комнаты. Нужно, чтобы построить пол
   * КОМНАТЫ (свой материал у каждой) и найти её габарит для расстановки мебели.
   * Берётся из той же разметки, что и roomAt, — второй обход стен не нужен.
   */
  runsOf(index: number): Array<{ y: number; x0: number; x1: number }>;
}

export type RoomRun = { y: number; x0: number; x1: number };

const CELL = 0.05; // 5 см — компромисс между точностью и объёмом работы

/** Ширина проёма, который считается ДВЕРЬЮ, а не разрывом между стенами, м. */
const DOOR_MIN = 0.5;
const DOOR_MAX = 1.6;

/**
 * Дверь, нарисованная РАЗРЫВОМ стены, закрывается — только для обхода комнат.
 *
 * В архитектурном чертеже дверной проём часто не рисуют вовсе: перегородку
 * просто прерывают. Для модели это верно — там действительно проход, — а для
 * обхода помещений это дыра, и заливка через неё протекает.
 *
 * Замер до правки: коробка 8×6 с перегородкой посередине и проёмом 0.9 м дала
 * ОДНУ комнату 43 м² вместо двух по 21. Суммарная площадь при этом верна,
 * поэтому ошибка тихая: итог сходится, а разбивка по помещениям — та самая,
 * по которой покупают плитку и обои, — неверна.
 *
 * Признак структурный, а не пороговый: два отрезка ЛЕЖАТ НА ОДНОЙ ПРЯМОЙ,
 * смотрят торцами друг на друга, и между их концами нет ничего. Ширина 0.5–1.6 м
 * — это границы существования двери, а не подобранное число: уже 0.5 м человек
 * не пройдёт, шире 1.6 м это уже не дверь, а открытый проём между зонами, и
 * считать такие зоны одним помещением как раз правильно.
 *
 * Стены плана НЕ меняются: в модели проход остаётся проходом. Закрывается
 * только клетка сетки, по которой считаются площади.
 */
function closeDoorGaps(
  walls: Plan["walls"],
  mark: (x1: number, y1: number, x2: number, y2: number, t: number) => void,
  /** план с картинки: допуск соосности шире и есть правило «торец к стене» */
  raster = false,
): number {
  const ось = (w: Plan["walls"][number]): "h" | "v" | null => {
    if (Math.abs(w.y2 - w.y1) < 1e-6 && Math.abs(w.x2 - w.x1) > 1e-6) return "h";
    if (Math.abs(w.x2 - w.x1) < 1e-6 && Math.abs(w.y2 - w.y1) > 1e-6) return "v";
    return null;
  };
  void ось;
  // Правило общее для ЛЮБОГО направления, не только по осям: у LA VIE половина
  // стен идёт под 45°, и осевая редакция не закрывала там ни одной двери —
  // открытая зона с витражным фасадом «утекала» на улицу. Два отрезка лежат на
  // одной прямой (направления параллельны, второй отстоит от прямой первого
  // не дальше 8 см), смотрят торцами друг на друга, между ними пусто.
  // У стекла закрывается и щель меньше двери: витражные панели чертят с
  // зазорами под импосты в 10–30 см, а двери в витраже — редкость; заливка
  // при клетке 5 см проходит и в такую щель.
  let closed = 0;
  // Один и тот же разрыв находится по нескольким парам отрезков (стена из
  // кусков, сведённые двойные линии): без учёта повторов LA VIE показывал
  // «разрывов 1022» при ~30 настоящих дверей — число человеку врало.
  const уже = new Set<string>();
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const adx = a.x2 - a.x1, ady = a.y2 - a.y1, al = Math.hypot(adx, ady);
    if (al < 1e-6) continue;
    const ux = adx / al, uy = ady / al;
    for (let j = i + 1; j < walls.length; j++) {
      const b = walls[j];
      const bdx = b.x2 - b.x1, bdy = b.y2 - b.y1, bl = Math.hypot(bdx, bdy);
      if (bl < 1e-6) continue;
      if (Math.abs(ux * bdy - uy * bdx) / bl > 0.03) continue; // не параллельны
      // расстояние концов b до прямой a
      const perp = (px: number, py: number) => Math.abs((px - a.x1) * uy - (py - a.y1) * ux);
      const допуск = raster ? 0.15 : 0.08; // на картинке оси одной стены гуляют на 5–10 px
      if (perp(b.x1, b.y1) > допуск || perp(b.x2, b.y2) > допуск) continue; // параллельны, но не на одной прямой
      const proj = (px: number, py: number) => (px - a.x1) * ux + (py - a.y1) * uy;
      const a0 = 0, a1 = al;
      const b0 = Math.min(proj(b.x1, b.y1), proj(b.x2, b.y2));
      const b1 = Math.max(proj(b.x1, b.y1), proj(b.x2, b.y2));
      const зазор = Math.max(a0, b0) - Math.min(a1, b1);
      const мин = a.glass || b.glass ? 0.02 : DOOR_MIN;
      if (зазор < мин || зазор > DOOR_MAX) continue;
      const от = Math.min(a1, b1), до = Math.max(a0, b0);
      const t = Math.max(a.thickness, b.thickness);
      const x1 = a.x1 + ux * от, y1 = a.y1 + uy * от, x2 = a.x1 + ux * до, y2 = a.y1 + uy * до;
      const ключ = [x1, y1, x2, y2].map((v) => Math.round(v / 0.1)).join(",");
      const обратный = [x2, y2, x1, y1].map((v) => Math.round(v / 0.1)).join(",");
      if (уже.has(ключ) || уже.has(обратный)) continue;
      уже.add(ключ);
      mark(x1, y1, x2, y2, t);
      closed++;
    }
  }
  // «Торец к стене» — только для плана с картинки. В векторе дверь чертят с простенками по
  // обе стороны, и правила «торец к торцу» хватает; на картинке короткий простенок (20–40 px)
  // отрезком не становится, и перегородка просто не доходит до поперечной стены на ширину
  // двери. LA VIE PNG 17.09: обе нижние спальни сливались с холлом в одну область 107 м².
  // Торец смотрит вдоль своей стены; ближайшая поперечная стена на 0.5–1.6 м — дверь.
  if (raster) for (const a of walls) {
    if (a.glass) continue;
    const al = Math.hypot(a.x2 - a.x1, a.y2 - a.y1); if (al < DOOR_MIN) continue; // обрывок дверь не держит
    const ux = (a.x2 - a.x1) / al, uy = (a.y2 - a.y1) / al;
    for (const end of [1, 2] as const) {
      const ex = end === 1 ? a.x1 : a.x2, ey = end === 1 ? a.y1 : a.y2, dir = end === 1 ? -1 : 1;
      let best = Infinity, bt = 0;
      for (const b of walls) {
        if (b === a) continue;
        const bl = Math.hypot(b.x2 - b.x1, b.y2 - b.y1); if (bl < 1e-6) continue;
        const vx = (b.x2 - b.x1) / bl, vy = (b.y2 - b.y1) / bl;
        const den = ux * vy - uy * vx;
        if (Math.abs(den) < 0.5) continue; // нужна поперечная стена, не попутная
        const t = (((b.x1 - ex) * vy - (b.y1 - ey) * vx) / den) * dir;
        const px = ex + ux * t * dir, py = ey + uy * t * dir;
        const sb = vx * (px - b.x1) + vy * (py - b.y1);
        if (sb < -b.thickness / 2 || sb > bl + b.thickness / 2) continue;
        const gap = t - b.thickness / 2;
        if (t > -a.thickness && gap < best) { best = gap; bt = t; }
      }
      // ближайшая преграда: ближе двери — торец уже примыкает; дальше — открытая зона
      if (best < DOOR_MIN || best > DOOR_MAX) continue;
      const x2 = ex + ux * bt * dir, y2 = ey + uy * bt * dir;
      const ключ = [ex, ey, x2, y2].map((v) => Math.round(v / 0.1)).join(",");
      if (уже.has(ключ)) continue;
      уже.add(ключ);
      mark(ex, ey, x2, y2, a.thickness);
      closed++;
    }
  }
  return closed;
}

/** Помечает клетки, накрытые отрезком стены с учётом толщины. */
function markWall(
  grid: Uint8Array, w: number, h: number,
  minX: number, minY: number,
  x1: number, y1: number, x2: number, y2: number,
  thickness: number,
  /** 1 — глухая стена (считается в периметр), 2 — стекло (граница, но не поверхность под отделку) */
  value: 1 | 2 = 1,
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1e-6) return;
  const steps = Math.ceil(len / (CELL / 2));
  // Полоса ПО ТОЛЩИНЕ стены, а не квадратная кисть. Кисть радиусом
  // ceil(t/2/CELL) клеток в обе стороны всегда шире стены (у 0.20 м выходило
  // 0.25 м), и лишнее съедалось из площади помещения с обеих сторон: замер
  // 23.09 — комната 5 x 4 со стеной 0.20 давала 17.8 м² вместо 18.24, то есть
  // смета занижала площадь на 2.3 %. Клетка считается стеной, если её ЦЕНТР
  // лежит внутри полосы: это несмещённая оценка площади по сетке.
  // Нижняя граница CELL * 0.6 не про красоту, а про герметичность: заливка
  // ходит по четырём соседям, и полосы в одну клетку ей уже не перейти.
  const halfW = Math.max(thickness / 2, CELL * 0.6);
  const R = Math.ceil(halfW / CELL) + 1;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const cx = Math.round((px - minX) / CELL);
    const cy = Math.round((py - minY) / CELL);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
        // расстояние от центра клетки до ОТРЕЗКА (не до точки шага)
        const wx = minX + gx * CELL, wy = minY + gy * CELL;
        const proj = Math.min(Math.max((wx - x1) * ux + (wy - y1) * uy, 0), len);
        const ddx = wx - (x1 + ux * proj), ddy = wy - (y1 + uy * proj);
        if (Math.hypot(ddx, ddy) >= halfW - 1e-9) continue;
        // глухая стена старше стекла: там, где витраж примыкает к стене, периметр считается
        if (grid[gy * w + gx] !== 1) grid[gy * w + gx] = value;
      }
    }
  }
}

/**
 * Находит комнаты в плане.
 *
 * `minAreaM2` отсекает щели между стенами: область меньше половины
 * квадратного метра — это не комната, а зазор из-за толщины линий.
 */
export function findRooms(plan: Plan, opts: { minAreaM2?: number } = {}): RoomsResult {
  const minArea = opts.minAreaM2 ?? 0.5;
  const warnings: string[] = [];

  if (plan.walls.length === 0) {
    return { rooms: [], totalArea: 0, warnings: ["В плане нет стен."], roomAt: () => null, runsOf: () => [] };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.x1, w.x2); minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  // поле на клетку шире габарита: заливка снаружи должна обойти план кругом
  const pad = 2;
  const gw = Math.ceil((maxX - minX) / CELL) + 1 + pad * 2;
  const gh = Math.ceil((maxY - minY) / CELL) + 1 + pad * 2;

  if (gw * gh > 4_000_000) {
    return {
      rooms: [],
      totalArea: 0,
      warnings: ["План слишком велик для разбивки на комнаты — проверьте масштаб."],
      roomAt: () => null,
      runsOf: () => [],
    };
  }

  const grid = new Uint8Array(gw * gh);
  const ox = minX - pad * CELL;
  const oy = minY - pad * CELL;
  for (const w of plan.walls) {
    markWall(grid, gw, gh, ox, oy, w.x1, w.y1, w.x2, w.y2, w.thickness, w.glass ? 2 : 1);
  }
  // Вторая сетка — ТОЛЬКО стены с ИЗМЕРЕННОЙ по чертежу толщиной. По ней видно,
  // что отделяет линия, которой толщину назначили мы сами: настоящее помещение
  // или шкаф. Пустая (все стены принятые) — правило ниже само не сработает.
  const твёрдая = new Uint8Array(gw * gh);
  for (const w of plan.walls) {
    if (w.assumed) continue;
    markWall(твёрдая, gw, gh, ox, oy, w.x1, w.y1, w.x2, w.y2, w.thickness, w.glass ? 2 : 1);
  }

  // Двери-разрывы закрываются ТОЛЬКО в сетке: сам план не меняется.
  // Разрывы считаются по КЛЕТКАМ, а не по парам отрезков: один проём находят
  // несколько пар (стена из кусков, сведённые двойные линии), и счётчик пар на
  // LA VIE говорил «1022», после дедупликации «293» при ~30 настоящих дверях.
  // Связная группа закрытых клеток, не лежащих на стене, — один проём.
  const закрытия = new Uint8Array(gw * gh);
  const стеныДо = grid.slice(); // одна копия на весь план, а не на каждый проём
  closeDoorGaps(plan.walls, (x1, y1, x2, y2, t) => {
    markWall(grid, gw, gh, ox, oy, x1, y1, x2, y2, t);
    markWall(закрытия, gw, gh, ox, oy, x1, y1, x2, y2, t);
  }, plan.source === "raster" || plan.looseWalls === true);
  for (let i = 0; i < закрытия.length; i++) if (стеныДо[i] !== 0) закрытия[i] = 0;
  let закрыто = 0;
  {
    const seen = new Uint8Array(gw * gh);
    for (let s = 0; s < закрытия.length; s++) {
      if (закрытия[s] === 0 || seen[s]) continue;
      закрыто++;
      const st = [s]; seen[s] = 1;
      while (st.length) {
        const i = st.pop() as number;
        const x = i % gw, y = (i - x) / gw;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (закрытия[j] === 1 && !seen[j]) { seen[j] = 1; st.push(j); }
        }
      }
    }
  }

  // --- мебель не режет помещение ------------------------------------------
  // В дизайн-проекте шкафы, ванны и кухонные блоки начерчены такими же тонкими
  // линиями, как перегородки, и заливка честно делит по ним комнату на куски:
  // замер 23.09 на альбоме — 32.39 м² по экспликации против 25.2 у самого
  // большого куска плюс осколки 4.1, 1.9, 1.2, 1.1.
  //
  // Признак структурный, а не пороговый: берём область, ограниченную ТОЛЬКО
  // измеренными по чертежу стенами, и смотрим, на что её режут линии с принятой
  // толщиной. Если внутри ровно один крупный кусок, а остальные мелкие — это
  // предметы внутри одного помещения, и линии убираются из сетки площадей.
  // Если крупных кусков два и больше — это настоящая перегородка, и она
  // остаётся. Когда измеренных стен нет вовсе, область одна на весь лист и
  // упирается в край — правило молчит само, гадать не на чем.
  for (let i = 0; i < закрытия.length; i++) if (закрытия[i] !== 0) твёрдая[i] = 1;
  {
    const КРУПНЫЙ = 5; // м²: помещение меньше пяти метров — это санузел, а не кусок
    const меткаA = new Int32Array(gw * gh).fill(-1);
    const площадьA: number[] = [];
    const залить = (сетка: Uint8Array, метка: Int32Array, start: number, id: number) => {
      const st = [start]; метка[start] = id;
      let n = 0; let край = false; const клетки: number[] = [];
      while (st.length) {
        const i = st.pop() as number;
        n++; клетки.push(i);
        const x = i % gw, y = (i - x) / gw;
        if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) край = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (сетка[j] !== 0 || метка[j] !== -1) continue;
          метка[j] = id; st.push(j);
        }
      }
      return { n, край, клетки };
    };
    for (let s = 0; s < grid.length; s++) {
      if (grid[s] !== 0 || меткаA[s] !== -1) continue;
      const r = залить(grid, меткаA, s, площадьA.length);
      площадьA.push(r.край ? -1 : r.n * CELL * CELL); // улица — отрицательная, в счёт не идёт
    }
    const меткаB = new Int32Array(gw * gh).fill(-1);
    let idB = 0;
    for (let s = 0; s < твёрдая.length; s++) {
      if (твёрдая[s] !== 0 || меткаB[s] !== -1) continue;
      const обл = залить(твёрдая, меткаB, s, idB++);
      if (обл.край) continue; // это улица
      const куски = new Set<number>();
      let мягких = 0;
      for (const i of обл.клетки) {
        if (grid[i] === 0) { if (меткаA[i] >= 0) куски.add(меткаA[i]); } else мягких++;
      }
      if (мягких === 0) continue; // резать нечем — правило ни при чём
      const площади = [...куски].map((k) => площадьA[k]);
      if (площади.some((a) => a < 0)) continue; // кусок сообщается с улицей — не трогаем
      if (площади.filter((a) => a >= КРУПНЫЙ).length !== 1) continue; // настоящая перегородка
      for (const i of обл.клетки) if (grid[i] !== 0) grid[i] = 0; // предметы убраны из сетки площадей
    }
  }

  // --- заливка ------------------------------------------------------------
  const label = new Int32Array(gw * gh).fill(-1);
  const rooms: Room[] = [];
  // Ссылка на ТОТ ЖЕ объект комнаты, а не копия номера: номера проставляются
  // после сортировки, и копия осталась бы нулём.
  const labelToRoom = new Map<number, Room>();
  let next = 0;
  let outsideTouched = false;

  for (let start = 0; start < grid.length; start++) {
    if (grid[start] !== 0 || label[start] !== -1) continue;
    const id = next++;
    const stack = [start];
    label[start] = id;
    let count = 0;
    let sumX = 0, sumY = 0;
    let touchesEdge = false;
    let border = 0;

    while (stack.length) {
      const i = stack.pop()!;
      const x = i % gw;
      const y = (i - x) / gw;
      count++;
      sumX += x; sumY += y;
      if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) touchesEdge = true;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) { border++; continue; }
        const j = ny * gw + nx;
        // стекло (2) — граница комнаты, но не поверхность: в периметр под отделку не идёт
        if (grid[j] !== 0) { if (grid[j] === 1) border++; continue; }
        if (label[j] !== -1) continue;
        label[j] = id;
        stack.push(j);
      }
    }

    if (touchesEdge) { outsideTouched = true; continue; } // это улица, а не комната
    const area = count * CELL * CELL;
    if (area < minArea) continue;
    const room = {
      index: 0, // проставится после сортировки
      area,
      perimeter: border * CELL,
      cx: ox + (sumX / count) * CELL,
      cy: oy + (sumY / count) * CELL,
    };
    rooms.push(room);
    labelToRoom.set(id, room);
  }

  rooms.sort((a, b) => b.area - a.area);
  rooms.forEach((r, i) => { r.index = i + 1; });

  if (rooms.length === 0) {
    warnings.push(
      outsideTouched
        ? "Замкнутых помещений не найдено — стены не образуют контур. Если план из картинки, поправьте линии на экране проверки."
        : "Помещений не найдено.",
    );
  }

  // Человек обязан знать про наше допущение: мы САМИ решили, что разрыв в
  // стене — это дверь, и посчитали площади так, будто он закрыт. Если он
  // ошибся и там настоящий проход между зонами, помещения надо считать одним.
  if (закрыто > 0) {
    warnings.push(
      `Разрывов в стенах шириной 0.5–1.6 м: ${закрыто}. Считаем их дверными `
      + "проёмами и разделяем помещения по ним — иначе комнаты слились бы в одну. "
      + "Если это открытый проход между зонами, площади соседних помещений "
      + "надо сложить.",
    );
  }

  const totalArea = rooms.reduce((s, r) => s + r.area, 0);

  // ⚠️ Замыкание УДЕРЖИВАЕТ разметку заливки, а не копию: прежде она умирала
  // вместе с вызовом. Цена посчитана, а не проигнорирована: у обычной квартиры
  // сетка ~100×100 клеток по 5 см, это 40 КБ; предел размера плана (4 млн
  // клеток) даёт худший случай 16 МБ, и живёт он ровно один — разметка
  // пересоздаётся при смене плана. Считать координаты заново вторым способом
  // было бы дороже и завело бы второй источник правды.
  const roomAt = (x: number, y: number): number | null => {
    const gx = Math.floor((x - ox) / CELL);
    const gy = Math.floor((y - oy) / CELL);
    if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return null;
    const room = labelToRoom.get(label[gy * gw + gx]);
    return room ? room.index : null;
  };

  const runsOf = (index: number): RoomRun[] => {
    const out: RoomRun[] = [];
    for (let gy = 0; gy < gh; gy++) {
      let start = -1;
      for (let gx = 0; gx <= gw; gx++) {
        const mine = gx < gw && labelToRoom.get(label[gy * gw + gx])?.index === index;
        if (mine && start < 0) start = gx;
        if (!mine && start >= 0) {
          out.push({ y: oy + (gy + 0.5) * CELL, x0: ox + start * CELL, x1: ox + gx * CELL });
          start = -1;
        }
      }
    }
    return out;
  };

  return { rooms, totalArea, warnings, roomAt, runsOf };
}
