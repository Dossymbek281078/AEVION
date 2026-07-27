/**
 * Сколько денег пришло СНАРУЖИ на момент снимка выручки.
 *
 * Вынесено из компонента после двух дефектов подряд 27.07.2026, и оба были
 * об одном: вычитать свои проверочные покупки можно ТОЛЬКО там, где они
 * действительно сидят внутри гросса.
 *
 * Снимки до правки хранят гросс вместе со своими покупками ($178.97), снимки
 * после — уже без них ($19.98). Безусловное вычитание нарисовало на графике
 * выручку −$139.01. Ни один тест этого не поймал: логика жила внутри JSX, и
 * увидел я её, открыв страницу после деплоя.
 */
export interface RevenuePoint {
  grossUsd: number;
  /** true — свои покупки входят в grossUsd и должны быть вычтены. */
  includesInternal?: boolean;
  /** Сумма своих покупок на момент снимка; null/undefined — неизвестна. */
  internalUsd?: number | null;
}

export function externalRevenueAt(point: RevenuePoint): number {
  if (!point.includesInternal) return point.grossUsd;
  return point.grossUsd - (point.internalUsd ?? 0);
}
