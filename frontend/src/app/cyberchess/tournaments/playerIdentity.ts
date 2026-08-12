/**
 * Личность игрока для турниров — один источник на обе страницы.
 *
 * Раньше эти две функции жили внутри `tournaments/[id]/page.tsx` и наружу не
 * отдавались, поэтому список турниров регистрировал ПУСТЫМ телом: сервер в
 * таком случае выдаёт `anon_…`, место в турнире занимается, а связать его с
 * живым человеком уже нечем — и билет, который сервер теперь хранит, оказывался
 * записан на этот одноразовый id. Записавшись со списка, игрок не находил себя
 * ни в участниках, ни по билету.
 *
 * Ключи здесь ровно те же, что были: перенос без изменения поведения.
 *
 * ВАЖНО, что НЕ сделано и почему: страница задачи дня
 * (`daily/dailyPuzzleSource.ts`) держит свою `playerIdentity()`, и она читает
 * ДРУГОЙ ключ — `cyberchess.userId` вместо `cc_user_id`. То есть один и тот же
 * человек в турнирах и в задаче дня — два разных игрока. Свести их в один ключ
 * значит переназначить личность всем, у кого уже есть история, поэтому это
 * решение, а не уборка, и принимать его на бегу нельзя.
 */

const USER_ID_KEY = "cc_user_id";
/** Имя пишет матчмейкинг, когда игрок вводит его перед входом в очередь. */
const DISPLAY_NAME_KEY = "cyberchess.displayName";

/** Постоянный id игрока в этом браузере. Создаётся при первом обращении. */
export function tournamentUserId(): string {
  if (typeof window === "undefined") return `anon_${Math.random().toString(36).slice(2, 10)}`;
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(USER_ID_KEY);
  } catch {
    // приватный режим — работаем без сохранения
  }
  if (!id) {
    id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      window.localStorage.setItem(USER_ID_KEY, id);
    } catch {
      // ignore
    }
  }
  return id;
}

/** Отображаемое имя. Пустая строка означает «пусть сервер придумает сам». */
export function tournamentDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(DISPLAY_NAME_KEY) || "";
  } catch {
    return "";
  }
}
