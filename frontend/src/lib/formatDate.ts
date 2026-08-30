/**
 * Дата, показанная человеку, форматируется по языку СТРАНИЦЫ.
 *
 * 28.08.2026 в личном кабинете нашлись три разных способа на одной странице:
 *
 *   toLocaleDateString("ru-RU")  — жёстко русская дата даже англоязычному
 *   toUTCString()                — «Thu, 28 Aug 2026 12:00:00 GMT»
 *   toLocaleString()             — язык БРАУЗЕРА, а не страницы
 *
 * Самый незаметный из трёх — первый: он выглядит аккуратно, пока страницу не
 * откроет иностранец. Поэтому чинится не «привести к одному виду», а «взять
 * язык страницы».
 *
 * Язык берём из `<html lang>` — его проставляет платформа, и это ровно тот
 * язык, на котором человек читает остальной текст. Так помощник не зависит от
 * словаря i18n и не тянет его в страницы, которые к нему не подключены.
 */

/** Язык страницы; на сервере и при пустом атрибуте — разумное умолчание. */
export function pageLocale(fallback = "en"): string {
  if (typeof document === "undefined") return fallback;
  const lang = document.documentElement.getAttribute("lang");
  return lang && lang.trim() ? lang.trim() : fallback;
}

/**
 * Дата без времени: «28.08.2026» / «Aug 28, 2026» — по языку страницы.
 * Непригодное значение возвращаем как есть: пустая строка на экране хуже,
 * чем странная, — по ней хотя бы видно, что пришло с сервера.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(pageLocale(), { year: "numeric", month: "short", day: "numeric" });
}

/** Дата и время — там, где важен момент (последний вход, доставка вебхука). */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(pageLocale(), {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
