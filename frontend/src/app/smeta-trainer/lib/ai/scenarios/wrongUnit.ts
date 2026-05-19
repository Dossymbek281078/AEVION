import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: студент ввёл объём, не учтя единицу нормы.
 * Типичная ошибка: для нормы «100 м²» вводят полное количество м² (например 250),
 * хотя нужно делить на 100 (т.е. 2.5).
 *
 * Эвристика: для расценок с единицами «100 м²», «100 м³», «100 м» волюм > 100
 * — почти наверняка ошибка масштаба, если только речь не идёт о больших объектах.
 */
export function checkWrongUnit(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      if (!rate.unit.startsWith("100 ")) continue;

      // Для нормы "100 м²/м³/м" объём = "число сотен ед.".
      // 100 — это 10 000 м² одной кладки или штукатурки — необычно для учебной сметы.
      if (pos.volume >= 100 && !pos.note?.toLowerCase().includes("крупн")) {
        const realValue = pos.volume * 100;
        const correctedVolume = pos.volume / 100;
        notices.push({
          id: `wrong-unit-${pos.id}`,
          severity: "warning",
          scenario: "wrong-unit",
          context: { positionId: pos.id, sectionId: section.id },
          title: "Возможна ошибка единицы измерения",
          message:
            `В позиции «${rate.title}» (норма ${rate.unit}) введён объём ${pos.volume} — это ` +
            `${realValue.toLocaleString("ru")} ${rate.unit.replace("100 ", "")} физических.`,
          suggestion:
            `Если фактический объём — ${pos.volume} ${rate.unit.replace("100 ", "")}, разделите на 100: ` +
            `должно быть ${correctedVolume.toFixed(2)}. ` +
            `Помните: норма «${rate.unit}» означает «за каждые 100 единиц».`,
          reference: "СН РК 8.02-01, технические части сборников ЭСН.",
        });
      }
    }
  }
  return notices;
}
