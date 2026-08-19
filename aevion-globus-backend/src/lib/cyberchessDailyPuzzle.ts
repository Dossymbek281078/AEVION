/* Выбор «пазла дня» — один и тот же для всех игроков.
 *
 * Раньше он выбирался на клиенте как `POOL[индекс_от_номера_суток]`. Пул приходит с
 * `shuffle=1`, то есть своя случайная выборка и свой порядок на каждый запрос: два
 * запроса подряд по 2000 задач совпали ровно в 0 позициях. Значит пазл дня менялся при
 * каждой перезагрузке страницы, а «решён сегодня» сравнивалось уже с другим пазлом.
 *
 * Выбор не должен зависеть от порядка. Здесь берётся МИНИМУМ хеша FEN, сдвинутого
 * номером суток: результат один и тот же при любой перестановке пула, меняется раз в
 * сутки и одинаков у всех, кто смотрит на один и тот же пул. Сортировка не нужна —
 * один проход.
 */

/** Номер суток от эпохи. Вынесен параметром, чтобы тест не зависел от «сегодня». */
export function dayNumber(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

/** FNV-1a, 32 бита. Тот же, что на клиенте для ключа решённых позиций. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Детерминированный выбор одной задачи из пула на сутки `day`.
 * Возвращает null для пустого пула — вызывающий решает, что показать.
 */
export function pickDailyPuzzle<T extends { fen: string }>(pool: readonly T[], day: number): T | null {
  if (!pool.length) return null;
  const seed = Math.imul(day, 2654435761) >>> 0;
  let best: T | null = null;
  let bestKey = Number.POSITIVE_INFINITY;
  for (const p of pool) {
    const key = (fnv1a(p.fen) ^ seed) >>> 0;
    // При равенстве ключей побеждает меньший FEN — иначе результат зависел бы от порядка
    if (key < bestKey || (key === bestKey && best !== null && p.fen < best.fen)) {
      bestKey = key;
      best = p;
    }
  }
  return best;
}
