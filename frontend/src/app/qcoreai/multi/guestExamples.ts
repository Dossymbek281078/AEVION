/**
 * Первый экран /qcoreai/multi для гостя (замер прода 4.11.2026, путь из
 * Shorts yt-0411-2 «один вопрос — несколько моделей»).
 *
 * Ролик обещает: режим Parallel, Analyst готовит бриф, два автора на разных
 * моделях пишут параллельно, видны время, токены и цена. Страница это умеет,
 * но человек с ролика приходил в режим «auto», а готовые примеры были
 * английскими и про внутренние планы AEVION (QRight для комплаенса, QTrade) —
 * ни одного вопроса, где сравнение двух моделей видно за один клик.
 *
 * Гостю: режим Parallel с начала и карточка-пример того самого вопроса из
 * ролика. Вошедший пользователь свой выбор не теряет.
 */

export type GuestStrategy = "sequential" | "parallel" | "debate" | "auto" | "council";

/** Вопрос из ролика: ответ двух моделей сравнивается глазами сразу. */
export const GUEST_COMPARE_EXAMPLE = "React или HTML для первого проекта?";

/** Режим, с которого открывается страница: гостю — сравнение, вошедшему — как было. */
export function startStrategy(hasToken: boolean): GuestStrategy {
  return hasToken ? "auto" : "parallel";
}

/** Пример под карточкой режима; гостю у Parallel — вопрос из ролика. */
export function exampleFor(id: GuestStrategy, original: string, hasToken: boolean): string {
  if (!hasToken && id === "parallel") return GUEST_COMPARE_EXAMPLE;
  return original;
}
