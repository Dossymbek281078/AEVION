import type { Lsr, AiNotice, AppliedCoefficient } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: коэффициент условий производства применён без обоснования (batch E).
 * Зеркало `material-price-unjustified`, но для коэффициентов: студент накручивает
 * удорожание (стеснённость, действующий объект, охранная зона и т.п.), но не
 * оставляет документ-обоснование в поле `justification`.
 *
 * По методике РК коэффициенты условий производства применяются ТОЛЬКО при наличии
 * подтверждающего документа (ПОС/ППР, акт обследования, договор, проект). Без него
 * экспертиза снимает коэффициент — смета завышена и не защищается.
 *
 * Триггер: позиция с coefficients, где у коэффициента `justification` пустой
 * или не содержит ссылки на документ-обоснование.
 */
const JUSTIFY_KEYWORDS = [
  "пос",
  "ппр",
  "акт",
  "договор",
  "проект",
  "обоснован",
  "приказ",
  "распоряж",
  "схем",
  "обследован",
];

function hasJustification(j?: string): boolean {
  if (!j) return false;
  const low = j.toLowerCase().trim();
  if (low.length < 3) return false;
  return JUSTIFY_KEYWORDS.some((k) => low.includes(k));
}

/** Человекочитаемое название условия по виду коэффициента. */
const KIND_DOC: Record<AppliedCoefficient["kind"], string> = {
  "стеснённые": "ПОС/ППР со схемой стеснённых условий",
  "действующий-объект": "договор/приказ о работах на эксплуатируемом объекте",
  "высота": "проектная отметка/схема высотных работ",
  "охранные-зоны": "акт/схема границ охранной зоны",
  "выходные": "приказ о работах в выходные/праздничные дни",
  "социальный-объект": "документ о статусе социального объекта",
};

export function checkCoefUnjustified(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      if (!pos.coefficients || pos.coefficients.length === 0) continue;
      const rate = findRate(pos.rateCode);
      const titleSuffix = rate ? ` «${rate.title}»` : "";

      for (const c of pos.coefficients) {
        if (hasJustification(c.justification)) continue;

        notices.push({
          id: `coef-unjustified-${pos.id}-${c.kind}`,
          severity: "warning",
          scenario: "coef-unjustified",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Коэффициент «${c.kind}» без обоснования`,
          message:
            `В позиции ${pos.rateCode}${titleSuffix} применён коэффициент «${c.kind}» = ${c.value}, ` +
            `но документ-обоснование не указан. Коэффициент удорожает позицию на ${Math.round(
              (c.value - 1) * 100
            )}% без подтверждения.`,
          suggestion:
            `Укажите в обосновании коэффициента подтверждающий документ: ` +
            `${KIND_DOC[c.kind] ?? "ПОС/ППР, акт обследования или договор"}.`,
          reference: "СН РК 8.02-05, общая часть — коэффициенты условий применяются при документальном обосновании",
        });
        break; // одно замечание на позицию
      }
    }
  }

  return notices;
}
