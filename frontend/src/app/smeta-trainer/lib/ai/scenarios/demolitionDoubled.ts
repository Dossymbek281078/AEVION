import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: демонтаж старой штукатурки + новая штукатурка, при этом
 * объём одинаковый. Часто студенты считают объём демонтажа по полной площади
 * стены, а потом ту же площадь — под новую штукатурку. Это может быть верно,
 * но иногда демонтаж точечный (только повреждённый участок), а штукатурка по всему.
 *
 * Триггер: есть и демонтажная, и аналогичная новая позиция (штукатурка/окраска/стяжка) —
 * подсветка для проверки соответствия объёмов.
 */
const PAIRS = [
  { demo: "штукатур", install: "штукатур", surface: "штукатурки" },
  { demo: "стяжк", install: "стяжк", surface: "стяжки" },
  { demo: "линолеум", install: "линолеум", surface: "линолеума" },
  { demo: "плит", install: "плит", surface: "плитки" },
  { demo: "окрас", install: "окрас", surface: "окраски" },
];

export function checkDemolitionDoubled(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  // Find pairs of demolition + install for same surface
  for (const { surface, demo, install } of PAIRS) {
    let demoEntry: { posId: string; sectionId: string; volume: number; title: string } | null = null;
    let installEntry: { posId: string; sectionId: string; volume: number; title: string } | null = null;

    for (const section of lsr.sections) {
      for (const pos of section.positions) {
        const rate = findRate(pos.rateCode);
        if (!rate) continue;
        const t = rate.title.toLowerCase();
        const isDemo = section.category === "демонтажные" && t.includes(demo);
        const isInstall = section.category !== "демонтажные" && t.includes(install);
        if (isDemo && !demoEntry) demoEntry = { posId: pos.id, sectionId: section.id, volume: pos.volume, title: rate.title };
        if (isInstall && !installEntry) installEntry = { posId: pos.id, sectionId: section.id, volume: pos.volume, title: rate.title };
      }
    }

    if (demoEntry && installEntry && Math.abs(demoEntry.volume - installEntry.volume) < 0.01) {
      notices.push({
        id: `demolition-doubled-${surface}-${demoEntry.posId}`,
        severity: "info",
        scenario: "demolition-doubled",
        context: { positionId: demoEntry.posId, sectionId: demoEntry.sectionId },
        title: `Объёмы демонтажа и устройства ${surface} совпадают`,
        message:
          `Демонтаж «${demoEntry.title}» = ${demoEntry.volume}, новое устройство «${installEntry.title}» = ${installEntry.volume}. ` +
          `Проверьте: иногда демонтаж точечный (повреждённый участок), а новая работа — по всей площади.`,
        suggestion:
          `Откройте дефектный акт. Если демонтаж только локальный — уменьшите volume демонтажа. ` +
          `Если же реновация полная — оставьте равными и убедитесь, что вывоз мусора учтён.`,
        reference: "МДС 81-35 + методика составления дефектных актов СН РК 1.02-22",
      });
    }
  }
  return notices;
}
