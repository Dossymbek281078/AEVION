import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: использование расценки на монтаж для работ по демонтажу
 * без коэффициента демонтажа K=0.4..0.7 (зависит от типа работ).
 *
 * Триггер: позиция в разделе «демонтажные», но используется монтажная расценка
 * (категория «электромонтажные», «сантехнические», «монтаж-оборудования»)
 * и нет коэффициента в pos.coefficients или note об уменьшении трудоёмкости.
 */
export function checkDismantlingCoefMissing(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    if (section.category !== "демонтажные") continue;
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;

      // Если шифр уже демонтажный (ДЕМ-) — норма уже для демонтажа
      if (rate.code.toUpperCase().startsWith("ДЕМ")) continue;
      // Если категория расценки — демонтажные — норма для демонтажа
      if (rate.category === "демонтажные") continue;

      // Норма для монтажа применена в разделе демонтажа без коэффициента
      const noteHasReduce = ((pos.note ?? "") + " " + (pos.formula ?? "")).toLowerCase();
      const hasCoefficient = pos.coefficients.length > 0 || noteHasReduce.includes("к=0.") || noteHasReduce.includes("демонтаж");

      if (hasCoefficient) continue;

      // Определим типичный К для категории работ
      let typicalK = 0.5;
      let kJustification = "электромонтажные / сантехнические";
      if (["электромонтажные", "сантехнические"].includes(rate.category)) {
        typicalK = 0.4;
        kJustification = "разборка систем с возможностью повреждения проводки/труб";
      } else if (rate.category === "отделочные") {
        typicalK = 0.7;
        kJustification = "сбивание покрытий проще монтажа";
      } else if (rate.category === "монтаж-оборудования") {
        typicalK = 0.4;
        kJustification = "разборка оборудования с сохранением узлов";
      }

      notices.push({
        id: `dismantling-coef-${pos.id}`,
        severity: "warning",
        scenario: "dismantling-coef-missing",
        context: { positionId: pos.id, sectionId: section.id },
        title: "Норма монтажа в разделе демонтажа без коэффициента",
        message:
          `Расценка «${rate.title}» (категория: ${rate.category}) применена в разделе ` +
          `«Демонтажные работы», но в позиции нет коэффициента демонтажа. ` +
          `Трудоёмкость демонтажа обычно меньше монтажа.`,
        suggestion:
          `Примените коэффициент K=${typicalK} (${kJustification}) к ОЗП и ЭМ ` +
          `этой расценки. Либо подберите специальную расценку с шифром ДЕМ-...`,
        reference: "МДС 81-35.2004, прил. 1 «Применение коэффициентов при демонтаже»",
      });
    }
  }
  return notices;
}
