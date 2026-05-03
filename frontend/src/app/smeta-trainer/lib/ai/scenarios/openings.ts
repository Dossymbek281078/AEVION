// Сценарий: студент забыл вычесть проёмы из площади стен под окраску/штукатурку/шпатлёвку.
//
// Логика проверки:
//   1. Берём учебный объект ЛСР (через objectId).
//   2. Если у объекта есть geometry — считаем gross/net площадь стен.
//   3. Для каждой позиции с категорией «отделочные» и единицей «100 м²», название которой
//      связано со стенами (окраска / штукатурка / шпатлёвка) — сверяем введённый объём
//      с gross_area/100 (с допуском).
//   4. Если совпадает в пределах 1% — это сигнал, что студент использовал брутто.
//   5. Возвращаем AiNotice с подсказкой и правильным значением.

import type { Lsr, AiNotice, LearningObject, SmetaPosition, Rate } from "../../types";
import { findRate } from "../../corpus";
import { grossWallArea, netWallArea } from "../geometry";

const WALL_KEYWORDS = ["стен", "стене", "стены"];
const SUSPECT_TITLES_KEYWORDS = ["окраск", "штукатур", "шпатлёвк", "шпатлевк"];

function isWallSurfaceWork(rate: Rate): boolean {
  const t = rate.title.toLowerCase();
  if (rate.unit !== "100 м²") return false;
  if (!SUSPECT_TITLES_KEYWORDS.some((k) => t.includes(k))) return false;
  if (!WALL_KEYWORDS.some((k) => t.includes(k))) return false;
  return true;
}

/** Найти позиции с подозрением на нечёт проёмов. Возвращает массив AiNotice. */
export function detectMissingOpeningSubtraction(lsr: Lsr, object: LearningObject): AiNotice[] {
  const notices: AiNotice[] = [];
  if (!object.geometry || object.geometry.kind !== "room") return notices;

  const gross = grossWallArea(object.geometry);
  const net = netWallArea(object.geometry);
  // Допуск 1% — учёт округлений.
  const tolerance = 0.01;

  for (const section of lsr.sections) {
    for (const position of section.positions) {
      const rate = findRate(position.rateCode);
      if (!rate) continue;
      if (!isWallSurfaceWork(rate)) continue;

      // У нормы единица «100 м²»: введённый volume — это число «сотен метров».
      const enteredArea = position.volume * 100;
      const grossDeviation = Math.abs(enteredArea - gross) / gross;
      const netDeviation = Math.abs(enteredArea - net) / net;

      if (grossDeviation < tolerance && netDeviation > tolerance) {
        // Объём близок к брутто, далёк от нетто → студент забыл вычесть.
        notices.push({
          id: `openings-${position.id}`,
          severity: "error",
          scenario: "missing-opening-subtraction",
          context: { positionId: position.id, sectionId: section.id },
          title: "Забыли вычесть проёмы из площади стен",
          message:
            `В позиции «${rate.title}» введён объём ${position.volume.toFixed(2)} (= ${enteredArea.toFixed(2)} м²), что соответствует **общей площади стен без вычета окон и дверей**. ` +
            `Площадь стен брутто: ${gross.toFixed(2)} м². Площадь нетто (с вычетом проёмов): ${net.toFixed(2)} м².`,
          suggestion:
            `Замените объём на ${(net / 100).toFixed(4)} (= ${net.toFixed(2)} м² нетто). ` +
            `Откосы окон и дверей — это **отдельная позиция**, не часть площади стен.`,
          reference: "СН РК 8.02-01 + техническая часть сборника отделочных работ",
        });
      }
    }
  }

  return notices;
}
