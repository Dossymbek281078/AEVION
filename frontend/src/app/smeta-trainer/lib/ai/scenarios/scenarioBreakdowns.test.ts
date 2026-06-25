import { describe, expect, it } from "vitest";
import { deterministicBreakdown, explainDoubleCount, explainMissingCoef, explainCoefUnjustified } from "./scenarioBreakdowns";
import type { Lsr, AiNotice, SmetaPosition } from "../../types";

function pos(id: string, rateCode: string): SmetaPosition {
  return { id, rateCode, volume: 1, coefficients: [] };
}

function lsr(sections: { id: string; title: string; category: string; positions: SmetaPosition[] }[]): Lsr {
  return {
    id: "l", title: "L", objectId: "o", method: "ресурсный",
    indexQuarter: "q", indexRegion: "r",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sections: sections as any,
    createdAt: "", updatedAt: "",
  };
}

const notice = (over: Partial<AiNotice>): AiNotice => ({
  id: "n", severity: "error", scenario: "double-count", context: {},
  title: "T", message: "m", ...over,
});

describe("explainDoubleCount", () => {
  it("перечисляет все разделы с дублем", () => {
    const l = lsr([
      { id: "s1", title: "Демонтаж", category: "демонтажные", positions: [pos("p1", "ОТД-15")] },
      { id: "s2", title: "Отделка", category: "отделочные", positions: [pos("p2", "ОТД-15")] },
    ]);
    const txt = explainDoubleCount(l, notice({ context: { positionId: "p1" } }))!;
    expect(txt).toContain("ОТД-15");
    expect(txt).toContain("Демонтаж");
    expect(txt).toContain("Отделка");
    expect(txt).toContain("2 разделах");
  });

  it("null, если позиция не дублируется", () => {
    const l = lsr([{ id: "s1", title: "A", category: "отделочные", positions: [pos("p1", "ОТД-15")] }]);
    expect(explainDoubleCount(l, notice({ context: { positionId: "p1" } }))).toBeNull();
  });

  it("null, если позиция не найдена", () => {
    const l = lsr([{ id: "s1", title: "A", category: "отделочные", positions: [pos("p1", "X")] }]);
    expect(explainDoubleCount(l, notice({ context: { positionId: "ghost" } }))).toBeNull();
  });
});

describe("explainMissingCoef", () => {
  it("называет позицию, раздел и +15%", () => {
    const l = lsr([{ id: "s1", title: "Демонтаж", category: "демонтажные", positions: [pos("p1", "ДЕМ-01")] }]);
    const txt = explainMissingCoef(l, notice({ scenario: "missing-coefficient", context: { positionId: "p1" } }))!;
    expect(txt).toContain("ДЕМ-01");
    expect(txt).toContain("Демонтаж");
    expect(txt).toContain("15%");
    expect(txt).toContain("+К");
  });
});

describe("explainCoefUnjustified", () => {
  it("называет коэффициент и удорожание", () => {
    const p: SmetaPosition = { id: "p1", rateCode: "ШТ-13", volume: 1, coefficients: [{ kind: "стеснённые", value: 1.15, justification: "" }] };
    const l = lsr([{ id: "s1", title: "Штукатурка", category: "отделочные", positions: [p] }]);
    const txt = explainCoefUnjustified(l, notice({ scenario: "coef-unjustified", context: { positionId: "p1" } }))!;
    expect(txt).toContain("ШТ-13");
    expect(txt).toContain("стеснённые");
    expect(txt).toContain("15%");
  });

  it("маршрутизируется через deterministicBreakdown", () => {
    const p: SmetaPosition = { id: "p1", rateCode: "ШТ-13", volume: 1, coefficients: [{ kind: "высота", value: 1.2, justification: "" }] };
    const l = lsr([{ id: "s1", title: "Штукатурка", category: "отделочные", positions: [p] }]);
    expect(deterministicBreakdown(l, notice({ scenario: "coef-unjustified", context: { positionId: "p1" } }))).toContain("ШТ-13");
  });
});

describe("deterministicBreakdown", () => {
  it("маршрутизирует по сценарию", () => {
    const l = lsr([
      { id: "s1", title: "Демонтаж", category: "демонтажные", positions: [pos("p1", "ОТД-15")] },
      { id: "s2", title: "Отделка", category: "отделочные", positions: [pos("p2", "ОТД-15")] },
    ]);
    expect(deterministicBreakdown(l, notice({ context: { positionId: "p1" } }))).toContain("ОТД-15");
    expect(deterministicBreakdown(l, notice({ scenario: "scaffolding-missing", context: { positionId: "p1" } }))).toBeNull();
  });
});
