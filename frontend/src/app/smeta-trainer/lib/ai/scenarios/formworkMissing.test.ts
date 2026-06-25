import { describe, expect, it } from "vitest";
import type { Lsr, SmetaPosition } from "../../types";
import { checkFormworkMissing } from "./formworkMissing";

function lsr(positions: SmetaPosition[]): Lsr {
  return {
    id: "t", title: "t", objectId: "o", method: "базисно-индексный",
    indexQuarter: "2026-Q2", indexRegion: "Алматы",
    sections: [{ id: "s1", title: "Раздел 1", category: "общестроительные", positions }],
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
}
const pos = (id: string, rateCode: string): SmetaPosition => ({ id, rateCode, volume: 1, coefficients: [] });

// ЭСНСб06-05-01-001 — «Устройство монолитной фундаментной плиты … бетон B25»
// ЭСНСб06-05-02-001 — «Установка опалубки фундаментов …»
// ЭСНСб15-11-02-001 — «Устройство стяжки цементной … по плитам перекрытия» (НЕ монолит)

describe("formwork-missing", () => {
  it("срабатывает: монолитная плита без опалубки", () => {
    const notices = checkFormworkMissing(lsr([pos("p1", "ЭСНСб06-05-01-001")]));
    expect(notices).toHaveLength(1);
    expect(notices[0].scenario).toBe("formwork-missing");
    expect(notices[0].severity).toBe("error");
  });

  it("молчит: монолитная плита + опалубка присутствует", () => {
    const notices = checkFormworkMissing(lsr([pos("p1", "ЭСНСб06-05-01-001"), pos("p2", "ЭСНСб06-05-02-001")]));
    expect(notices).toHaveLength(0);
  });

  it("не ложно-срабатывает: стяжка «по плитам перекрытия» — это не монолитное бетонирование", () => {
    const notices = checkFormworkMissing(lsr([pos("p1", "ЭСНСб15-11-02-001")]));
    expect(notices).toHaveLength(0);
  });
});
