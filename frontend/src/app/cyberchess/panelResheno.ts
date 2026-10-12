/**
 * Строка ценности на панели «Решено!» для пришедшего по ссылке на задачу.
 *
 * Число задач — из `pzTotal` (живой ответ /api/cyberchess-puzzles/meta,
 * bankTotal), а не литералом: лендинг однажды обещал «полмиллиона», когда в
 * банке было 502 584, и расхождение заметили. Нет числа (ответ не пришёл) —
 * строка без числа: выдуманная цифра хуже отсутствующей.
 *
 * До решения основателя о платной ценности здесь просто «ещё задачи и
 * ИИ-тренер» (слово оркестратора 12.10.2026).
 */
export function strokaTsennosti(pzTotal: number | null | undefined): string {
  if (typeof pzTotal === "number" && Number.isFinite(pzTotal) && pzTotal > 0) {
    return `Ещё ${Math.floor(pzTotal).toLocaleString("ru-RU")} задач и ИИ-тренер`;
  }
  return "Ещё задачи и ИИ-тренер";
}
