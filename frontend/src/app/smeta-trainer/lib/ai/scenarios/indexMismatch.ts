import type { Lsr, AiNotice } from "../../types";
import { findIndex } from "../../corpus";

/**
 * Сценарий: индекс пересчёта не подходит к региону/кварталу объекта.
 * Если ЛСР ссылается на индексный набор, которого нет в учебном корпусе,
 * или индексный квартал заметно «старее» текущего — предупреждаем.
 *
 * Применяется только при базисно-индексном методе.
 */
export function checkIndexMismatch(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];
  if (lsr.method !== "базисно-индексный") return notices;

  const idx = findIndex(lsr.indexRegion, lsr.indexQuarter);
  if (!idx) {
    notices.push({
      id: `index-missing-${lsr.indexRegion}-${lsr.indexQuarter}`,
      severity: "error",
      scenario: "index-mismatch",
      context: { sectionId: undefined },
      title: "Индекс пересчёта не найден",
      message: `Для региона «${lsr.indexRegion}» и квартала «${lsr.indexQuarter}» в учебном корпусе нет индексов. Текущая стоимость считается без пересчёта (×1).`,
      suggestion: "Проверьте регион и квартал в шапке ЛСР. В учебном квартале — Алматы 2026-Q2.",
      reference: "НДЦС РК 8.04-07-2025 «Индексы стоимости для строительства»",
    });
    return notices;
  }

  // Проверка устаревания квартала (учебно — формат «YYYY-QN»)
  const m = /^(\d{4})-Q([1-4])$/.exec(lsr.indexQuarter);
  if (m) {
    const lsrYear = Number(m[1]);
    const lsrQ = Number(m[2]);
    const now = new Date();
    const curYear = now.getFullYear();
    const curQ = Math.floor(now.getMonth() / 3) + 1;
    const lsrAbs = lsrYear * 4 + lsrQ;
    const curAbs = curYear * 4 + curQ;
    const diff = curAbs - lsrAbs;
    if (diff >= 2) {
      notices.push({
        id: `index-stale-${lsr.indexQuarter}`,
        severity: "warning",
        scenario: "index-stale",
        context: {},
        title: "Индекс заметно устарел",
        message: `Квартал индекса (${lsr.indexQuarter}) старше текущего на ${diff} периода. Цены за этот период могли вырасти.`,
        suggestion: "Если работы фактически выполняются сейчас — пересчитайте смету на актуальный квартал индексов.",
        reference: "НДЦС РК 8.04-07-2025, табл. 2 «Индексы по периодам»",
      });
    }
  }

  return notices;
}
