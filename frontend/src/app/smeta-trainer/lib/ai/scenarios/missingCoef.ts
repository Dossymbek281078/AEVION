import type { Lsr, AiNotice, LearningObject } from "../../types";

/**
 * Сценарий: забыт коэффициент условий «действующий-объект»/«стеснённые».
 *
 * Триггер — объект-управляемый: если объект помечен `occupied` (здание
 * эксплуатируется во время работ), а ни к одной позиции сметы не применён
 * коэффициент «действующий-объект» или «стеснённые», значит студент забыл его
 * совсем. Это типичная ошибка по СН РК 8.02-10 (работы в действующем здании).
 *
 * Почему «нигде во всей смете», а не по каждой позиции: эталоны действующих
 * объектов применяют коэффициент, и поэлементная проверка давала ложные
 * срабатывания на корректных сметах. Признак «забыл совсем» точен и не шумит.
 */
const OCCUPIED_KINDS = new Set(["действующий-объект", "стеснённые"]);

export function checkMissingCoefficient(lsr: Lsr, object?: LearningObject): AiNotice[] {
  if (!object?.occupied) return [];

  const hasCoef = lsr.sections.some((s) =>
    s.positions.some((p) => p.coefficients.some((c) => OCCUPIED_KINDS.has(c.kind)))
  );
  if (hasCoef) return [];

  // Привязываем единственное замечание к первой позиции сметы.
  for (const section of lsr.sections) {
    const pos = section.positions[0];
    if (!pos) continue;
    return [
      {
        id: `missing-coef-${pos.id}`,
        severity: "warning",
        scenario: "missing-coefficient",
        context: { positionId: pos.id, sectionId: section.id },
        title: "Забыт коэффициент действующего объекта",
        message:
          `Объект «${object.title}» эксплуатируется во время работ (действующее здание), ` +
          `но коэффициент условий «действующий-объект» (К=1.15) не применён ни к одной позиции сметы.`,
        suggestion:
          "Добавьте коэффициент «действующий-объект» ко всем позициям работ кнопкой +К " +
          "(работы в стеснённых условиях эксплуатируемого здания — СН РК 8.02-10).",
        reference: "ЕНиР, общая часть, прил. 1, п. 2 «Стеснённость условий»; СН РК 8.02-10.",
      },
    ];
  }
  return [];
}
