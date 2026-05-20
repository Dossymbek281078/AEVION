import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: смета большого объёма работ без перевозки материалов / вывоза мусора.
 * Если в смете есть земляные работы (грунт), бетон (доставка ЖБК), демонтаж (вывоз отходов),
 * но нет позиции «перевозка / вывоз» — это пропуск.
 *
 * Триггер: есть демонтажные ИЛИ земляные ИЛИ бетонные работы с volume > 10,
 * но нет «перевозк», «вывоз», «доставк», «транспорт» в любой позиции.
 */
export function checkTransportMissing(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  let hasBulkWork = false;
  let bulkSection: { id: string; title: string } | null = null;
  let trigger: { posId: string; title: string } | null = null;

  for (const section of lsr.sections) {
    if (!["земляные", "демонтажные", "общестроительные", "кровельные"].includes(section.category)) continue;
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      if (pos.volume < 10) continue;
      hasBulkWork = true;
      bulkSection = { id: section.id, title: section.title };
      trigger = { posId: pos.id, title: rate.title };
      break;
    }
    if (hasBulkWork) break;
  }

  if (!hasBulkWork || !trigger || !bulkSection) return notices;

  // Поиск транспортной позиции
  let hasTransport = false;
  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      const t = rate.title.toLowerCase();
      if (t.includes("перевозк") || t.includes("вывоз") || t.includes("доставк") || t.includes("транспорт")) {
        hasTransport = true;
        break;
      }
    }
    if (hasTransport) break;
  }

  if (hasTransport) return notices;

  notices.push({
    id: `transport-missing-${trigger.posId}`,
    severity: "warning",
    scenario: "transport-missing",
    context: { positionId: trigger.posId, sectionId: bulkSection.id },
    title: "Возможно пропущена транспортировка / вывоз отходов",
    message:
      `В смете есть значительный объём «${trigger.title}», но не учтена транспортировка ` +
      `(вывоз грунта/мусора, доставка материалов). ` +
      `Перевозка — самостоятельная позиция в смете и обычно ≥ 5-15% общей стоимости.`,
    suggestion:
      `Добавьте позицию: «Перевозка грузов автотранспортом до X км» (т×км или м³×км). ` +
      `Дальность согласовывается с генпланом и местом утилизации.`,
    reference: "СН РК 8.04-01-2024, Сб.1 «Земляные работы», прил. 4 «Транспортные расходы»",
  });
  return notices;
}
