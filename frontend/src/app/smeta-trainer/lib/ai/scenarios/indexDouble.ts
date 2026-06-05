import type { Lsr, AiNotice } from "../../types";
import { findRate, findIndex } from "../../corpus";

/**
 * Сценарий: двойной учёт индекса по материалу.
 * При базисно-индексном методе в смету вводят **базисную** цену материала, а
 * пересчёт к текущему уровню делает индекс (toMaterials) автоматически.
 * Студент иногда ставит уже **текущую** (индивидуальную) цену материала —
 * и калькулятор умножает её на индекс повторно. Стоимость материала
 * завышается примерно в toMaterials раз.
 *
 * Триггер: метод «базисно-индексный», индекс найден и toMaterials заметно >1,
 * у позиции есть resourceOverrides, где цена материала ≈ нормативная × индекс
 * (т.е. цена уже «в текущем уровне»).
 *
 * Отличие от material-price-unjustified: там — любое отклонение цены без
 * обоснования; здесь — методическая ошибка именно базисно-индексного метода.
 */
const INDEX_MEANINGFUL = 1.05; // индекс материалов считаем значимым от +5%
const ALREADY_CURRENT = 0.85; // цена ≥ нормативная × индекс × 0.85 → уже текущая

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function checkIndexDouble(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];
  if (lsr.method !== "базисно-индексный") return notices;

  const idx = findIndex(lsr.indexRegion, lsr.indexQuarter);
  if (!idx || idx.toMaterials < INDEX_MEANINGFUL) return notices;

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      if (!pos.resourceOverrides || pos.resourceOverrides.length === 0) continue;
      const rate = findRate(pos.rateCode);
      if (!rate) continue;

      const baseline = new Map<string, number>();
      for (const r of rate.resources) {
        if (r.kind === "материал") baseline.set(normName(r.name), r.basePrice);
      }

      for (const r of pos.resourceOverrides) {
        if (r.kind !== "материал") continue;
        const base = baseline.get(normName(r.name));
        if (base === undefined || base <= 0) continue;
        const ratio = r.basePrice / base;
        // Цена уже выглядит «текущей»: близка к базисной × индекс (или выше).
        if (ratio < idx.toMaterials * ALREADY_CURRENT) continue;

        const afterIndex = Math.round(r.basePrice * idx.toMaterials);
        notices.push({
          id: `index-double-${pos.id}-${normName(r.name)}`,
          severity: "error",
          scenario: "index-double",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Похоже на двойной индекс по «${r.name}»`,
          message:
            `Цена «${r.name}» = ${r.basePrice.toLocaleString("ru-RU")} ₸ ≈ базисная × индекс материалов ` +
            `(×${idx.toMaterials}), то есть уже в текущем уровне. При базисно-индексном методе индекс ` +
            `применится ещё раз → ≈ ${afterIndex.toLocaleString("ru-RU")} ₸ за единицу (переоценка в ~${idx.toMaterials} раза).`,
          suggestion:
            `Введите БАЗИСНУЮ цену материала (≈ ${base.toLocaleString("ru-RU")} ₸) — индекс ×${idx.toMaterials} ` +
            `калькулятор применит сам. Либо перейдите на ресурсный метод и отключите индексы.`,
          reference: "СН РК 8.04-07, методика базисно-индексного расчёта (индекс применяется однократно)",
        });
        break; // одно замечание на позицию
      }
    }
  }

  return notices;
}
