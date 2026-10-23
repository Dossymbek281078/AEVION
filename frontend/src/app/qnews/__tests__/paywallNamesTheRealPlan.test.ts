import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 23.10.2026, прод 98e0a4030: гость /qnews видел «Лента QNews входит в тариф
// Lite и выше», а тарифа Lite нет с 19.10 — один план «AEVION Планета» (его же
// называет ответ 402 бэкенда, поле requiredPlan). Человек искал бы на /pricing
// то, чего там нет.
const PAGE = fs.readFileSync(path.resolve(__dirname, "..", "page.tsx"), "utf8");

describe("отказ ленты называет тот план, что продаётся", () => {
  test("в тексте отказа — «AEVION Планета», «тарифа Lite» нет", () => {
    expect(PAGE).toContain("Лента QNews входит в план «AEVION Планета»");
    expect(PAGE).not.toMatch(/тариф Lite/);
  });
});
