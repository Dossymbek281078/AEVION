import { describe, expect, it } from "vitest";
import type { Lsr, SmetaPosition, WorkCategory } from "../../types";
import { checkReturnableSums } from "./returnableSums";

function lsr(positions: SmetaPosition[], category: WorkCategory = "демонтажные"): Lsr {
  return {
    id: "t", title: "t", objectId: "o", method: "базисно-индексный",
    indexQuarter: "2026-Q2", indexRegion: "Алматы",
    sections: [{ id: "s1", title: "Раздел 1. Демонтаж", category, positions }],
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
}
const pos = (id: string, rateCode: string, note?: string): SmetaPosition => ({
  id, rateCode, volume: 1, coefficients: [], note,
});

// Реальные коды демонтажа из корпуса:
// ЭСНСб18-01.Д-001 — «Демонтаж радиатора отопления чугунного» → возврат (чугун)
// ЭСНСб17-03.Д-001 — «Демонтаж ванны чугунной или стальной»   → возврат (металлолом)
// ЭСНСб08-01.Д-001 — «Демонтаж кирпичной перегородки …»        → возврат (годный кирпич)
// ЭСНСб15-01.Д-001 — «Демонтаж старой штукатурки стен …»       → возврата НЕТ

describe("returnable-sums-missing", () => {
  it("срабатывает: демонтаж радиатора без учёта возврата", () => {
    const notices = checkReturnableSums(lsr([pos("p1", "ЭСНСб18-01.Д-001")]));
    expect(notices).toHaveLength(1);
    expect(notices[0].scenario).toBe("returnable-sums-missing");
    expect(notices[0].severity).toBe("warning");
    expect(notices[0].context.positionId).toBe("p1");
  });

  it("молчит: возврат учтён (отметка «возврат» в примечании позиции)", () => {
    const notices = checkReturnableSums(
      lsr([pos("p1", "ЭСНСб18-01.Д-001", "возврат чугуна учтён отдельной строкой")]),
    );
    expect(notices).toHaveLength(0);
  });

  it("не ложно-срабатывает: демонтаж штукатурки возврата не даёт", () => {
    const notices = checkReturnableSums(lsr([pos("p1", "ЭСНСб15-01.Д-001")]));
    expect(notices).toHaveLength(0);
  });

  it("молчит: возвратообразующий демонтаж не в демонтажном разделе (category-guard)", () => {
    const notices = checkReturnableSums(lsr([pos("p1", "ЭСНСб18-01.Д-001")], "общестроительные"));
    expect(notices).toHaveLength(0);
  });

  it("агрегирует разные материалы в одно замечание со списком", () => {
    const notices = checkReturnableSums(
      lsr([
        pos("p1", "ЭСНСб18-01.Д-001"), // радиатор чугунный
        pos("p2", "ЭСНСб17-03.Д-001"), // ванна стальная
        pos("p3", "ЭСНСб08-01.Д-001"), // кирпичная перегородка
      ]),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].context.positionId).toBe("p1");
    expect(notices[0].message).toContain("радиатор");
    expect(notices[0].message).toContain("кирпич");
  });
});
