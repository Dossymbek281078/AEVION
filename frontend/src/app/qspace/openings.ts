/**
 * QSpace — добавление проёмов (окон и дверей) в загруженный план.
 *
 * Зачем отдельно. Из DXF, PDF и картинки приходят ТОЛЬКО стены: проёмы там
 * рисуют блоками, дугами и разрывами линий, и надёжно распознать их нельзя.
 * Значит либо у загруженного плана окон и дверей нет вовсе (и модель врёт
 * молча — глухая коробка вместо квартиры), либо человек ставит их сам.
 *
 * Здесь — расчёт «куда попал клик»: точка в плане приводится к ближайшей
 * стене и к отступу вдоль неё, а дальше проверяется, влезает ли проём и не
 * налезает ли на соседний.
 */

import type { Opening, Plan, Wall } from "./planModel";

export interface Hit {
  /** индекс стены */
  wall: number;
  /** отступ вдоль стены от её начала, м */
  t: number;
  /** расстояние от точки до стены, м */
  distance: number;
}

function wallLen(w: Wall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

/**
 * Ближайшая к точке стена и место на ней.
 *
 * Возвращает null, если ближе `maxDistance` стен нет: «мимо» — это отдельный
 * исход, а не «первая стена». Иначе клик в пустоту молча ставил бы дверь.
 */
export function nearestWall(plan: Plan, x: number, y: number, maxDistance = 0.6): Hit | null {
  let best: Hit | null = null;
  plan.walls.forEach((w, i) => {
    const L = wallLen(w);
    if (L < 0.01) return;
    const dx = (w.x2 - w.x1) / L;
    const dy = (w.y2 - w.y1) / L;
    let t = (x - w.x1) * dx + (y - w.y1) * dy;
    t = Math.max(0, Math.min(L, t));
    const px = w.x1 + dx * t;
    const py = w.y1 + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d <= maxDistance && (best === null || d < best.distance)) {
      best = { wall: i, t, distance: d };
    }
  });
  return best;
}

export type PlaceResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: string };

/** Типовые размеры; человек может их поменять, но по умолчанию — практика. */
export const PRESETS = {
  door: { width: 0.9, height: 2.05, sill: 0 },
  window: { width: 1.4, height: 1.45, sill: 0.85 },
} as const;

/**
 * Ставит проём по центру в точке `t` на стене.
 *
 * Отказ всегда объяснён словами: «стена короче проёма», «не влезает по краю»,
 * «пересекается с соседним». Молчаливый отказ здесь читался бы как «клик не
 * сработал», и человек кликал бы снова.
 */
export function placeOpening(
  plan: Plan,
  hit: Hit,
  kind: "door" | "window",
  size: { width: number; height: number; sill: number } = PRESETS[kind],
): PlaceResult {
  const w = plan.walls[hit.wall];
  if (!w) return { ok: false, reason: "Такой стены в плане нет." };

  const L = wallLen(w);
  const margin = 0.1; // проём не вплотную к углу — иначе перемычке не на что опереться
  if (size.width + margin * 2 > L) {
    return {
      ok: false,
      reason: `Стена ${L.toFixed(2)} м — ${kind === "door" ? "дверь" : "окно"} шириной ${size.width} м сюда не встанет.`,
    };
  }
  if (size.sill + size.height > w.height) {
    return {
      ok: false,
      reason: `Проём выше стены: ${(size.sill + size.height).toFixed(2)} м при высоте ${w.height} м.`,
    };
  }

  let offset = hit.t - size.width / 2;
  offset = Math.max(margin, Math.min(L - size.width - margin, offset));

  for (const o of plan.openings) {
    if (o.wall !== hit.wall) continue;
    const a1 = offset, a2 = offset + size.width;
    const b1 = o.offset, b2 = o.offset + o.width;
    if (a1 < b2 && b1 < a2) {
      return { ok: false, reason: "Здесь уже есть проём — поставьте рядом или уберите прежний." };
    }
  }

  const added: Opening = {
    wall: hit.wall,
    offset,
    width: size.width,
    height: size.height,
    sill: size.sill,
    kind,
  };
  return { ok: true, plan: { ...plan, openings: [...plan.openings, added] } };
}

/** Убирает проём, ближайший к точке на той же стене. */
export function removeOpeningNear(plan: Plan, hit: Hit): PlaceResult {
  let bestIdx = -1;
  let bestD = Infinity;
  plan.openings.forEach((o, i) => {
    if (o.wall !== hit.wall) return;
    const centre = o.offset + o.width / 2;
    const d = Math.abs(centre - hit.t);
    if (d < bestD) { bestD = d; bestIdx = i; }
  });
  if (bestIdx < 0) return { ok: false, reason: "На этой стене проёмов нет." };
  const openings = plan.openings.filter((_, i) => i !== bestIdx);
  return { ok: true, plan: { ...plan, openings } };
}
