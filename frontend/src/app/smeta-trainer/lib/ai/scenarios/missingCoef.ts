import type { Lsr, AiNotice } from "../../types";

/**
 * Сценарий: забытый коэффициент стеснённости.
 * Если объект — действующее или жилое здание и позиции демонтажа или отделки есть,
 * а ни одна позиция не имеет коэффициента «действующий-объект» — советуем добавить.
 */
export function checkMissingCoefficient(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  // Для учебного объекта «капремонт» и «реконструкция» коэффициент К=1.15 обязателен
  // если в смете есть ремонтные или демонтажные позиции без него.
  const relevantCategories: string[] = ["демонтажные", "ремонтно-строительные", "отделочные"];

  for (const section of lsr.sections) {
    if (!relevantCategories.includes(section.category)) continue;

    for (const pos of section.positions) {
      const hasRelevantCoef = pos.coefficients.some(
        (c) => c.kind === "действующий-объект" || c.kind === "стеснённые"
      );
      if (hasRelevantCoef) continue;

      // Только для разделов, где работы идут в действующем здании
      if (section.category === "демонтажные" || section.category === "ремонтно-строительные") {
        notices.push({
          id: `missing-coef-${pos.id}`,
          severity: "warning",
          scenario: "missing-coefficient",
          context: { positionId: pos.id, sectionId: section.id },
          title: "Возможен пропущенный коэффициент",
          message: `При работах в действующем (эксплуатируемом) здании к стоимости работ применяется коэффициент стеснённости К=1.15 (ЕНиР, прил. 1).`,
          suggestion: "Проверьте условия производства работ. Если школа функционировала во время ремонта — добавьте коэффициент «действующий-объект».",
          reference: "ЕНиР, общая часть, прил. 1, п. 2 «Стеснённость условий».",
        });
      }
    }
  }

  return notices;
}
