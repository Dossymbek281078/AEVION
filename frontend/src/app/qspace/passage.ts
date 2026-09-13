/**
 * QSpace — проверка проходимости: можно ли добраться от двери до всей комнаты.
 *
 * Зачем именно так. Напрашивается «зазор между предметами меньше 60 см —
 * ошибка», но это машина ложных тревог: тумбочка у кровати стоит вплотную ПО
 * ДЕЛУ, стул придвинут к столу, шкаф прижат к стене. Сторож, который краснеет
 * на правильной расстановке, приучает себя не читать.
 *
 * Поэтому проверяется то, что ошибкой является всегда: мебель перегородила
 * проход, и до части комнаты не дойти. «Шкаф перекрыл вход в спальню» —
 * настоящая ошибка планировки, а «тумбочка близко к кровати» — нет.
 *
 * Считается той же заливкой, что и комнаты: сетка 5 см, занято = стена или
 * мебель, старт от дверей. Свободная область, до которой не дошли, — отрезана.
 *
 * 🔴 ГРАНИЦА: человек проходит там, где помещается его ширина. Порог берём
 * 55 см — это узкий, но проходимый зазор; всё уже него считается стеной.
 * Мебель ниже 40 см (ковёр, журнальный стол) через себя пропускает: через них
 * переступают.
 */

import type { Plan } from "./planModel";
import { pointOnWall } from "./planModel";
import type { Placed } from "./clearance";

export interface PassageIssue {
  /** площадь отрезанного куска, м² */
  area: number;
  /** центр отрезанного куска — куда смотреть */
  cx: number;
  cy: number;
  text: string;
}

export interface PassageResult {
  issues: PassageIssue[];
  /** сколько площади доступно от дверей, м² */
  reachableArea: number;
  warnings: string[];
}

const CELL = 0.05;
/** Ниже этой высоты предмет проходим — через него переступают. */
const STEP_OVER_H = 0.4;
/** Куски меньше этого не считаем: это щели, а не «часть комнаты». */
const MIN_CUT_AREA = 1.0;

function corners(p: Placed): Array<[number, number]> {
  const [w, d] = p.size;
  const c = Math.cos(p.rotY);
  const s = Math.sin(p.rotY);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(
    ([dx, dy]) => [p.x + dx * c - dy * s, p.y + dx * s + dy * c] as [number, number],
  );
}

/** Точка внутри выпуклого четырёхугольника. */
function inside(poly: Array<[number, number]>, x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (sign !== s) return false;
  }
  return true;
}

export function checkPassage(plan: Plan, items: Placed[]): PassageResult {
  const warnings: string[] = [];
  const doors = plan.openings.filter((o) => o.kind === "door");
  if (doors.length === 0) {
    return {
      issues: [],
      reachableArea: 0,
      warnings: ["Дверей в плане нет — от чего считать проход, неизвестно. Поставьте дверь."],
    };
  }
  if (plan.walls.length === 0) {
    return { issues: [], reachableArea: 0, warnings: ["В плане нет стен."] };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.x1, w.x2); minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  const pad = 2;
  const gw = Math.ceil((maxX - minX) / CELL) + 1 + pad * 2;
  const gh = Math.ceil((maxY - minY) / CELL) + 1 + pad * 2;
  if (gw * gh > 4_000_000) {
    return { issues: [], reachableArea: 0, warnings: ["План слишком велик для проверки прохода."] };
  }
  const ox = minX - pad * CELL;
  const oy = minY - pad * CELL;
  const blocked = new Uint8Array(gw * gh);

  // --- стены (проёмы вычитаются: через дверь ходят) ------------------------
  for (const w of plan.walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (len < 1e-6) continue;
    const holes = plan.openings
      .filter((o) => plan.walls[o.wall] === w && o.kind === "door")
      .map((o) => [o.offset, o.offset + o.width] as [number, number]);
    const steps = Math.ceil(len / (CELL / 2));
    const r = Math.max(1, Math.ceil(w.thickness / 2 / CELL));
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * len;
      if (holes.some(([a, b]) => t >= a && t <= b)) continue; // дверной проём
      const p = pointOnWall(w, t);
      const cx = Math.round((p.x - ox) / CELL);
      const cy = Math.round((p.y - oy) / CELL);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = cx + dx, gy = cy + dy;
          if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
          blocked[gy * gw + gx] = 1;
        }
      }
    }
  }

  // --- мебель выше 40 см ---------------------------------------------------
  for (const it of items) {
    if (it.size[2] <= STEP_OVER_H) continue;
    const poly = corners(it);
    let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
    for (const [x, y] of poly) {
      ix0 = Math.min(ix0, x); iy0 = Math.min(iy0, y);
      ix1 = Math.max(ix1, x); iy1 = Math.max(iy1, y);
    }
    for (let gy = Math.floor((iy0 - oy) / CELL); gy <= Math.ceil((iy1 - oy) / CELL); gy++) {
      for (let gx = Math.floor((ix0 - ox) / CELL); gx <= Math.ceil((ix1 - ox) / CELL); gx++) {
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
        if (inside(poly, ox + gx * CELL, oy + gy * CELL)) blocked[gy * gw + gx] = 1;
      }
    }
  }

  // --- старт от дверей -----------------------------------------------------
  const starts: number[] = [];
  for (const o of doors) {
    const w = plan.walls[o.wall];
    if (!w) continue;
    const mid = pointOnWall(w, o.offset + o.width / 2);
    const gx = Math.round((mid.x - ox) / CELL);
    const gy = Math.round((mid.y - oy) / CELL);
    // дверь может попасть на клетку стены — ищем свободную рядом
    for (let r = 0; r <= 8; r++) {
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const x = gx + dx, y = gy + dy;
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          if (blocked[y * gw + x] === 0) { starts.push(y * gw + x); found = true; }
        }
      }
      if (found) break;
    }
  }
  if (starts.length === 0) {
    return {
      issues: [],
      reachableArea: 0,
      warnings: ["От дверей не найдено ни одной свободной точки — возможно, проходы полностью перекрыты."],
    };
  }

  // --- заливка от дверей ---------------------------------------------------
  const seen = new Uint8Array(gw * gh);
  const stack = [...starts];
  for (const s of starts) seen[s] = 1;
  let reached = 0;
  while (stack.length) {
    const i = stack.pop()!;
    reached++;
    const x = i % gw;
    const y = (i - x) / gw;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const j = ny * gw + nx;
      if (blocked[j] === 1 || seen[j] === 1) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }

  // --- что осталось недостижимым (и не улица) ------------------------------
  const issues: PassageIssue[] = [];
  const label = new Uint8Array(gw * gh);
  for (let start = 0; start < blocked.length; start++) {
    if (blocked[start] === 1 || seen[start] === 1 || label[start] === 1) continue;
    const st = [start];
    label[start] = 1;
    let count = 0, sx = 0, sy = 0, edge = false;
    while (st.length) {
      const i = st.pop()!;
      const x = i % gw;
      const y = (i - x) / gw;
      count++; sx += x; sy += y;
      if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (blocked[j] === 1 || seen[j] === 1 || label[j] === 1) continue;
        label[j] = 1;
        st.push(j);
      }
    }
    if (edge) continue; // это улица снаружи плана
    const area = count * CELL * CELL;
    if (area < MIN_CUT_AREA) continue;
    issues.push({
      area,
      cx: ox + (sx / count) * CELL,
      cy: oy + (sy / count) * CELL,
      text: `До куска площадью ${area.toFixed(1)} м² не дойти от двери — мебель перегородила проход.`,
    });
  }

  return { issues, reachableArea: reached * CELL * CELL, warnings };
}
