import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TERM_TIERS, TERM_MONTHS, TERM_FACTOR, PLANET_BASE_MONTHLY, PLANET_TERM_PRICE, STANDALONE_APPS, planetPricePerMonth, planetTotal, planetFromPerMonth } from "../termPricing";
import { readdirSync, statSync } from "node:fs";

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
  // 20.09.2026: приложений стало девять — по слову основателя «везде должны быть цены»
  // добавлены QRight, QSign, Startup Exchange, QSkyway. Ступеней срока по-прежнему пять.
  test("КОНТРОЛЬ прибора: в источнике нашлись все три таблицы и девять приложений", () => {
    expect(Object.keys(record("TERM_MONTHS"))).toHaveLength(5);
    expect(Object.keys(record("TERM_FACTOR"))).toHaveLength(5);
    expect([...backend.matchAll(/\{ slug: "[^"]+", moduleId: "[^"]+", name: "[^"]+", baseMonthly: \d+(?:, yearOnlyUsd: \w+)? \}/g)]).toHaveLength(9);
  });

  test("сроки и доли цены", () => {
    expect(record("TERM_MONTHS")).toEqual(TERM_MONTHS);
    expect(record("TERM_FACTOR")).toEqual(TERM_FACTOR);
    expect(Object.keys(TERM_MONTHS)).toEqual([...TERM_TIERS]);
  });

  test("цена всей планеты", () => {
    expect(Number(/export const PLANET_BASE_MONTHLY = (\d+);/.exec(backend)?.[1])).toBe(PLANET_BASE_MONTHLY);
    // 🔴 19.10.2026: у плана своя лесенка (слово основателя), литералы — решение человека
    expect(record("PLANET_TERM_PRICE")).toEqual(PLANET_TERM_PRICE);
    expect(TERM_TIERS.map((t) => planetPricePerMonth(t))).toEqual([250, 225, 200, 175, 150]);
    expect(TERM_TIERS.map((t) => planetTotal(t))).toEqual([250, 675, 1200, 1575, 1800]);
    expect(planetFromPerMonth()).toBe(150);
    expect(PLANET_TERM_PRICE.lite).toBe(PLANET_BASE_MONTHLY);
  });
  test("🔴 ни одна страница не считает планету старой формулой termPricePerMonth(PLANET_BASE_MONTHLY…)", () => {
    // 250 × 0.875 = 218.75: на бэке это throw, на сайте — тихая неверная цена. Поэтому запрет на уровне исходников.
    const src = join(root, "frontend", "src");
    const файлы = [];
    const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== "node_modules") walk(p); } else if (/\.(ts|tsx)$/.test(n) && !/\.test\.|__tests__/.test(p)) файлы.push(p); } };
    walk(src);
    const нарушители = файлы.filter((p) => /(termPricePerMonth|termTotal|fromPricePerMonth)\(PLANET_BASE_MONTHLY/.test(readFileSync(p, "utf8")));
    expect(файлы.length, "контроль прибора: файлы прочитаны").toBeGreaterThan(100);
    expect(нарушители.map((p) => p.slice(src.length)), `нарушителей ${нарушители.length} из ${файлы.length}`).toEqual([]);
  });

  test("пять отдельных приложений и их базы", () => {
    // 19.10.2026: годовое приложение несёт yearOnlyUsd (у шахмат — CHESS_YEARLY_USD из того же файла).
    const chessYearly = Number(/export const CHESS_YEARLY_USD = (\d+);/.exec(backend)?.[1]);
    expect(chessYearly).toBe(50);
    const fromBackend = [...backend.matchAll(/\{ slug: "([^"]+)", moduleId: "([^"]+)", name: "([^"]+)", baseMonthly: (\d+)(?:, yearOnlyUsd: (\w+))? \}/g)].map(
      (m) => ({ slug: m[1], moduleId: m[2], name: m[3], baseMonthly: Number(m[4]), ...(m[5] ? { yearOnlyUsd: m[5] === "CHESS_YEARLY_USD" ? chessYearly : Number(m[5]) } : {}) }),
    );
    expect(fromBackend).toEqual(STANDALONE_APPS);
  });
});
