// Геометрические утилиты для AI-проверок.

import type { RoomGeometry } from "../types";

/** Площадь стен с учётом всех openings (брутто). */
export function grossWallArea(g: RoomGeometry): number {
  return 2 * (g.length + g.width) * g.height;
}

/** Суммарная площадь проёмов. */
export function totalOpeningsArea(g: RoomGeometry): number {
  return g.openings.reduce((s, o) => s + o.width * o.height * o.count, 0);
}

/** Площадь стен нетто (с вычетом проёмов). */
export function netWallArea(g: RoomGeometry): number {
  return grossWallArea(g) - totalOpeningsArea(g);
}

/** Периметр откосов проёмов (площадь = периметр × ширина откоса). */
export function openingsRevealsArea(g: RoomGeometry, revealWidth = 0.2): number {
  return g.openings.reduce((s, o) => {
    // Для окна: периметр - ширина (низ окна без откоса) или весь периметр?
    // Учебно: считаем 3 стороны для окна, 3 стороны для двери (низ без откоса).
    const perimeter3sides = (o.width + o.height + o.height) * o.count;
    return s + perimeter3sides * revealWidth;
  }, 0);
}

/** Площадь пола / потолка. */
export function floorArea(g: RoomGeometry): number {
  return g.length * g.width;
}
