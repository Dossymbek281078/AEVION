/**
 * Текст ошибки, который можно показать наружу.
 *
 * Замер 21.08.2026: 28 ручек в восьми модулях отдавали `e.message` дословно.
 * Подставная ошибка несла маркер, и он оказался в теле ответа — то есть при
 * настоящем сбое наружу уходит строка вида
 *
 *     connect ECONNREFUSED db-prod-7.internal:5432 user=aevion_app
 *
 * Хост, порт и имя пользователя базы. Такое сообщение бесполезно человеку и
 * полезно тому, кто ищет, куда стучаться.
 *
 * Правило простое: наружу — КАТЕГОРИЯ, в журнал — подробность. Исключение
 * ровно одно и оно явное: ошибка, которую мы САМИ написали для пользователя,
 * помечается PublicError, и её текст проходит.
 */

/** Ошибка, текст которой написан ДЛЯ ПОЛЬЗОВАТЕЛЯ и может уйти наружу. */
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}

/**
 * @param e        пойманное значение
 * @param fallback категория, понятная человеку («не удалось сохранить»)
 * @param where    метка для журнала, чтобы подробность можно было найти
 */
export function safeErrorText(e: unknown, fallback: string, where?: string): string {
  if (e instanceof PublicError) return e.message;
  // Подробность не теряется — она уходит в журнал, где ей и место.
  console.error(`[safeError]${where ? " " + where : ""}`, e);
  return fallback;
}
