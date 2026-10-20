/**
 * Экзамен различает «нашёл ошибку» и «ничего не делал».
 *
 * ПОВОДЫ (20.10.2026, замер всех 21 кейсов):
 *  1) эталон, сданный как решение, получал 84–96, не 100 — штраф за мягкие замечания советника,
 *     которые он ставит и эталону;
 *  2) заготовка без единой правки получала 57–96 — выше порога сдачи 70; у «лестницы»
 *     найденная ошибка давала +4. Слово Оркестратора: без правок — НИЖЕ порога,
 *     с исправленной спрятанной ошибкой (и больше ничего) — ВЫШЕ, эталон = 100.
 *
 * «Исправленная» = заготовка, в которой исправлено только то, чем она отличается от эталона:
 * её служебные id/title остаются, содержание разделов — эталонное (замер: других отличий
 * у заготовки нет, кроме id/title шапки и разделов).
 * Сторож печатает три числа по каждому кейсу.
 */
import { describe, it, expect } from "vitest";
import { EXAM_TASKS } from "./examTasks";
import { gradeExam, критерииСпрятаннойОшибки } from "./examGrader";
import { LMS_PASS_THRESHOLD } from "./lms";
import type { Lsr } from "./types";

function исправленная(starter: Lsr, reference: Lsr): Lsr {
  return {
    ...reference,
    id: starter.id,
    title: starter.title,
    sections: reference.sections.map((sec, i) => ({ ...sec, id: starter.sections[i]?.id ?? sec.id, title: starter.sections[i]?.title ?? sec.title })),
  };
}

describe("экзамен: заготовка < порога ≤ исправленная, эталон = 100", () => {
  it("банк не пуст и порог сдачи 70 (знаменатель)", () => {
    expect(EXAM_TASKS.length).toBeGreaterThanOrEqual(20);
    expect(LMS_PASS_THRESHOLD).toBe(70);
  });

  const строки: string[] = [];
  for (const t of EXAM_TASKS) {
    it(`${t.id}`, () => {
      const опц = { starter: t.starter };
      const заготовка = gradeExam(t.starter, t.reference, t.object, undefined, опц);
      const испр = gradeExam(исправленная(t.starter, t.reference), t.reference, t.object, undefined, опц);
      const эталон = gradeExam(t.reference, t.reference, t.object, undefined, опц);
      строки.push(`${t.id}: заготовка ${заготовка.score} | исправленная ${испр.score} | эталон ${эталон.score} | критериев ${критерииСпрятаннойОшибки(t.starter, t.reference).length}`);
      expect(критерииСпрятаннойОшибки(t.starter, t.reference).length, "заготовка не отличается от эталона — нечего искать").toBeGreaterThan(0);
      expect(заготовка.hiddenError?.fixed).toBe(false);
      expect(заготовка.score).toBeLessThan(LMS_PASS_THRESHOLD);
      expect(испр.hiddenError?.fixed).toBe(true);
      expect(испр.score).toBeGreaterThanOrEqual(LMS_PASS_THRESHOLD);
      expect(эталон.score).toBe(100);
    });
  }

  it("печать трёх чисел по каждому кейсу", () => {
    console.log("\nЭКЗАМЕН — три числа по кейсам:\n" + строки.join("\n"));
    expect(строки.length).toBe(EXAM_TASKS.length);
  });

  it("без заготовки поведение прежнее (потолка нет, hiddenError = null)", () => {
    const t = EXAM_TASKS[0];
    const r = gradeExam(t.starter, t.reference, t.object);
    expect(r.hiddenError).toBeNull();
    expect(r.score).toBeGreaterThan(69);
  });
});
