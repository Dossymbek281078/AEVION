import type { Wall } from "./planModel";

/**
 * Какие комнаты лежат по обе стороны отрезка стены.
 *
 * `plus` — комната со стороны нормали (-dy, dx), `minus` — с противоположной.
 * В сцене коробка стены поворачивается на -atan2(dy, dx), и её локальная грань
 * +z смотрит ровно в сторону этой нормали — поэтому материал `plus` идёт на
 * грань 4, `minus` — на грань 5 (порядок граней BoxGeometry: ±x, ±y, ±z).
 * Точка опроса — на 12 см за гранью: внутри толщины стены разметка комнат
 * отвечает «стена», а не «комната».
 */
export function roomsBesideWall(
  w: Pick<Wall, "x1" | "y1" | "x2" | "y2" | "thickness">,
  from: number,
  to: number,
  roomAt: (x: number, y: number) => number | null,
): { plus: number | null; minus: number | null } {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const dl = Math.hypot(dx, dy) || 1;
  const nx = -dy / dl, ny = dx / dl;
  const off = w.thickness / 2 + 0.12;
  // Три точки вдоль отрезка, а не одна середина: в середину наружной стены
  // часто упирается перегородка, и там разметка отвечает «стена», а не
  // «комната» — грань осталась бы без своей комнаты (поймано тестом).
  const опрос = (s: number): number | null => {
    for (const доля of [0.5, 0.25, 0.75]) {
      const at = from + (to - from) * доля;
      const mx = w.x1 + (dx / dl) * at, my = w.y1 + (dy / dl) * at;
      const r = roomAt(mx + nx * off * s, my + ny * off * s);
      if (r !== null) return r;
    }
    return null;
  };
  return { plus: опрос(1), minus: опрос(-1) };
}
