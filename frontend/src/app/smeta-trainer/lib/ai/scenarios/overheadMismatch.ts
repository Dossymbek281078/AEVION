import type { Lsr, AiNotice } from "../../types";
import { findOverhead, findRate } from "../../corpus";

/**
 * Сценарий: НР/СП по разделу не совпадают с типом работ позиций внутри.
 * Если в разделе категории «отделочные» больше половины позиций имеют расценки
 * категории «демонтажные» (или наоборот) — нормативы НР/СП будут применены
 * неверно. Подсказываем разнести в отдельный раздел.
 */
export function checkOverheadMismatch(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    if (section.positions.length === 0) continue;
    const sectionOverhead = findOverhead(section.category);
    if (!sectionOverhead) continue;

    // Считаем категории позиций внутри
    const catCounts = new Map<string, number>();
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      catCounts.set(rate.category, (catCounts.get(rate.category) ?? 0) + 1);
    }
    if (catCounts.size === 0) continue;

    // Доминирующая категория среди позиций
    let dominantCat: string | null = null;
    let dominantCnt = 0;
    let totalCnt = 0;
    for (const [cat, cnt] of catCounts) {
      totalCnt += cnt;
      if (cnt > dominantCnt) {
        dominantCnt = cnt;
        dominantCat = cat;
      }
    }
    if (!dominantCat) continue;

    // Если доминирующая категория ≠ категория раздела и доля > 50% — флагуем
    const dominantShare = dominantCnt / totalCnt;
    if (dominantCat !== section.category && dominantShare > 0.5) {
      const dominantOverhead = findOverhead(dominantCat as typeof section.category);
      const expectedNR = dominantOverhead?.overheadPct ?? 0;
      const actualNR = sectionOverhead.overheadPct;
      const diff = Math.abs(expectedNR - actualNR);
      if (diff < 5) continue; // мелкая разница — не флагуем

      notices.push({
        id: `overhead-mismatch-${section.id}`,
        severity: "warning",
        scenario: "overhead-mismatch",
        context: { sectionId: section.id },
        title: "Категория раздела не соответствует работам внутри",
        message:
          `Раздел «${section.title}» имеет категорию «${section.category}» ` +
          `(НР=${actualNR}% от ФОТ), но ${Math.round(dominantShare * 100)}% позиций ` +
          `относятся к категории «${dominantCat}» (НР=${expectedNR}%).`,
        suggestion:
          `Разнесите позиции по разделам своих категорий — иначе НР/СП считаются ` +
          `неверно (разница ${diff}% к ФОТ может быть существенной).`,
        reference: "СН РК 8.02-07 «Нормы НР и СП в строительстве», табл. по категориям работ",
      });
    }
  }

  return notices;
}
