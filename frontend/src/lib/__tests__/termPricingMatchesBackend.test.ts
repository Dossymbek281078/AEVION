import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TERM_TIERS, TERM_MONTHS, TERM_FACTOR, PLANET_BASE_MONTHLY, STANDALONE_APPS, termPricePerMonth } from "../termPricing";

/**
 * Лестница сроков живёт в двух TS-проектах без общего импорта: бэкенд
 * (data/pricing.ts — источник) и сайт (lib/termPricing.ts — копия для страниц).
 * Две копии одного числа расходятся молча, поэтому сверяем текст источника.
 */
const root = join(__dirname, "..", "..", "..", "..");
const backend = readFileSync(join(root, "aevion-globus-backend/src/data/pricing.ts"), "utf-8");

function record(name: string): Record<string, number> {
  const m = new RegExp(`export const ${name}: Record<TermTier, number> = \\{([^}]*)\\}`).exec(backend);
  if (!m) return {};
  return Object.fromEntries([...m[1].matchAll(/(\w+): ([\d.]+)/g)].map((x) => [x[1], Number(x[2])]));
}

describe("лестница сроков сайта совпадает с бэкендом", () => {
  test("КОНТРОЛЬ прибора: в источнике нашлись все три таблицы и пять приложений", () => {
    expect(Object.keys(record("TERM_MONTHS"))).toHaveLength(5);
    expect(Object.keys(record("TERM_FACTOR"))).toHaveLength(5);
    expect([...backend.matchAll(/\{ slug: "[^"]+", moduleId: "[^"]+", name: "[^"]+", baseMonthly: \d+ \}/g)]).toHaveLength(5);
  });

  test("сроки и доли цены", () => {
    expect(record("TERM_MONTHS")).toEqual(TERM_MONTHS);
    expect(record("TERM_FACTOR")).toEqual(TERM_FACTOR);
    expect(Object.keys(TERM_MONTHS)).toEqual([...TERM_TIERS]);
  });

  test("цена всей планеты", () => {
    expect(Number(/export const PLANET_BASE_MONTHLY = (\d+);/.exec(backend)?.[1])).toBe(PLANET_BASE_MONTHLY);
    expect(TERM_TIERS.map((t) => termPricePerMonth(PLANET_BASE_MONTHLY, t))).toEqual([400, 350, 300, 250, 200]);
  });

  test("пять отдельных приложений и их базы", () => {
    const fromBackend = [...backend.matchAll(/\{ slug: "([^"]+)", moduleId: "([^"]+)", name: "([^"]+)", baseMonthly: (\d+) \}/g)].map(
      (m) => ({ slug: m[1], moduleId: m[2], name: m[3], baseMonthly: Number(m[4]) }),
    );
    expect(fromBackend).toEqual(STANDALONE_APPS);
  });
});
