import type { Lsr, AiNotice, LearningObject } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: фасадные / высотные отделочные работы без позиции на леса.
 * При высоте здания / помещения > 4 м внутренние, > 2.7 м наружные —
 * нужны строительные леса (Layher / Peri Up) с отдельной расценкой.
 *
 * Триггер: высота объекта ≥ 4 м (для room geometry) + есть отделочные работы,
 * но нет позиции «лес» в смете.
 */
export function checkScaffoldingMissing(lsr: Lsr, object: LearningObject): AiNotice[] {
  const notices: AiNotice[] = [];
  const geomHeight = object.geometry?.kind === "room" ? object.geometry.height : 0;
  if (geomHeight < 4) return notices;

  // Есть ли в смете лeса?
  let hasScaffolding = false;
  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      const t = rate.title.toLowerCase();
      if (t.includes("лес") && (t.includes("строит") || t.includes("трубч") || t.includes("монтаж") || t.includes("подмост"))) {
        hasScaffolding = true;
        break;
      }
    }
    if (hasScaffolding) break;
  }

  if (hasScaffolding) return notices;

  // Триггер: отделочные / кровельные / фасадные работы есть?
  let trigger: { posId: string; sectionId: string; title: string } | null = null;
  for (const section of lsr.sections) {
    if (!["отделочные", "кровельные"].includes(section.category)) continue;
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      trigger = { posId: pos.id, sectionId: section.id, title: rate.title };
      break;
    }
    if (trigger) break;
  }
  if (!trigger) return notices;

  notices.push({
    id: `scaffolding-missing-${trigger.posId}`,
    severity: "warning",
    scenario: "scaffolding-missing",
    context: { positionId: trigger.posId, sectionId: trigger.sectionId },
    title: "Возможна пропущенная позиция на леса/подмости",
    message:
      `Высота объекта ${geomHeight} м (> 4 м) требует строительных лесов или подмостей ` +
      `для безопасной работы. В смете нет соответствующей позиции.`,
    suggestion:
      `Добавьте позицию «Монтаж/демонтаж строительных лесов» (Layher Allround или ` +
      `трубчатые ТСУ), измеритель — м² проекции лесов на фасад × срок аренды.`,
    reference: "СН РК 1.03-05 «Охрана труда в строительстве», п. 7.2-7.4 + ЕНиР Сб.3",
  });
  return notices;
}
