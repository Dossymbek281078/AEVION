/**
 * Долготная рамка страны: из двух рамок (шкала −180..180 и 0..360) берём узкую.
 * Простые min/max давали России −180..180 — центр у 0° (Северное море), и
 * /?country=Russia поворачивал глобус в море. Узкая рамка через 180° выходит
 * с west > east — этот случай понимают findCountryAt и облёт камеры.
 */
export function wrapAwareLonRange(
  west: number,
  east: number,
  west360: number,
  east360: number,
): [number, number] {
  if (east360 - west360 >= east - west) return [west, east];
  const back = (l: number) => (l > 180 ? l - 360 : l);
  return [back(west360), back(east360)];
}

/** Ширина долготной рамки в градусах; west > east — рамка через 180°. */
export function lonWidth(w: number, e: number): number {
  return w <= e ? e - w : e - w + 360;
}

/** Середина долготной рамки; west > east — рамка через 180°. */
export function bboxCenterLon(w: number, e: number): number {
  if (w <= e) return (w + e) / 2;
  let c = ((w + e + 360) / 2) % 360;
  if (c > 180) c -= 360;
  return c;
}
