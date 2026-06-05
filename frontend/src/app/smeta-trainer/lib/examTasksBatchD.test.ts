import { describe, expect, it } from "vitest";
import { findExamTask } from "./examTasks";
import { runAiAdvisor } from "./ai";
import { NEW_DETECTOR_SCENARIOS } from "./ai/scenarioLabels";

/**
 * Локер покрытия: новые задания banka должны реально запускать детекторы batch D,
 * иначе аналитика куратора снова покажет «нет в банке».
 */
function scenariosOf(taskId: string): Set<string> {
  const t = findExamTask(taskId);
  expect(t, `задание ${taskId} должно существовать`).toBeTruthy();
  const notices = runAiAdvisor(t!.starter, t!.object);
  return new Set(notices.map((n) => n.scenario));
}

describe("batch D — покрытие банка экзаменов", () => {
  it("ламинат запускает duplicate-material", () => {
    expect(scenariosOf("laminate-duplicate-material")).toContain("duplicate-material");
  });

  it("штукатурка запускает index-double", () => {
    expect(scenariosOf("plaster-index-double")).toContain("index-double");
  });

  it("окраска запускает coef-double", () => {
    expect(scenariosOf("painting-coef-double")).toContain("coef-double");
  });

  it("каждый детектор batch D срабатывает хотя бы в одном задании", () => {
    const armed = new Set<string>();
    for (const id of ["laminate-duplicate-material", "plaster-index-double", "painting-coef-double"]) {
      for (const s of scenariosOf(id)) armed.add(s);
    }
    for (const code of NEW_DETECTOR_SCENARIOS) {
      expect(armed.has(code), `детектор ${code} не покрыт банком`).toBe(true);
    }
  });
});
