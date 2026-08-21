/**
 * Что честно сказать про долговечность платёжной ссылки.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Решение здесь маленькое, но его надо проверять
 * тестом, а не глазами: страница — клиентский React, и утверждение «баннер
 * появляется» иначе не проверяемо. Поэтому вся логика — чистая функция, а
 * страница только рисует её ответ.
 *
 * ЧТО ЗА ПРОБЛЕМА. Поверхности Payments Rail (`links`, `checkouts`,
 * `subscriptions`, `webhooks`, `settlements`) хранятся через
 * `api/payments/v1/_persist.ts`. Там два уклада: Upstash/Vercel KV — когда
 * заданы `KV_REST_API_URL`+`KV_REST_API_TOKEN` (или `UPSTASH_REDIS_REST_*`),
 * и `memory` — globalThis Map, по умолчанию. Комментарий в самом `_persist.ts`
 * честен: «Survives warm starts on the same serverless instance, LOST ON COLD
 * START».
 *
 * Замер 21.08.2026: `https://aevion.app/api/health` отвечает
 * `"persistence": "memory"`, а страница `/payments/links` предлагала срок
 * действия **«Never»** и ни слова о неустойчивости не говорила.
 *
 * ПОЧЕМУ ЭТО ХУЖЕ, ЧЕМ ПРОСТО «ДАННЫЕ ТЕРЯЮТСЯ». Продавец хранит свой список
 * в localStorage браузера — у него ссылка остаётся «active» и после
 * перезапуска. А ПЛАТЯЩИЙ открывает `/r/<id>`, и тот резолвится на СЕРВЕРЕ,
 * то есть в памяти процесса. Значит отказ виден только покупателю, а продавец
 * о нём не узнаёт. Ровно тот случай, ради которого заведено правило «запасное
 * хранилище отвечает неотличимо от настоящего сохранения».
 *
 * ТРИ ИСХОДА, А НЕ ДВА. Если состояние спросить НЕ УДАЛОСЬ — это не «всё
 * хорошо». Молчать в таком случае значит обещать долговечность, которой
 * может не быть, поэтому `unknown` тоже предупреждает, но другими словами.
 */

export type Persistence = "kv" | "memory" | "unknown";

export type DurabilityNotice = {
  /** Показывать ли предупреждение над формой. */
  warn: boolean;
  /** Можно ли предлагать срок «никогда». */
  allowNever: boolean;
  /** Текст для человека. Пустой — когда предупреждать не о чем. */
  text: string;
  /** Подсказка на отключённой кнопке «Never». Пустая, когда она доступна. */
  neverHint: string;
};

// ЯЗЫК. Текст английский, потому что английская вся страница и весь раздел
// Payments Rail; один русский абзац посреди неё читался бы как поломка вёрстки,
// а не как забота. Правило «вся проза по-русски» относится к ответам основателю,
// а не к тексту интерфейса (см. feedback_russian_prose_default). Когда раздел
// переведут целиком — переводить и эти строки, они здесь в одном месте.
const LOST_ON_RESTART =
  "Links are kept in the server's memory and disappear when it restarts. " +
  "Your own list will still show them, but the payer's link stops opening — " +
  "and nothing tells you that it did. Prefer short expiries and open the link " +
  "yourself before sending it.";

const UNKNOWN_STATE =
  "Could not ask the server where links are stored. Until it answers, treat " +
  "storage as non-durable: the “never expires” option stays off.";

/**
 * Разобрать поле `persistence` из ответа `/api/health`.
 * Всё, что не «kv» и не «memory», — это «не знаю», а не «хорошо».
 */
export function readPersistence(value: unknown): Persistence {
  return value === "kv" ? "kv" : value === "memory" ? "memory" : "unknown";
}

export function durabilityNotice(p: Persistence): DurabilityNotice {
  if (p === "kv") {
    return { warn: false, allowNever: true, text: "", neverHint: "" };
  }
  const text = p === "memory" ? LOST_ON_RESTART : UNKNOWN_STATE;
  return {
    warn: true,
    allowNever: false,
    text,
    neverHint:
      p === "memory"
        ? "Unavailable: the server keeps links in memory and loses them on restart."
        : "Unavailable: storage state is unknown.",
  };
}

/**
 * Сроки, которые можно предлагать. 0 означает «никогда» и появляется только
 * там, где хранилище это выдержит.
 *
 * Кнопку «Never» мы не УБИРАЕМ из интерфейса, а гасим с объяснением: молча
 * исчезнувший вариант выглядит как ошибка вёрстки, а погашенный с подсказкой
 * сообщает причину.
 */
export const EXPIRY_CHOICES_DAYS = [1, 7, 30, 0] as const;

export function isExpiryAllowed(days: number, p: Persistence): boolean {
  return days !== 0 || durabilityNotice(p).allowNever;
}

/**
 * Срок по умолчанию. При неустойчивом хранении «никогда» выбранным быть не
 * может — иначе форма отправит заведомо невыполнимое обещание.
 */
export function coerceExpiry(days: number, p: Persistence): number {
  return isExpiryAllowed(days, p) ? days : 7;
}
