import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий «batch G»: забыты возвратные суммы от разборки (урок 2.5).
 *
 * При демонтаже/разборке образуются годные для повторного использования или
 * сдачи материалы — металлолом от стальных конструкций, чугунные радиаторы,
 * трубы, кабель (медь/алюминий), годный кирпич от разборки кладки. По методике
 * РК (СН РК 8.02-05, МДС 81-35 п. 4.36) их стоимость учитывается отдельной
 * строкой «возвратные суммы» со знаком минус и уменьшает итог сметы.
 *
 * Типовая ошибка студента: демонтаж посчитан, а возвратные суммы не вычтены —
 * смета завышена, эксперт снимет стоимость возврата.
 *
 * Триггер: в демонтажном разделе есть позиция с возвратообразующим материалом,
 * но нигде в ЛСР нет отметки об учёте возврата (в note/formula позиции — слово
 * «возврат»). Детектор не считает сумму, а подсвечивает пропуск (advisory).
 */

interface ReclaimRule {
  /** Ключевые слова в наименовании расценки. */
  keywords: string[];
  /** Что именно образуется (для текста замечания). */
  material: string;
}

/** Возвратообразующие виды разборки (учебный набор). */
export const RECLAIMABLE_RULES: ReclaimRule[] = [
  { keywords: ["металл", "стальн", "металлоконструкц"], material: "металлолом от стальных конструкций" },
  { keywords: ["радиатор", "регистр", "отопительн прибор"], material: "чугунные радиаторы / отопительные приборы" },
  { keywords: ["трубопровод", "трубы", "труб "], material: "трубы (стальные/чугунные)" },
  { keywords: ["кабель", "провод"], material: "кабель/провод (медь, алюминий)" },
  { keywords: ["кирпичн", "кладк"], material: "годный кирпич от разборки кладки" },
];

/** Есть ли где-нибудь в ЛСР отметка об учёте возвратных сумм. */
function returnableAccounted(lsr: Lsr): boolean {
  for (const section of lsr.sections) {
    if (section.title.toLowerCase().includes("возврат")) return true;
    for (const pos of section.positions) {
      const note = (pos.note ?? "").toLowerCase();
      const formula = (pos.formula ?? "").toLowerCase();
      if (note.includes("возврат") || formula.includes("возврат")) return true;
    }
  }
  return false;
}

export function checkReturnableSums(lsr: Lsr): AiNotice[] {
  // Уже учтено где-то — не дёргаем студента.
  if (returnableAccounted(lsr)) return [];

  let anchor: { posId: string; sectionId: string } | null = null;
  const found = new Set<string>();

  for (const section of lsr.sections) {
    if (section.category !== "демонтажные") continue;
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      const t = rate.title.toLowerCase();
      for (const rule of RECLAIMABLE_RULES) {
        if (rule.keywords.some((k) => t.includes(k))) {
          found.add(rule.material);
          if (!anchor) anchor = { posId: pos.id, sectionId: section.id };
        }
      }
    }
  }

  if (!anchor || found.size === 0) return [];

  const list = [...found].map((m) => `   • ${m}`).join("\n");
  return [
    {
      id: `returnable-sums-missing-${anchor.posId}`,
      severity: "warning",
      scenario: "returnable-sums-missing",
      context: { positionId: anchor.posId, sectionId: anchor.sectionId },
      title: "Не учтены возвратные суммы от разборки",
      message:
        `Демонтаж образует материалы, годные для повторного использования или сдачи:\n${list}\n` +
        `Их стоимость должна вычитаться из сметы отдельной строкой «возвратные суммы» со знаком минус. ` +
        `Сейчас такой строки нет — итог завышен.`,
      suggestion:
        `Добавьте в конце ЛСР строку «Возвратные суммы» (минус). Стоимость возврата считают по массе ` +
        `годного материала × цена реализации (металлолом, кирпич) или × долю годности. ` +
        `Отметьте учёт возврата в примечании позиции (слово «возврат»), чтобы снять это замечание.`,
      reference: "СН РК 8.02-05; МДС 81-35 п. 4.36 — возвратные суммы от разборки",
    },
  ];
}
