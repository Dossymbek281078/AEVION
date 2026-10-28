/** Расписание задач из роликов Ави (ведёт окно Продаж): дата выхода ролика → id задачи банка. 28.10.2026: шапка канала ведёт на /cyberchess?c=yt-header-2810 — приходящий видит задачу ролика. */
export type ЗадачаРолика = { date: string; id: string; yt?: string };
export const РАСПИСАНИЕ_РОЛИКОВ: ЗадачаРолика[] = [
  { date: "2026-10-18", id: "li_1KyQr", yt: "cKwUnGiUExU" }, // ролик 18.10
  { date: "2026-10-20", id: "li_4YRGx", yt: "ezB60KTGlTU" }, // последний вышедший ролик с задачей из банка (на 28.10)
  { date: "2026-10-29", id: "li_0JHtW" },
  { date: "2026-10-30", id: "li_4wJiz" },
  { date: "2026-10-31", id: "li_3t5K4" },
  { date: "2026-11-01", id: "li_1oM3a" },
];

/** YYYY-MM-DD по ЛОКАЛЬНЫМ часам браузера: ролик выходит «сегодня» для зрителя, а не по UTC. */
export function датаСегодня(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Последняя запись с date <= сегодня; раньше первой даты — null. Сортировка копией: порядок файла не важен. */
export function задачаПоследнегоРолика(сегодня: string = датаСегодня()): ЗадачаРолика | null {
  const порядок = [...РАСПИСАНИЕ_РОЛИКОВ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let найдена: ЗадачаРолика | null = null;
  for (const з of порядок) if (з.date <= сегодня) найдена = з;
  return найдена;
}

/** dd.mm из YYYY-MM-DD для подписи. */
export function ддММ(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}

/**
 * 28.10.2026: id для попыток загрузки от новой записи к старой (не новее сегодняшней), не больше n штук.
 * Причина: ручка банка отвечала 404 на li_4YRGx — блок берёт ближайшую ДОСТУПНУЮ задачу ролика.
 */
export function записиДляПопытки(сегодня: string = датаСегодня(), n = 4): string[] {
  return [...РАСПИСАНИЕ_РОЛИКОВ]
    .filter((з) => з.date <= сегодня)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, n)
    .map((з) => з.id);
}

/** dd.mm выхода ролика по id задачи ("" если id нет в расписании). */
export function датаРоликаПоId(id: string): string {
  const з = РАСПИСАНИЕ_РОЛИКОВ.find((x) => x.id === id);
  return з ? ддММ(з.date) : "";
}
