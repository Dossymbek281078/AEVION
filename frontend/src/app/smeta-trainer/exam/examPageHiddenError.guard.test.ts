/**
 * Страница экзамена передаёт заготовку оценщику и говорит студенту, что в ней спрятана ошибка
 * (20.10.2026: без строки студент принимал балл нетронутой заготовки за свою работу).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");

describe("страница экзамена", () => {
  it("оценщик получает заготовку", () => {
    expect(SRC).toContain("gradeExam(lsr, task!.reference, task!.object, undefined, { starter: task!.starter })");
  });
  it("над «Моё решение» — строка про спрятанную ошибку; после проверки — исправлена/нет", () => {
    expect(SRC).toContain("В заготовке спрятана ошибка — найдите и исправьте её.");
    expect(SRC).toContain("data-exam-hidden-error");
    expect(SRC.indexOf("data-exam-starter-note")).toBeGreaterThan(SRC.indexOf(">Моё решение<"));
  });
});
