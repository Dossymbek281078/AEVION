/* Запрос к банку задач по текущим фильтрам.
 *
 * Клиент держит в памяти выборку из банка (до 20 000 из 500 000) и фильтрует её
 * у себя. Пока фильтр широкий, разницы нет. Стоит сузить — например, взять редкую
 * тему в узком диапазоне рейтинга, — и выборка пустеет, хотя в банке таких задач
 * тысячи. Интерфейс при этом говорил «Нет задач по фильтру», то есть утверждал
 * отсутствие, которого не проверял.
 *
 * Бэкенд умеет фильтровать сам (theme, phase, minRating, maxRating), поэтому пустой
 * результат — повод сходить в банк, а не повод объявить, что задач нет.
 *
 * Здесь только сборка запроса: чистая функция, проверяется без сети.
 */

export type PuzzleFilters = {
  theme?: string;
  phase?: string;
  rating?: [number, number];
  limit?: number;
};

/** «all» и пустая строка означают «фильтр не выбран» — такие в запрос не идут. */
const isSet = (v: string | undefined): v is string => !!v && v !== "all";

/** Максимум, который принимает бэкенд. Больше просить бессмысленно — он обрежет. */
const MAX_LIMIT = 25_000;

/**
 * Строит строку запроса к `/api/cyberchess-puzzles`.
 * Границы рейтинга нормализуются: перепутанные местами меняются обратно,
 * нечисловые отбрасываются — иначе сервер молча вернёт пустой список, и мы снова
 * скажем игроку «задач нет», не проверив.
 */
export function buildPuzzleQuery(f: PuzzleFilters): string {
  const p = new URLSearchParams();
  p.set("shuffle", "1");
  const limit = Number.isFinite(f.limit) && (f.limit as number) > 0
    ? Math.min(MAX_LIMIT, Math.floor(f.limit as number))
    : 2000;
  p.set("limit", String(limit));
  if (isSet(f.theme)) p.set("theme", f.theme);
  if (isSet(f.phase)) p.set("phase", f.phase);
  if (f.rating) {
    const [a, b] = f.rating;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const lo = Math.max(0, Math.min(a, b));
      const hi = Math.max(a, b);
      // Полный диапазон не сужает выборку — не засоряем им запрос.
      if (lo > 0) p.set("minRating", String(Math.round(lo)));
      if (hi < 4000) p.set("maxRating", String(Math.round(hi)));
    }
  }
  return p.toString();
}
