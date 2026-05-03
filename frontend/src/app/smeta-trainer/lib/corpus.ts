// Загрузка и доступ к учебному корпусу.
// Корпус — это статический JSON, импортируемый напрямую: Next.js встраивает его в bundle.

import seedJson from "../data/seed.json";
import type { Rate, OverheadRules, IndexSet, LearningObject } from "./types";

interface SeedShape {
  _meta: { version: string; snbVersion: string; description: string; lastReview: string };
  rates: Rate[];
  overheadRules: OverheadRules[];
  indexes: IndexSet[];
  objects: LearningObject[];
}

const seed = seedJson as unknown as SeedShape;

export const corpusMeta = seed._meta;
export const rates: Rate[] = seed.rates;
export const overheadRules: OverheadRules[] = seed.overheadRules;
export const indexes: IndexSet[] = seed.indexes;
export const learningObjects: LearningObject[] = seed.objects;

export function findRate(code: string): Rate | undefined {
  return rates.find((r) => r.code === code);
}

export function findOverhead(category: Rate["category"]): OverheadRules | undefined {
  return overheadRules.find((o) => o.category === category);
}

export function findIndex(region: string, quarter: string): IndexSet | undefined {
  return indexes.find((i) => i.region === region && i.quarter === quarter);
}

export function findObject(id: string): LearningObject | undefined {
  return learningObjects.find((o) => o.id === id);
}

/** Поиск расценок: по фрагменту шифра или текста, регистронезависимо. */
export function searchRates(query: string, limit = 20): Rate[] {
  if (!query.trim()) return rates.slice(0, limit);
  const q = query.toLowerCase();
  return rates
    .filter((r) => r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))
    .slice(0, limit);
}
