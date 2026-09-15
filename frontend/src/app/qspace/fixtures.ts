import type { RoomType } from "./roomTypes";
import type { Placement } from "./autoPlace";

/**
 * Сантехника и мебель С ЧЕРТЕЖА, а не «по стилю».
 *
 * Основатель 15.09: «там же были указаны места для моек, мебели и прочее, что
 * тоже не отображено». На слоях «Мебель», «Меbель», «a-tefriş» (LA VIE: 4358,
 * 350 и 916 линий) лежат блоки CAD — унитаз, ванна, кровать, гарнитур.
 * Блок — пучок линий со сходящимися концами (в LA VIE медиана длины линии
 * 4.7 см: контуры из дуг, прямоугольников по 4 линии там нет); его габарит и
 * комната говорят, что это. Расстановка по стилю после этого только ДОБИРАЕТ
 * то, чего на чертеже нет.
 */

export interface Отрезок { x1: number; y1: number; x2: number; y2: number; layer?: string }

/** Габарит блока в метрах: x0..x1 по оси x, y0..y1 по оси y плана; n — линий в блоке. */
export interface Блок { x0: number; y0: number; x1: number; y1: number; n: number }

/** Слой мебели/сантехники: кириллица, латиница и смешанная «Меbель» из LA VIE. */
export function isFurnitureLayer(name: string): boolean {
  return /(меб|mеб|меb|furn|tefri|сантех|sanit|plumb|equip|обору|kitchen|bath)/i.test(name);
}

/**
 * Соседство концов: линии, чьи концы ближе eps, — один блок (union-find по сетке).
 * Допуск 4 см — замер на LA VIE 15.09: при 6 см кровать с тумбочками и ковром
 * слипалась в один блок 3.8×2.6 м, при 2.5 см унитаз и гарнитур рассыпались.
 */
export function блокиИзЛиний(segs: Отрезок[], eps = 0.04): Блок[] {
  const n = segs.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const сетка = new Map<string, number[]>();
  const ключ = (x: number, y: number) => `${Math.floor(x / eps)}:${Math.floor(y / eps)}`;
  const концы = (i: number): Array<[number, number]> => [[segs[i].x1, segs[i].y1], [segs[i].x2, segs[i].y2]];
  segs.forEach((_, i) => { for (const [x, y] of концы(i)) { const k = ключ(x, y); const l = сетка.get(k); if (l) l.push(i); else сетка.set(k, [i]); } });
  segs.forEach((_, i) => {
    for (const [x, y] of концы(i)) {
      const cx = Math.floor(x / eps), cy = Math.floor(y / eps);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const j of сетка.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (j <= i) continue;
          if (концы(j).some(([qx, qy]) => Math.hypot(qx - x, qy - y) <= eps)) union(i, j);
        }
      }
    }
  });
  const группы = new Map<number, Блок>();
  segs.forEach((s, i) => {
    const r = find(i);
    const b = группы.get(r);
    const x0 = Math.min(s.x1, s.x2), x1 = Math.max(s.x1, s.x2), y0 = Math.min(s.y1, s.y2), y1 = Math.max(s.y1, s.y2);
    if (!b) группы.set(r, { x0, y0, x1, y1, n: 1 });
    else { b.x0 = Math.min(b.x0, x0); b.x1 = Math.max(b.x1, x1); b.y0 = Math.min(b.y0, y0); b.y1 = Math.max(b.y1, y1); b.n++; }
  });
  return [...группы.values()];
}

/**
 * Что это за блок — по габариту (длинная × короткая сторона, м) и комнате.
 * Размеры взяты из ГОСТ/каталогов: унитаз 0.36×0.65 (в LA VIE 0.29×0.60),
 * ванна 1.7×0.75, кровать 1.6×2.0, гарнитур глубиной 0.6. Возвращает id
 * каталога или null.
 */
export function классифицироватьБлок(w: number, d: number, room: RoomType | null): string | null {
  const L = Math.max(w, d), S = Math.min(w, d);
  const в = (a: number, b: number, v: number) => v >= a && v <= b;
  if (room === "bath") {
    if (в(1.35, 1.95, L) && в(0.6, 0.95, S)) return "bathtub";
    if (в(0.75, 1.35, L) && в(0.75, 1.35, S) && L / S < 1.4) return "shower";
    if (в(0.55, 0.82, L) && в(0.26, 0.5, S)) return "toilet";
    if (в(0.7, 1.35, L) && в(0.4, 0.62, S)) return "vanity";
    if (в(0.36, 0.7, L) && в(0.26, 0.58, S)) return "sink";
    if (в(0.55, 0.7, L) && в(0.55, 0.7, S)) return "washer";
    return null;
  }
  if (room === "kitchen") {
    if (в(0.5, 0.9, S) && L >= 1.4 && L <= 4.5) return "kitchen";
    if (в(0.55, 0.8, L) && в(0.55, 0.8, S)) return "fridge";
    if (в(1.2, 2.8, L) && в(0.7, 1.4, S)) return "dining";
    if (в(1.0, 1.3, L) && в(1.0, 1.3, S)) return "dining-round";
    return null;
  }
  if (room === "bedroom") {
    if (в(1.7, 2.3, L) && в(1.2, 2.0, S)) return "bed";
    if (в(1.9, 2.2, L) && в(0.75, 1.15, S)) return "bed-single";
    if (в(0.5, 0.7, S) && L >= 2.0 && L <= 4.0) return "wardrobe-sliding";
    if (в(0.5, 0.7, S) && в(1.0, 2.0, L)) return "wardrobe";
    if (в(1.1, 1.8, L) && в(0.55, 0.8, S)) return "desk";
    if (в(0.4, 0.6, L) && в(0.35, 0.5, S)) return "nightstand";
    return null;
  }
  if (room === "living") {
    if (в(2.2, 3.4, L) && в(1.5, 2.1, S)) return "sofa-corner";
    if (в(1.6, 3.2, L) && в(0.8, 1.1, S)) return "sofa";
    if (в(0.7, 1.0, L) && в(0.7, 1.0, S)) return "armchair";
    if (в(1.2, 2.8, L) && в(0.7, 1.3, S)) return "dining";
    if (в(1.2, 2.0, L) && в(0.3, 0.5, S)) return "tv";
    return null;
  }
  if (room === "hall") {
    if (в(0.5, 0.7, S) && L >= 2.0 && L <= 4.0) return "wardrobe-sliding";
    if (в(0.5, 0.7, S) && в(1.0, 2.0, L)) return "wardrobe";
    if (в(0.55, 0.7, L) && в(0.55, 0.7, S)) return "washer";
    return null;
  }
  return null;
}

/**
 * Линии слоёв мебели (уже в метрах плана) → расстановка по каталогу.
 * Блок ставится в ту комнату, где его центр; поворот — чтобы длинная сторона
 * блока совпала с длинной стороной предмета каталога. Неузнанные блоки
 * (стулья, ковры, полки, слипшиеся группы) отдаются в unknown и не ставятся:
 * лишний предмет в модели хуже пропущенного.
 */
export function fixturesFromSegments(
  segs: Отрезок[],
  roomAt: (x: number, y: number) => number | null,
  types: Record<number, RoomType>,
  sizeOf: (catalogId: string) => [number, number, number] | undefined,
): { items: Placement[]; blocks: number; unknown: Блок[] } {
  const свои = segs.filter((s) => !s.layer || isFurnitureLayer(s.layer));
  const блоки = блокиИзЛиний(свои)
    .filter((b) => b.n >= 6 && (b.x1 - b.x0) >= 0.25 && (b.y1 - b.y0) >= 0.25 && (b.x1 - b.x0) <= 4.5 && (b.y1 - b.y0) <= 4.5);
  const items: Placement[] = [];
  const unknown: Блок[] = [];
  const занято: Блок[] = [];
  for (const b of блоки) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const room = roomAt(cx, cy);
    if (room === null) continue;
    const bw = b.x1 - b.x0, bd = b.y1 - b.y0;
    const id = классифицироватьБлок(bw, bd, types[room] ?? null);
    if (!id) { unknown.push(b); continue; }
    if (занято.some((z) => cx > z.x0 && cx < z.x1 && cy > z.y0 && cy < z.y1)) continue; // центр внутри уже поставленного
    const size = sizeOf(id);
    if (!size) continue;
    const rotY = (bw >= bd) === (size[0] >= size[1]) ? 0 : Math.PI / 2;
    items.push({ catalogId: id, x: cx, z: cy, rotY, room });
    занято.push(b);
  }
  return { items, blocks: блоки.length, unknown };
}
