import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Совет тренера отсылает человека в раздел ПО ИМЕНИ. Если имя не совпадает
 * с тем, что написано на экране, человек идёт искать и не находит: до
 * 29.08.2026 советы звали в "Coach Knowledge", "Studio" и "Masters tab",
 * тогда как разделы называются «База знаний», «Студия» и «Изучение партий
 * мастеров». Тесты этого не видели — совет отрисовывался исправно.
 */
const dir = join(__dirname, "..");
const sovety = readFileSync(join(dir, "CoachKnowledgeModal.tsx"), "utf8");
const baza = readFileSync(join(dir, "coachKnowledge.ts"), "utf8");

const nazvaniyaRazdelov = new Set(
  [...baza.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]),
);
// разделы модуля, живущие вне базы знаний
const vneBazy = ["Студия", "База знаний", "Изучение партий мастеров"];

const sovetyList = [...sovety.matchAll(/rec: "([^"]+)"/g)].map((m) => m[1]);

describe("советы тренера называют разделы их настоящими именами", () => {
  it("советы вообще есть — иначе проверка ничего не проверяет", () => {
    expect(sovetyList.length).toBeGreaterThan(5);
    expect(nazvaniyaRazdelov.size).toBeGreaterThan(20);
  });

  it("каждое имя в кавычках «…» существует как раздел", () => {
    const nesushchestvuyushchie: string[] = [];
    for (const s of sovetyList) {
      // отсылкой считается имя, введённое словом «раздел»: кавычки в
      // модуле используются и для цитат («мат в 1» — это серия задач
      // тренажёра, а не раздел, и на такой совет краснеть нельзя)
      for (const m of s.matchAll(/(?:раздел|База знаний →)\s*«([^»]+)»/g)) {
        const imya = m[1];
        if (!nazvaniyaRazdelov.has(imya) && !vneBazy.includes(imya)) {
          nesushchestvuyushchie.push(imya);
        }
      }
    }
    expect(nesushchestvuyushchie).toEqual([]);
  });

  it("совет не зовёт в раздел английским именем", () => {
    // имена шахматистов и обозначения допустимы, названия разделов — нет
    const chuzhieImena = ["Coach Knowledge", "Studio", "Masters tab", "Knowledge tab"];
    const najdeno = sovetyList.filter((s) =>
      chuzhieImena.some((n) => s.includes(n)),
    );
    expect(najdeno).toEqual([]);
  });
});
