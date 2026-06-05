import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: индивидуальная цена материала без обоснования (урок 2.6).
 * Студент переопределяет состав ресурсов и ставит свою цену материала,
 * заметно отличающуюся от нормативной (из расценки корпуса), но не оставляет
 * обоснование (note) — откуда взята цена (прайс поставщика, КП, мониторинг).
 *
 * По методике РК индивидуальная цена допускается, но требует документального
 * обоснования; в противном случае экспертиза вернёт смету.
 *
 * Триггер: позиция с resourceOverrides, где у материала basePrice отклоняется
 * от нормативной цены того же материала (по имени) более чем на 15%, а
 * pos.note пустой/не содержит ссылки на обоснование.
 */
const PRICE_TOLERANCE = 0.15; // 15%
const JUSTIFY_KEYWORDS = ["прайс", "кп", "коммерческ", "поставщик", "мониторинг", "счёт", "счет", "обоснован", "конъюнктур"];

function hasJustification(note?: string): boolean {
  if (!note) return false;
  const low = note.toLowerCase();
  return JUSTIFY_KEYWORDS.some((k) => low.includes(k));
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function checkMaterialPriceUnjustified(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      if (!pos.resourceOverrides || pos.resourceOverrides.length === 0) continue;
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      if (hasJustification(pos.note)) continue;

      // Нормативные цены материалов расценки по имени.
      const normPrice = new Map<string, number>();
      for (const r of rate.resources) {
        if (r.kind === "материал") normPrice.set(normName(r.name), r.basePrice);
      }

      for (const r of pos.resourceOverrides) {
        if (r.kind !== "материал") continue;
        const baseline = normPrice.get(normName(r.name));
        if (baseline === undefined || baseline <= 0) continue;
        const deviation = Math.abs(r.basePrice - baseline) / baseline;
        if (deviation <= PRICE_TOLERANCE) continue;

        const dir = r.basePrice > baseline ? "выше" : "ниже";
        notices.push({
          id: `material-price-unjustified-${pos.id}-${normName(r.name)}`,
          severity: "warning",
          scenario: "material-price-unjustified",
          context: { positionId: pos.id, sectionId: section.id },
          title: `Индивидуальная цена «${r.name}» без обоснования`,
          message:
            `Цена материала «${r.name}» = ${r.basePrice.toLocaleString("ru-RU")} ₸ — на ${Math.round(
              deviation * 100
            )}% ${dir} нормативной (${baseline.toLocaleString("ru-RU")} ₸), а обоснование в заметке отсутствует.`,
          suggestion:
            `Добавьте в заметку позиции ссылку на обоснование цены: прайс поставщика, ` +
            `коммерческое предложение, счёт или конъюнктурный анализ (мин. 3 КП).`,
          reference: "СН РК 8.04-08, п. о применении индивидуальных (текущих) цен материалов",
        });
        break; // одно замечание на позицию
      }
    }
  }

  return notices;
}
