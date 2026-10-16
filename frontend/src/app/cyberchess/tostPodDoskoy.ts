/**
 * Где на телефоне ставить тосты, чтобы они не ложились на доску.
 *
 * Повод (волна 140, кадр прода 16.10.2026, 390×844, /cyberchess?puzzle=): тост
 * «Задача по ссылке · 1053» стоял под шапкой 5,2 с и закрывал строку «Ход чёрных ·
 * Мат в 1» и верхний ряд доски (ладья h1 не видна). Это ровно те секунды, когда
 * новичок решает, что нажать. Низ окна занят кнопками партии и BottomNav
 * (решение 20.09), поэтому тост идёт ПОД доску, когда она в кадре и под ней
 * есть место; иначе — как раньше, под шапку.
 *
 * Чистая функция: вход — низ шапки, низ доски, высота окна; выход — top в px.
 */
export const ОТСТУП_ТОСТА = 8;
/** Высота тоста с запасом + нижняя навигация: ниже этой черты тост на телефоне не влезет. */
export const МЕСТО_ПОД_ТОСТ = 56 + 70;

export function verhTostaNaTelefone(opts: { shapkaNiz: number; doskaNiz: number | null; vh: number }): number {
  const podShapkoy = Math.round(Math.max(56, opts.shapkaNiz)) + ОТСТУП_ТОСТА;
  const d = opts.doskaNiz;
  if (d === null || !Number.isFinite(d)) return podShapkoy;
  const podDoskoy = Math.round(d) + ОТСТУП_ТОСТА;
  // Доска выше шапки (прокручена вверх) или под ней нет места — тост под шапку.
  if (podDoskoy <= podShapkoy) return podShapkoy;
  if (podDoskoy + МЕСТО_ПОД_ТОСТ > opts.vh) return podShapkoy;
  return podDoskoy;
}
