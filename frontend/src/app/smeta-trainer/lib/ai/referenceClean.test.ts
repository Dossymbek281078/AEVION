import { describe, expect, it } from "vitest";
import { EXAM_TASKS } from "../examTasks";
import { runAiAdvisor } from "./index";

/**
 * Инвариант качества: эталон (reference) каждого экзамена — заведомо корректная
 * смета. Значит ни один детектор не имеет права выдавать на нём замечание уровня
 * `error` (грубая ошибка). Если выдаёт — это ложноположительное срабатывание
 * детектора либо ошибка в самом эталоне; и то и другое подрывает доверие к
 * AI-советнику. Этот тест ловит такие регрессии разом по всему банку.
 *
 * Warnings/info на эталоне допускаются: часть проверок — мягкие advisory-эвристики
 * (нет позиции на перевозку, не указана подготовка), которые методически могут не
 * применяться к конкретному учебному кейсу. Здесь караем только `error`.
 */
describe("эталоны экзаменов — без error-замечаний", () => {
  for (const t of EXAM_TASKS) {
    it(`${t.id}: эталон не вызывает error-замечаний`, () => {
      const errors = runAiAdvisor(t.reference, t.object).filter((n) => n.severity === "error");
      const detail = errors.map((e) => `${e.scenario}: ${e.title}`).join("; ");
      expect(errors, `ложные error-замечания на эталоне: ${detail}`).toHaveLength(0);
    });
  }
});
