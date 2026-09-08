/**
 * QSpace — проверка расстановки: влезает ли мебель и можно ли ею пользоваться.
 *
 * Зачем. Модель делают, чтобы узнать «влезет ли» ДО покупки. Экран этого не
 * скажет: два предмета могут стоять друг в друге и выглядеть нормально с той
 * стороны, с которой смотришь, а дверь — не открываться, потому что перед ней
 * шкаф. Это и есть самые дорогие ошибки планировки: их находят, когда мебель
 * уже привезли.
 *
 * Считается на плоскости (вид сверху): для мебели этого достаточно — почти всё
 * стоит на полу. Высота учитывается отдельно, там где важна (потолок).
 *
 * 🔴 ЧЕСТНАЯ ГРАНИЦА, и она пишется человеку: это ПОДСКАЗКА, а не приёмка.
 * Предметы считаются прямоугольниками по габариту, поэтому круглый стол у
 * стены и угловой диван меряются с запасом. Замечание — повод посмотреть
 * глазами, а не приговор.
 */

import type { Opening, Plan, Wall } from "./planModel";
import { pointOnWall } from "./planModel";

export interface Placed {
  uid: number;
  name: string;
  /** центр в плане */
  x: number;
  y: number;
  /** поворот вокруг вертикали, радианы */
  rotY: number;
  /** габарит Ш×Г×В, м */
  size: [number, number, number];
}

export type IssueKind = "overlap" | "door-blocked" | "outside" | "passage";

export interface Issue {
  kind: IssueKind;
  /** кого касается — для подсветки */
  uids: number[];
  /** объяснение с числами, человеческими словами */
  text: string;
}

/** Прямоугольник предмета на плане, четыре угла с учётом поворота. */
function corners(p: Placed): Array<[number, number]> {
  const [w, d] = p.size;
  const c = Math.cos(p.rotY);
  const s = Math.sin(p.rotY);
  const hw = w / 2;
  const hd = d / 2;
  return [
    [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
  ].map(([dx, dy]) => [
    p.x + dx * c - dy * s,
    p.y + dx * s + dy * c,
  ] as [number, number]);
}

/**
 * Прямоугольник самой СТЕНЫ: отрезок, раздутый на её толщину.
 *
 * Нужен потому, что «за пределами плана» считается по ОСЯМ стен, а стена имеет
 * толщину: предмет можно вдвинуть в неё на полтолщины (у наружной 0.15 м) и не
 * получить ни слова, хотя в трёхмерном виде он торчит сквозь стену. Замер на
 * демо-расстановке: ванна сидела в стене на 25 мм при полном молчании сторожа.
 *
 * `shrink` — сколько прощаем: мебель ЗАКОННО стоит вплотную к стене, и придирка
 * к долям миллиметра сделала бы сторожа шумным, а шумного отключают.
 */
function wallRect(w: Wall, shrink = 0.02): Array<[number, number]> {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const L = Math.hypot(dx, dy) || 1;
  const hx = (-dy / L) * (w.thickness / 2 - shrink);
  const hy = (dx / L) * (w.thickness / 2 - shrink);
  return [
    [w.x1 + hx, w.y1 + hy], [w.x2 + hx, w.y2 + hy],
    [w.x2 - hx, w.y2 - hy], [w.x1 - hx, w.y1 - hy],
  ];
}

/** Пересечение двух выпуклых многоугольников по методу разделяющей оси. */
function overlaps(a: Array<[number, number]>, b: Array<[number, number]>): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      // нормаль к ребру
      const nx = -(y2 - y1);
      const ny = x2 - x1;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [px, py] of a) {
        const v = px * nx + py * ny;
        minA = Math.min(minA, v); maxA = Math.max(maxA, v);
      }
      for (const [px, py] of b) {
        const v = px * nx + py * ny;
        minB = Math.min(minB, v); maxB = Math.max(maxB, v);
      }
      if (maxA < minB || maxB < minA) return false; // нашлась разделяющая ось
    }
  }
  return true;
}

/** Зона перед дверью, которую нельзя занимать: ширина проёма × глубина открывания. */
function doorZone(w: Wall, o: Opening, depth: number): Array<[number, number]> {
  const a = pointOnWall(w, o.offset);
  const b = pointOnWall(w, o.offset + o.width);
  // нормаль к стене
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
  const nx = -(w.y2 - w.y1) / L;
  const ny = (w.x2 - w.x1) / L;
  // зона строится в ОБЕ стороны: с какой открывается дверь, мы не знаем
  return [
    [a.x - nx * depth, a.y - ny * depth],
    [b.x - nx * depth, b.y - ny * depth],
    [b.x + nx * depth, b.y + ny * depth],
    [a.x + nx * depth, a.y + ny * depth],
  ];
}

function planBox(plan: Plan) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.x1, w.x2); minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Проверка расстановки.
 *
 * `doorDepth` — сколько места нужно перед дверью, чтобы ею пользоваться.
 * По умолчанию 0.9 м: створка стандартной двери плюс место человеку.
 */
export function checkClearance(
  plan: Plan,
  items: Placed[],
  opts: { doorDepth?: number } = {},
): Issue[] {
  const doorDepth = opts.doorDepth ?? 0.9;
  const issues: Issue[] = [];
  const polys = new Map<number, Array<[number, number]>>();
  for (const it of items) polys.set(it.uid, corners(it));

  // --- 1. предметы друг в друге ------------------------------------------
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      // ковёр и картина лежат/висят — под ними и над ними стоять можно
      if (isFlat(A) || isFlat(B)) continue;
      if (overlaps(polys.get(A.uid)!, polys.get(B.uid)!)) {
        issues.push({
          kind: "overlap",
          uids: [A.uid, B.uid],
          text: `«${A.name}» и «${B.name}» стоят друг в друге — вместе они не встанут.`,
        });
      }
    }
  }

  // --- 2. мебель перед дверью --------------------------------------------
  for (const o of plan.openings) {
    if (o.kind !== "door") continue;
    const w = plan.walls[o.wall];
    if (!w) continue;
    const zone = doorZone(w, o, doorDepth);
    for (const it of items) {
      if (isFlat(it)) continue;
      if (overlaps(polys.get(it.uid)!, zone)) {
        issues.push({
          kind: "door-blocked",
          uids: [it.uid],
          text: `«${it.name}» стоит перед дверью — нужно ${doorDepth.toFixed(1)} м, чтобы она открывалась и можно было пройти.`,
        });
      }
    }
  }

  // --- 3. предмет вылез за пределы плана ----------------------------------
  const b = planBox(plan);
  for (const it of items) {
    const cs = polys.get(it.uid)!;
    const out = cs.some(([x, y]) => x < b.minX - 0.05 || x > b.maxX + 0.05 || y < b.minY - 0.05 || y > b.maxY + 0.05);
    if (out) {
      issues.push({
        kind: "outside",
        uids: [it.uid],
        text: `«${it.name}» вышел за пределы плана — перетащите внутрь.`,
      });
      continue; // уже сказали про этот предмет — второе замечание было бы шумом
    }
    // Внутри плана, но ВНУТРИ СТЕНЫ. Отдельный случай: границы плана проходят
    // по осям стен, поэтому предмет, наполовину утопленный в стену, проходил
    // проверку выше и молча торчал сквозь стену в трёхмерном виде.
    const inWall = plan.walls.some((w) => overlaps(cs, wallRect(w)));
    if (inWall) {
      issues.push({
        kind: "outside",
        uids: [it.uid],
        text: `«${it.name}» заходит в стену — отодвиньте, вплотную можно, внутрь нельзя.`,
      });
    }
  }

  // --- 4. предмет выше потолка --------------------------------------------
  for (const it of items) {
    const wallH = plan.walls[0]?.height ?? 2.7;
    if (it.size[2] > wallH) {
      issues.push({
        kind: "passage",
        uids: [it.uid],
        text: `«${it.name}» высотой ${it.size[2].toFixed(2)} м не встанет: высота помещения ${wallH.toFixed(2)} м.`,
      });
    }
  }

  return issues;
}

/** Плоское — то, что лежит на полу или висит: ковёр, картина. */
function isFlat(p: Placed): boolean {
  return p.size[2] <= 0.06;
}
