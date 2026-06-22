import { describe, expect, it } from "vitest";
import type { Lsr, LearningObject, AppliedCoefficient } from "../../types";
import { checkHeightCoefficient } from "./heightCoef";

function lsr(category: string, rateCode: string, coefs: AppliedCoefficient[] = []): Lsr {
  return {
    id: "t", title: "t", objectId: "o", method: "базисно-индексный",
    indexQuarter: "2026-Q2", indexRegion: "Алматы",
    sections: [{ id: "s1", title: "Раздел 1", category: category as Lsr["sections"][number]["category"],
      positions: [{ id: "p1", rateCode, volume: 1, coefficients: coefs }] }],
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
}
const obj = (over: Partial<LearningObject>): LearningObject => ({
  id: "o", title: "Высотный объект", type: "новое-строительство", region: "Алматы",
  description: "", attachments: [], ...over,
});

describe("height-coefficient", () => {
  it("atHeight без коэф. высоты нигде → одно замечание (электромонтаж без room-геометрии)", () => {
    const n = checkHeightCoefficient(lsr("электромонтажные", "ЭСНСб21-21-04-007"), obj({ atHeight: true }));
    expect(n).toHaveLength(1);
    expect(n[0].scenario).toBe("height-coefficient");
  });

  it("atHeight, но коэф. высоты применён → молчит", () => {
    const n = checkHeightCoefficient(
      lsr("электромонтажные", "ЭСНСб21-21-04-007", [{ kind: "высота", value: 1.2, justification: "+9.0" }]),
      obj({ atHeight: true }),
    );
    expect(n).toHaveLength(0);
  });

  it("не atHeight и без room-геометрии → молчит", () => {
    expect(checkHeightCoefficient(lsr("электромонтажные", "ЭСНСб21-21-04-007"), obj({}))).toHaveLength(0);
  });

  it("геометрическая ветка сохранена: room ≥ 4 м, кровельные работы → срабатывает", () => {
    const n = checkHeightCoefficient(
      lsr("кровельные", "ЭСНСб12-12-01-001"),
      obj({ geometry: { kind: "room", length: 10, width: 10, height: 4.5, openings: [] } }),
    );
    expect(n.length).toBeGreaterThanOrEqual(1);
    expect(n[0].scenario).toBe("height-coefficient");
  });
});
