/**
 * Эталон экзамена, сданный как решение, получает 100; заготовка со спрятанной ошибкой — меньше 100.
 *
 * ПОВОД (20.10.2026, замер всех 21 кейсов): эталон против самого себя давал 84–96 —
 * оценщик штрафовал за мягкие замечания советника, которые советник ставит и эталону
 * («Индекс заметно устарел» стареет с календарём). Безупречная смета не могла дать 100.
 */
import { describe, it, expect } from "vitest";
import { EXAM_TASKS } from "./examTasks";
import { gradeExam } from "./examGrader";

describe("оценка экзамена", () => {
  it("банк не пуст (знаменатель)", () => {
    expect(EXAM_TASKS.length).toBeGreaterThanOrEqual(20);
  });
  for (const t of EXAM_TASKS) {
    it(`${t.id}: эталон = 100, заготовка < 100`, () => {
      expect(gradeExam(t.reference, t.reference, t.object).score).toBe(100);
      expect(gradeExam(t.starter, t.reference, t.object).score).toBeLessThan(100);
    });
  }
});
