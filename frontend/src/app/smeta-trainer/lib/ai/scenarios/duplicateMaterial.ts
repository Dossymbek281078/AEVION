import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: один и тот же материал добавлен в позицию дважды.
 * При ручном переопределении состава ресурсов (resourceOverrides) студент
 * иногда добавляет материал повторно — вместо того чтобы изменить расход в
 * существующей строке. Итог — стоимость материала задваивается внутри позиции.
 *
 * Триггер: в resourceOverrides одной позиции встречается ≥2 строк kind="материал"
 * с совпадающим названием (без учёта регистра/пробелов).
 *
 * Отличие от double-count: там дублируется целая расценка в разных разделах,
 * здесь — отдельная ресурсная строка внутри одной позиции.
 */
function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function checkDuplicateMaterial(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      // Дубль возможен только при ручном переопределении состава ресурсов.
      if (!pos.resourceOverrides || pos.resourceOverrides.length === 0) continue;

      const seen = new Map<string, number>();
      for (const r of pos.resourceOverrides) {
        if (r.kind !== "материал") continue;
        const key = normName(r.name);
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }

      for (const [, count] of seen) {
        if (count < 2) continue;
        // Берём оригинальное имя первого совпадения для текста замечания.
        const dupName =
          pos.resourceOverrides.find(
            (r) => r.kind === "материал" && [...seen.entries()].some(([k, c]) => c >= 2 && normName(r.name) === k)
          )?.name ?? "материал";
        const rate = findRate(pos.rateCode);
        notices.push({
          id: `duplicate-material-${pos.id}-${normName(dupName)}`,
          severity: "error",
          scenario: "duplicate-material",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Материал «${dupName}» добавлен ${count} раза`,
          message:
            `В позиции ${pos.rateCode}${rate ? ` «${rate.title}»` : ""} материал «${dupName}» ` +
            `встречается ${count} раза в составе ресурсов. Стоимость материала задвоена внутри позиции.`,
          suggestion:
            `Оставьте одну строку «${dupName}» и задайте в ней суммарный расход на единицу нормы. ` +
            `Лишние строки удалите в редакторе состава ресурсов.`,
          reference: "СН РК 8.02-05 «Состав ресурсной части единичных расценок»",
        });
        break; // одно замечание на позицию достаточно
      }
    }
  }

  return notices;
}
