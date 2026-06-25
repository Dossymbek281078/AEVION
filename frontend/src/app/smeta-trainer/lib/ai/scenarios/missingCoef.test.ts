import { describe, expect, it } from "vitest";
import type { Lsr, LearningObject, AppliedCoefficient } from "../../types";
import { checkMissingCoefficient } from "./missingCoef";

function lsr(coefs: AppliedCoefficient[] = []): Lsr {
  return {
    id: "t", title: "t", objectId: "o", method: "базисно-индексный",
    indexQuarter: "2026-Q2", indexRegion: "Алматы",
    sections: [
      { id: "s1", title: "Раздел 1", category: "электромонтажные",
        positions: [{ id: "p1", rateCode: "ЭСНСб21-21-04-007", volume: 1, coefficients: coefs }] },
    ],
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
}
const obj = (occupied?: boolean): LearningObject => ({
  id: "o", title: "Школа (действующая)", type: "капремонт", region: "Алматы",
  description: "", occupied, attachments: [],
});

describe("missing-coefficient (объект-управляемый)", () => {
  it("действующий объект без коэффициента нигде → одно замечание", () => {
    const n = checkMissingCoefficient(lsr([]), obj(true));
    expect(n).toHaveLength(1);
    expect(n[0].scenario).toBe("missing-coefficient");
    expect(n[0].context.positionId).toBe("p1");
  });

  it("молчит, если коэффициент уже применён к позиции", () => {
    const n = checkMissingCoefficient(lsr([{ kind: "действующий-объект", value: 1.15, justification: "школа" }]), obj(true));
    expect(n).toHaveLength(0);
  });

  it("«стеснённые» тоже считается применённым коэффициентом условий", () => {
    const n = checkMissingCoefficient(lsr([{ kind: "стеснённые", value: 1.15, justification: "коридор" }]), obj(true));
    expect(n).toHaveLength(0);
  });

  it("не действующий объект → молчит даже без коэффициента", () => {
    expect(checkMissingCoefficient(lsr([]), obj(false))).toHaveLength(0);
    expect(checkMissingCoefficient(lsr([]), obj(undefined))).toHaveLength(0);
  });

  it("без объекта → молчит", () => {
    expect(checkMissingCoefficient(lsr([]))).toHaveLength(0);
  });
});
