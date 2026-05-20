import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: земляные работы без указания категории грунта.
 * В РК грунты делятся на I-IV категории по СН РК 5.01-01 + ЕНиР Сб.2 §2-1.
 * Норма выработки и стоимость различаются в 2-4 раза между I (песок) и IV (скала).
 *
 * Триггер: позиция категории «земляные» с unit «м³» или «100 м³», и в note/formula
 * не упомянута категория грунта.
 */
const SOIL_CATEGORY_KEYWORDS = ["i-кат", "ii-кат", "iii-кат", "iv-кат", "1 кат", "2 кат", "3 кат", "4 кат", "песок", "суглин", "глин", "скал"];

export function checkSoilCategoryMismatch(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    if (section.category !== "земляные") continue;
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;

      const noteAndFormula = ((pos.note ?? "") + " " + (pos.formula ?? "") + " " + rate.title).toLowerCase();
      const hasSoilCategory = SOIL_CATEGORY_KEYWORDS.some((k) => noteAndFormula.includes(k));
      if (hasSoilCategory) continue;

      notices.push({
        id: `soil-category-${pos.id}`,
        severity: "warning",
        scenario: "soil-category-mismatch",
        context: { positionId: pos.id, sectionId: section.id },
        title: "Не указана категория грунта",
        message:
          `В позиции «${rate.title}» земляных работ нет указания категории грунта (I-IV). ` +
          `Категория критически важна — нормы выработки и расценки различаются в 2-4× между ` +
          `I категорией (песок, рыхлая земля) и IV (скальные грунты, мерзлота).`,
        suggestion:
          `Откройте инженерно-геологический отчёт (ИГИ) и определите категорию по СН РК 5.01-01. ` +
          `Затем подберите расценку с соответствующей категорией грунта.`,
        reference: "СН РК 5.01-01 + ЕНиР Сб.2 §2-1 «Земляные работы», техническая часть",
      });
    }
  }
  return notices;
}
