import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: финишная окраска / шпатлёвка / обои есть, а подготовка поверхности — нет.
 * Под покраску стен почти всегда нужна шпатлёвка, а под обои — грунтовка.
 *
 * Триггер: позиция с окраской/обоями, и НЕТ позиции на ту же поверхность с шпатлёвкой/грунтовкой.
 */
const FINISH_KEYWORDS = [
  { pattern: "окраск", needs: ["шпатлёвк", "шпатлевк", "грунт"], surface: "под окраску" },
  { pattern: "обоев", needs: ["шпатлёвк", "шпатлевк", "грунт"], surface: "под обои" },
  { pattern: "облицовк", needs: ["грунт"], surface: "под облицовку" },
];

export function checkMissingPreparation(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  // Собираем все названия работ в смете для cross-check
  const allTitles: { pos: { id: string; rateCode: string }; sectionId: string; title: string }[] = [];
  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      allTitles.push({ pos: { id: pos.id, rateCode: pos.rateCode }, sectionId: section.id, title: rate.title.toLowerCase() });
    }
  }

  for (const entry of allTitles) {
    for (const { pattern, needs, surface } of FINISH_KEYWORDS) {
      if (!entry.title.includes(pattern)) continue;
      // Ищем позицию с подготовкой в той же смете
      const hasPrep = allTitles.some((other) => other.pos.rateCode !== entry.pos.rateCode && needs.some((n) => other.title.includes(n)));
      if (hasPrep) continue;

      notices.push({
        id: `missing-preparation-${entry.pos.id}`,
        severity: "warning",
        scenario: "missing-preparation",
        context: { positionId: entry.pos.id, sectionId: entry.sectionId },
        title: "Финиш без подготовки поверхности",
        message:
          `В смете есть финишная работа «${entry.title}» ${surface}, но не найдена ` +
          `соответствующая подготовка (${needs.join(" / ")}). ` +
          `Качественная окраска/наклейка требует подготовленной основы.`,
        suggestion:
          `Добавьте позицию с подготовкой поверхности: шпатлёвка (1-2 слоя), ` +
          `грунтование (обязательно перед окраской и оклейкой).`,
        reference: "СНиП 3.04.01 «Изоляционные и отделочные покрытия», п. 3.12-3.18",
      });
    }
  }
  return notices;
}
