import { describe, it, expect } from "vitest";
import { LESSONS } from "../coachLessons";

/* Уроки идут цепочкой: у каждого есть номер и предшественник. Ошибка здесь ничего не
   ломает вслух — урок просто становится недостижимым или встаёт не туда в порядке, и
   человек этого не видит. Проверяется структура, а не содержание: позиции уроков уже
   покрыты coachPositions.test.ts. */

describe("lesson progression", () => {
  const ids = new Set(LESSONS.map((l) => l.id));

  it("ships a course, not a stub", () => {
    expect(LESSONS.length).toBeGreaterThan(5);
  });

  it("points every prerequisite at a lesson that exists", () => {
    const broken = LESSONS.filter((l) => l.prerequisite && !ids.has(l.prerequisite)).map(
      (l) => `${l.id} → ${l.prerequisite}`,
    );
    expect(broken).toEqual([]);
  });

  it("never depends on a lesson that comes later", () => {
    const byId = new Map(LESSONS.map((l) => [l.id, l]));
    const wrong: string[] = [];
    for (const l of LESSONS) {
      if (!l.prerequisite) continue;
      const p = byId.get(l.prerequisite);
      if (p && p.num >= l.num) wrong.push(`${l.id} (№${l.num}) ← ${p.id} (№${p.num})`);
    }
    expect(wrong).toEqual([]);
  });

  it("numbers each lesson once", () => {
    const nums = LESSONS.map((l) => l.num);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("gives every lesson at least one step and a closing line", () => {
    const empty = LESSONS.filter((l) => !l.steps?.length || !l.closing).map((l) => l.id);
    expect(empty).toEqual([]);
  });

  /* Упражнение без ответа не проверить, а теория с ответом сбивает: показывает
     «правильный ход» там, где ходить не просят. */
  it("attaches a best move to exercises and not to theory", () => {
    const wrong: string[] = [];
    for (const l of LESSONS) {
      l.steps.forEach((s, i) => {
        if (s.kind === "exercise" && s.fen && !s.bestMove) wrong.push(`${l.id}[${i}]: упражнение без ответа`);
        if (s.kind === "theory" && s.bestMove) wrong.push(`${l.id}[${i}]: теория с ответом`);
      });
    }
    expect(wrong).toEqual([]);
  });
});
