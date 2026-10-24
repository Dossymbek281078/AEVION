import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { TRAINING_TEXT } from "../training/trainingText";

/**
 * /cyberchess/training на /en была русской целиком (30 из 32 строк, замер 24.10.2026).
 * Тексты — в trainingText.ts, данные (тренажёры, варианты, ресурсы) переводятся при выводе.
 * Сторож: каждый tt(L, "…") и каждое значение из списков страницы имеет en и kk.
 */
const СТРАНИЦА = readFileSync(join(__dirname, "..", "training", "page.tsx"), "utf8");

describe("тексты /cyberchess/training", () => {
  it("каждый вызов и каждое значение данных — с en и kk", () => {
    const вызовы = [...СТРАНИЦА.matchAll(/tt\(L, "([^"]+)"\)/g)].map((m) => m[1]);
    const данные = [...СТРАНИЦА.matchAll(/\b(?:name|desc|label|drillName|reps): "([^"]+)"/g)]
      .map((m) => m[1]).filter((v) => v !== "AEVION" && v !== "Chess training");
    expect(вызовы.length, "вызовов tt").toBeGreaterThan(25);
    expect(данные.length, "значений данных").toBeGreaterThan(40);
    const все = [...new Set([...вызовы, ...данные])];
    for (const loc of ["en", "kk"] as const) {
      expect(все.filter((k) => !TRAINING_TEXT[k]?.[loc]), `без ${loc}`).toEqual([]);
    }
  });

  it("английский текст без кириллицы", () => {
    expect(Object.entries(TRAINING_TEXT).filter(([, v]) => /[А-Яа-яЁё]/.test(v.en ?? "")).map(([k]) => k)).toEqual([]);
  });
});
