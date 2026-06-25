import { describe, expect, it } from "vitest";
import type { Lsr, AppliedCoefficient } from "../../types";
import { checkCoefUnjustified } from "./coefUnjustified";
import { findExamTask } from "../../examTasks";
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

describe("coef-unjustified", () => {
  it("срабатывает на коэффициент с пустым обоснованием", () => {
    const lsr = mkLsr({ kind: "стеснённые", value: 1.15, justification: "" });
    const notices = checkCoefUnjustified(lsr);
    expect(notices).toHaveLength(1);
    expect(notices[0].scenario).toBe("coef-unjustified");
    expect(notices[0].context.positionId).toBe("p1");
  });

  it("срабатывает на обоснование из одних знаков-заглушек", () => {
    const lsr = mkLsr({ kind: "стеснённые", value: 1.15, justification: " — " });
    expect(checkCoefUnjustified(lsr)).toHaveLength(1);
  });

  it("молчит, когда обоснование ссылается на документ", () => {
    const lsr = mkLsr({ kind: "стеснённые", value: 1.15, justification: "ППР со схемой стеснённых условий" });
    expect(checkCoefUnjustified(lsr)).toHaveLength(0);
  });

  it("молчит на содержательном обосновании без слова-«документа» (нет ложных срабатываний на эталонах)", () => {
    const lsr = mkLsr({ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует (СН РК 8.02-10)" });
    expect(checkCoefUnjustified(lsr)).toHaveLength(0);
  });

  it("молчит при пустом списке коэффициентов", () => {
    const lsr = mkLsr({ kind: "высота", value: 1.2, justification: "проектная отметка +9.0" });
    lsr.sections[0].positions[0].coefficients = [];
    expect(checkCoefUnjustified(lsr)).toHaveLength(0);
  });

  it("банк экзаменов содержит задание, запускающее детектор", () => {
    const t = findExamTask("stairwell-coef-unjustified");
    expect(t).toBeTruthy();
    const notices = runAiAdvisor(t!.starter, t!.object);
    expect(notices.map((n) => n.scenario)).toContain("coef-unjustified");
  });
});
