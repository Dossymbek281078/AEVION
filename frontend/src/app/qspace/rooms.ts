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
}

const CELL = 0.05; // 5 см — компромисс между точностью и объёмом работы

/** Помечает клетки, накрытые отрезком стены с учётом толщины. */
function markWall(
  grid: Uint8Array, w: number, h: number,
  minX: number, minY: number,
  x1: number, y1: number, x2: number, y2: number,
  thickness: number,
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1e-6) return;
  const steps = Math.ceil(len / (CELL / 2));
  const r = Math.max(1, Math.ceil(thickness / 2 / CELL));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const cx = Math.round((px - minX) / CELL);
    const cy = Math.round((py - minY) / CELL);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
        grid[gy * w + gx] = 1;
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
    return { rooms: [], totalArea: 0, warnings: ["В плане нет стен."], roomAt: () => null };
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
    };
  }

  const grid = new Uint8Array(gw * gh);
  const ox = minX - pad * CELL;
  const oy = minY - pad * CELL;
  for (const w of plan.walls) {
    markWall(grid, gw, gh, ox, oy, w.x1, w.y1, w.x2, w.y2, w.thickness);
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
    if (grid[start] === 1 || label[start] !== -1) continue;
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
        if (grid[j] === 1) { border++; continue; }
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

  return { rooms, totalArea, warnings, roomAt };
}
