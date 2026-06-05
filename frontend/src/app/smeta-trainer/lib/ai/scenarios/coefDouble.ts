import type { Lsr, AiNotice, AppliedCoefficient } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: двойной счёт коэффициентов условий производства.
 * Два разных признака описывают одно и то же условие, а коэффициенты
 * перемножаются — стоимость задваивается.
 *
 * Два случая:
 *  1) один и тот же `kind` указан дважды (например, две строки «высота»);
 *  2) перекрывающиеся по смыслу коэффициенты применены вместе:
 *     «стеснённые» + «действующий-объект» отражают по сути одно (стеснённость
 *     при работе на эксплуатируемом объекте) и не суммируются методикой.
 *
 * Триггер: pos.coefficients содержит дубль kind ИЛИ обе перекрывающиеся пары.
 */
const OVERLAP_PAIRS: Array<[AppliedCoefficient["kind"], AppliedCoefficient["kind"]]> = [
  ["стеснённые", "действующий-объект"],
];

function multiplier(coefs: AppliedCoefficient[]): number {
  return coefs.reduce((m, c) => m * (c.value || 1), 1);
}

export function checkCoefDouble(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      if (!pos.coefficients || pos.coefficients.length < 2) continue;
      const rate = findRate(pos.rateCode);
      const titleSuffix = rate ? ` «${rate.title}»` : "";

      // Случай 1: повтор одного kind.
      const kindCounts = new Map<string, AppliedCoefficient[]>();
      for (const c of pos.coefficients) {
        const arr = kindCounts.get(c.kind) ?? [];
        arr.push(c);
        kindCounts.set(c.kind, arr);
      }
      let flaggedDuplicate = false;
      for (const [kind, arr] of kindCounts) {
        if (arr.length < 2) continue;
        flaggedDuplicate = true;
        const product = arr.reduce((m, c) => m * (c.value || 1), 1);
        notices.push({
          id: `coef-double-${pos.id}-${kind}`,
          severity: "error",
          scenario: "coef-double",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Коэффициент «${kind}» применён ${arr.length} раза`,
          message:
            `В позиции ${pos.rateCode}${titleSuffix} коэффициент «${kind}» указан ${arr.length} раза ` +
            `(${arr.map((c) => c.value).join(" × ")} = ${product.toFixed(3)}). Один признак условий учитывается один раз.`,
          suggestion: `Оставьте одну строку коэффициента «${kind}» с корректным значением, дубль удалите.`,
          reference: "СН РК 8.02-05, общая часть — коэффициенты условий производства не дублируются",
        });
        break; // одно замечание на позицию по дублю
      }
      if (flaggedDuplicate) continue;

      // Случай 2: перекрывающиеся по смыслу коэффициенты.
      const kinds = new Set(pos.coefficients.map((c) => c.kind));
      for (const [a, b] of OVERLAP_PAIRS) {
        if (!kinds.has(a) || !kinds.has(b)) continue;
        notices.push({
          id: `coef-double-overlap-${pos.id}-${a}-${b}`,
          severity: "warning",
          scenario: "coef-double",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Перекрывающиеся коэффициенты «${a}» и «${b}»`,
          message:
            `В позиции ${pos.rateCode}${titleSuffix} применены и «${a}», и «${b}». ` +
            `Эти условия пересекаются по смыслу (стеснённость на эксплуатируемом объекте) — ` +
            `совместное применение задваивает удорожание (итоговый K=${multiplier(pos.coefficients).toFixed(3)}).`,
          suggestion:
            `Оставьте один коэффициент, точнее отражающий реальные условия, либо подтвердите документом, ` +
            `что условия действительно независимы.`,
          reference: "ЕНиР, общая часть, прил. 1 — совмещение коэффициентов условий",
        });
        break;
      }
    }
  }

  return notices;
}
