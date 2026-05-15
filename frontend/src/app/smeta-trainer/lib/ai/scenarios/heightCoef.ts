import type { Lsr, AiNotice, LearningObject } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: высотные работы без коэффициента высоты.
 * Если объект — здание с этажностью ≥ 4 (а в учебном корпусе высота помещения
 * ≥ 4 м говорит о работах на лесах) и в смете есть кровельные / отделочные
 * позиции на высоте — нужен коэффициент высоты K=1.05..1.20.
 */
export function checkHeightCoefficient(lsr: Lsr, object: LearningObject): AiNotice[] {
  const notices: AiNotice[] = [];

  // Триггер: в объекте есть геометрия с высотой ≥ 4 м, либо тип объекта намекает на высотность
  const geomHeight = object.geometry?.kind === "room" ? object.geometry.height : 0;
  const isHighRise = geomHeight >= 4;
  if (!isHighRise) return notices;

  // Категории работ, где обычно нужен коэф высоты
  const HEIGHT_SENSITIVE = new Set(["кровельные", "отделочные", "электромонтажные"]);

  for (const section of lsr.sections) {
    if (!HEIGHT_SENSITIVE.has(section.category)) continue;
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;

      const hasHeightCoef = pos.coefficients.some((c) => c.kind === "высота");
      if (hasHeightCoef) continue;

      // Подсказка только для расценок, где явно есть «фасад», «потолок», «кровл», «окнах»
      const title = (rate.title + " " + (rate.composition?.join(" ") ?? "")).toLowerCase();
      const isHighWork =
        section.category === "кровельные" ||
        title.includes("фасад") || title.includes("потол") ||
        title.includes("кровл") || title.includes("окнах") ||
        title.includes("высот");
      if (!isHighWork) continue;

      notices.push({
        id: `height-coef-${pos.id}`,
        severity: "warning",
        scenario: "height-coefficient",
        context: { positionId: pos.id, sectionId: section.id },
        title: "Возможен пропущенный коэффициент высоты",
        message:
          `Объект «${object.title}» имеет высоту помещения ${geomHeight} м. ` +
          `Для работ на высоте от 4 м (с лесами/подмостями) применяется ` +
          `коэффициент 1.05..1.20 в зависимости от высоты.`,
        suggestion:
          "Если работы реально велись с лесов/подмостей или на высоте >4 м — " +
          "добавьте коэффициент «высота» к этой позиции.",
        reference: "ЕНиР, общая часть, прил. 1, п. 4 «Производство работ на высоте»",
      });
    }
  }

  return notices;
}
