import type { Lsr, AiNotice, AppliedCoefficient } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: коэффициент условий производства завышен сверх типового норматива (batch F).
 * Дополняет `coef-unjustified` (нет обоснования) и `coef-double` (задвоен): здесь
 * коэффициент может быть и обоснован, и единствен, но его ЗНАЧЕНИЕ выше типового
 * предела для данного условия. Классическая ошибка ввода — студент пишет 1.5 вместо
 * 1.15, либо применяет коэффициент ко всем затратам так, будто он крупнее норматива.
 *
 * Пределы — типовые значения К условий производства к ОЗП/ЭМ по методике РК
 * (СН РК 8.02-05, общая часть; ЕНиР прил. 1). Сравнение СТРОГО «больше» предела,
 * поэтому корректные эталонные значения (стеснённые/действующий-объект = 1.15,
 * высота = 1.20) не срабатывают. Severity = warning: норматив зависит от конкретных
 * условий, детектор лишь просит перепроверить и подтвердить повышенное значение.
 */

/** Типовой верхний предел коэффициента по виду условия (к ОЗП/ЭМ). */
export const COEF_TYPICAL_MAX: Record<AppliedCoefficient["kind"], number> = {
  "стеснённые": 1.15,
  "действующий-объект": 1.2,
  "высота": 1.2,
  "охранные-зоны": 1.35,
  "выходные": 1.2,
  "социальный-объект": 1.15,
};

export function checkCoefOverLimit(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      if (!pos.coefficients || pos.coefficients.length === 0) continue;
      const rate = findRate(pos.rateCode);
      const titleSuffix = rate ? ` «${rate.title}»` : "";

      for (const c of pos.coefficients) {
        const cap = COEF_TYPICAL_MAX[c.kind];
        if (cap === undefined) continue;
        if (!(c.value > cap)) continue;

        notices.push({
          id: `coef-over-limit-${pos.id}-${c.kind}`,
          severity: "warning",
          scenario: "coef-over-limit",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Завышен коэффициент «${c.kind}» (${c.value})`,
          message:
            `В позиции ${pos.rateCode}${titleSuffix} коэффициент «${c.kind}» = ${c.value} превышает ` +
            `типовое нормативное значение К=${cap} для этого условия (+${Math.round((c.value - 1) * 100)}% ` +
            `против типовых +${Math.round((cap - 1) * 100)}%).`,
          suggestion:
            `Проверьте значение: для условия «${c.kind}» обычно применяют К≈${cap}. Если повышенный ` +
            `коэффициент обоснован проектом/ПОС — оставьте, иначе исправьте на нормативное.`,
          reference: "СН РК 8.02-05, общая часть; ЕНиР, прил. 1 — пределы коэффициентов условий производства",
        });
        break; // одно замечание на позицию
      }
    }
  }

  return notices;
}
