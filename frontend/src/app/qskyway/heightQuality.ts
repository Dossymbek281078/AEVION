/**
 * Доля участков коридора, где здание под крылом стоит на ГОРОДСКОМ ОБМЕРЕ.
 *
 * Отдельной функцией, потому что цифру показывают два места — телеметрия рейса
 * и карточка подписанного обоснования, — и разошедшиеся округления в них
 * означали бы, что продукт называет одну величину двумя числами. Ровно эту
 * болезнь модуль и лечит в данных, так что заводить её в своей же вёрстке
 * было бы странно.
 *
 * null означает «спрашивать не о чем»: под коридором вообще нет зданий, и
 * «0% обмерено» тут было бы обвинением в адрес пустого поля.
 */
export function measuredObstaclePct(
  obstacleSegments: number | null | undefined,
  measuredObstacleSegments: number | null | undefined,
): number | null {
  if (obstacleSegments == null || obstacleSegments <= 0) return null;
  const measured = measuredObstacleSegments ?? 0;
  return Math.round((100 * measured) / obstacleSegments);
}
