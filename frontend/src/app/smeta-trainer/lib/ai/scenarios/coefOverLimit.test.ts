import { describe, expect, it } from "vitest";
import type { Lsr, AppliedCoefficient } from "../../types";
import { checkCoefOverLimit, COEF_TYPICAL_MAX } from "./coefOverLimit";
import { deterministicBreakdown } from "./scenarioBreakdowns";
import { EXAM_TASKS, findExamTask } from "../../examTasks";
import { runAiAdvisor } from "../index";

function mkLsr(coef: AppliedCoefficient): Lsr {
  return {
    id: "t",
    title: "t",
    objectId: "o",
    method: "базисно-индексный",
    indexQuarter: "2026-Q2",
    indexRegion: "Алматы",
    sections: [
      {
        id: "s1",
        title: "Раздел 1",
        category: "отделочные",
        positions: [
          { id: "p1", rateCode: "ЭСНСб15-13-01-001", volume: 1, coefficients: [coef] },
        ],
      },
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

describe("coef-over-limit", () => {
  it("срабатывает на коэффициент выше типового норматива", () => {
    const lsr = mkLsr({ kind: "стеснённые", value: 1.5, justification: "ППР" });
    const notices = checkCoefOverLimit(lsr);
    expect(notices).toHaveLength(1);
    expect(notices[0].scenario).toBe("coef-over-limit");
    expect(notices[0].severity).toBe("warning");
    expect(notices[0].context.positionId).toBe("p1");
  });

  it("молчит на значении РОВНО на пределе (строгое сравнение)", () => {
    const lsr = mkLsr({ kind: "стеснённые", value: COEF_TYPICAL_MAX["стеснённые"], justification: "ППР" });
    expect(checkCoefOverLimit(lsr)).toHaveLength(0);
  });

  it("молчит на корректных эталонных значениях высоты (1.20)", () => {
    const lsr = mkLsr({ kind: "высота", value: 1.2, justification: "проектная отметка +9.0" });
    expect(checkCoefOverLimit(lsr)).toHaveLength(0);
  });

  it("молчит при пустом списке коэффициентов", () => {
    const lsr = mkLsr({ kind: "высота", value: 1.5, justification: "x" });
    lsr.sections[0].positions[0].coefficients = [];
    expect(checkCoefOverLimit(lsr)).toHaveLength(0);
  });

  it("есть детерминированный разбор для замечания", () => {
    const lsr = mkLsr({ kind: "действующий-объект", value: 1.4, justification: "приказ" });
    const notice = checkCoefOverLimit(lsr)[0];
    const text = deterministicBreakdown(lsr, notice);
    expect(text).toBeTruthy();
    expect(text).toContain("1.4");
  });

  it("банк экзаменов содержит задание, запускающее детектор", () => {
    const t = findExamTask("stairwell-coef-over-limit");
    expect(t).toBeTruthy();
    const notices = runAiAdvisor(t!.starter, t!.object);
    expect(notices.map((n) => n.scenario)).toContain("coef-over-limit");
  });

  it("инвариант: ни один эталон банка не вызывает завышенный коэффициент", () => {
    for (const t of EXAM_TASKS) {
      const notices = runAiAdvisor(t.reference, t.object).filter((n) => n.scenario === "coef-over-limit");
      expect(notices, `ложное срабатывание coef-over-limit на эталоне ${t.id}`).toHaveLength(0);
    }
  });
});
