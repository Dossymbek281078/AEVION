import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: норматив расхода материала без учёта потерь / отходов.
 * Студенты часто ставят «чистый» расход материала (например 1.0 м² плитки на 1 м²
 * пола), забывая что фактически нужен запас 5-15% на бой, обрезку, подгонку.
 *
 * Триггер: позиция с resourceOverrides где плитка / линолеум / ламинат /
 * обои / гипсокартон / OSB указаны 1:1 без потерь.
 *
 * Типичные normy:
 *  - плитка 7-10% (нарезка, бой)
 *  - линолеум 3-5%
 *  - обои 10-15% (рисунок-подбор)
 *  - ГКЛ 7%
 *  - OSB / фанера 5-7%
 *  - паркет / ламинат 5-10%
 */
const MATERIAL_LOSS_RULES = [
  { name: ["плит"], minRatio: 1.07, loss: "7-10%" },
  { name: ["линолеум"], minRatio: 1.03, loss: "3-5%" },
  { name: ["обои"], minRatio: 1.10, loss: "10-15% (подбор рисунка)" },
  { name: ["гипсокартон", "гкл"], minRatio: 1.07, loss: "7%" },
  { name: ["osb", "фанер"], minRatio: 1.05, loss: "5-7%" },
  { name: ["паркет", "ламинат"], minRatio: 1.05, loss: "5-10%" },
];

export function checkWasteFactorMissing(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      const resources = pos.resourceOverrides ?? rate.resources;
      for (const r of resources) {
        if (r.kind !== "материал") continue;
        const nameLow = r.name.toLowerCase();
        for (const rule of MATERIAL_LOSS_RULES) {
          if (!rule.name.some((k) => nameLow.includes(k))) continue;
          // Если qtyPerUnit очень близок к 1.0 (для unit "м²") — нет учёта потерь
          if (r.unit === "м²" && r.qtyPerUnit > 0.95 && r.qtyPerUnit < rule.minRatio) {
            notices.push({
              id: `waste-factor-${pos.id}-${r.name}`,
              severity: "info",
              scenario: "waste-factor-missing",
              context: { positionId: pos.id, sectionId: section.id },
              title: `Не учтены потери материала «${r.name}»`,
              message:
                `Расход «${r.name}» = ${r.qtyPerUnit} ${r.unit} на 1 ${rate.unit}. ` +
                `Для этого материала типичный коэффициент потерь — ${rule.loss}, ` +
                `т.е. требуется примерно ${rule.minRatio.toFixed(2)} ${r.unit}.`,
              suggestion:
                `Увеличьте расход материала до ≥ ${rule.minRatio.toFixed(2)} ${r.unit} ` +
                `или поясните в note почему потери ниже типовых (например — крупный формат, прямые стены).`,
              reference: "ВСН 38-77 «Нормы расхода материалов в строительстве» + СН РК 8.04-08",
            });
          }
        }
      }
    }
  }
  return notices;
}
