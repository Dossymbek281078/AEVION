/**
 * Подкладывание реальных цен ССЦ РК 8.04-08-2025 к материалам учебных расценок.
 *
 * Map материал → ССЦ-код генерится Python-скриптом raw-corpus/match-seed-to-ssc.py
 * fuzzy-матчингом (пересечение значимых токенов + совпадение единицы измерения).
 * Покрытие сейчас ~58% (147/254 материалов). Остальное — учебная цена fallback.
 */

import map from "../data/material-ssc-map.json";

export type MaterialPriceSource = "ssc" | "edu";

export type MaterialMatch = {
  name: string;
  unit: string;
  sscCode: string;
  sscName: string;
  sscBook: string;
  score: number;
  smetnaya: number;
  otpusknaya: number | null;
};

export type MaterialUnmatched = {
  name: string;
  unit: string;
};

const matchedIndex = new Map<string, MaterialMatch>();
for (const m of map.materials as MaterialMatch[]) {
  matchedIndex.set(`${m.name.toLowerCase()}|${m.unit}`, m);
}

const unmatchedIndex = new Set<string>();
for (const m of map.unmatched as MaterialUnmatched[]) {
  unmatchedIndex.add(`${m.name.toLowerCase()}|${m.unit}`);
}

/** Найти ССЦ-цену для материала (по имени + единице). */
export function findSscMatch(name: string, unit: string): MaterialMatch | null {
  return matchedIndex.get(`${name.toLowerCase()}|${unit}`) ?? null;
}

/** Получить эффективную цену + источник. */
export function resolveMaterialPrice(
  name: string,
  unit: string,
  educationPrice: number,
): { price: number; source: MaterialPriceSource; match?: MaterialMatch } {
  const m = findSscMatch(name, unit);
  if (m && m.smetnaya > 0) {
    return { price: m.smetnaya, source: "ssc", match: m };
  }
  return { price: educationPrice, source: "edu" };
}

export const materialMapMeta = {
  version: map.version,
  region: map.region,
  generatedAt: map.generated_at,
  matched: (map.materials as MaterialMatch[]).length,
  unmatched: (map.unmatched as MaterialUnmatched[]).length,
  total:
    (map.materials as MaterialMatch[]).length +
    (map.unmatched as MaterialUnmatched[]).length,
};

export function listMatched(): MaterialMatch[] {
  return map.materials as MaterialMatch[];
}

export function listUnmatched(): MaterialUnmatched[] {
  return map.unmatched as MaterialUnmatched[];
}
