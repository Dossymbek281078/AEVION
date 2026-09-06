import { describe, expect, it } from "vitest";
import { buildRemediation } from "./examRemediation";
import type { ExamReport, PositionDiff } from "./examGrader";
import type { AiNotice } from "./types";

function mkReport(over: Partial<ExamReport> = {}): ExamReport {
  return {
    score: 60,
    grade: "удовл.",
    breakdown: {
      ai: { score: 80, weight: 40, notices: [] },
      coverage: { score: 100, weight: 30, matched: 1, total: 1 },
      volumes: { score: 100, weight: 20, avgDeltaPct: 0 },
      total: { score: 100, weight: 10, deltaPct: 0 },
    },
    positions: [],
    refTotal: 100000,
    studentTotal: 100000,
    ...over,
  };
}

const pos = (over: Partial<PositionDiff>): PositionDiff => ({
  rateCode: "X-1", rateTitle: "Работа", unit: "м2",
  refVolume: 10, studentVolume: 10, deltaPct: 0, status: "match", score: 100,
  ...over,
});

const notice = (over: Partial<AiNotice>): AiNotice => ({
  // context у AiNotice обязателен. Пустой объект — не выдумка: так поступает
  // сценарий indexMismatch, когда замечание относится ко всей смете.
  id: "n1", severity: "warning", scenario: "s", context: {}, title: "Замечание",
  message: "текст", ...over,
});

describe("buildRemediation — позиции", () => {
  it("пропущенная позиция → high missing с эталонным объёмом", () => {
    const r = mkReport({ positions: [pos({ rateCode: "A", status: "missing", studentVolume: null, deltaPct: null, refVolume: 5 })] });
    const plan = buildRemediation(r);
    const it = plan.items.find((x) => x.kind === "missing")!;
    expect(it.severity).toBe("high");
    expect(it.detail).toContain("5");
    expect(plan.counts.missing).toBe(1);
  });

  it("off-volume → severity по величине дельты + направление", () => {
    const r = mkReport({
      positions: [
        pos({ rateCode: "A", status: "off-volume", deltaPct: 20, studentVolume: 12, refVolume: 10 }),
        pos({ rateCode: "B", status: "off-volume", deltaPct: -8, studentVolume: 9.2, refVolume: 10 }),
        pos({ rateCode: "C", status: "off-volume", deltaPct: 3, studentVolume: 10.3, refVolume: 10 }),
      ],
    });
    const plan = buildRemediation(r);
    expect(plan.items.find((x) => x.rateCode === "A")!.severity).toBe("high");
    expect(plan.items.find((x) => x.rateCode === "B")!.severity).toBe("medium");
    expect(plan.items.find((x) => x.rateCode === "C")!.severity).toBe("low");
    expect(plan.items.find((x) => x.rateCode === "A")!.title).toContain("завышен");
    expect(plan.items.find((x) => x.rateCode === "B")!.title).toContain("занижен");
  });

  it("лишняя позиция → medium extra", () => {
    const r = mkReport({ positions: [pos({ rateCode: "Z", status: "extra", refVolume: 0, studentVolume: 4 })] });
    const plan = buildRemediation(r);
    const it = plan.items.find((x) => x.kind === "extra")!;
    expect(it.severity).toBe("medium");
    expect(it.action).toContain("Удалите");
  });
});

describe("buildRemediation — AI-замечания и итог", () => {
  it("AI error/warning/info → high/medium/low", () => {
    const r = mkReport({
      breakdown: {
        ...mkReport().breakdown,
        ai: {
          score: 50, weight: 40,
          notices: [
            notice({ id: "e", severity: "error", suggestion: "сделай так", reference: "СН РК 1" }),
            notice({ id: "w", severity: "warning" }),
            notice({ id: "i", severity: "info" }),
          ],
        },
      },
    });
    const plan = buildRemediation(r);
    const adv = plan.items.filter((x) => x.kind === "advice");
    expect(adv).toHaveLength(3);
    expect(adv.find((x) => x.severity === "high")!.reference).toBe("СН РК 1");
    expect(adv.find((x) => x.severity === "high")!.action).toBe("сделай так");
  });

  it("расхождение итога >5% → total-замечание, ≤5% — нет", () => {
    const big = buildRemediation(mkReport({ refTotal: 100000, studentTotal: 130000, breakdown: { ...mkReport().breakdown, total: { score: 0, weight: 10, deltaPct: 30 } } }));
    expect(big.items.some((x) => x.kind === "total" && x.severity === "high")).toBe(true);
    const small = buildRemediation(mkReport({ breakdown: { ...mkReport().breakdown, total: { score: 100, weight: 10, deltaPct: 2 } } }));
    expect(small.items.some((x) => x.kind === "total")).toBe(false);
  });
});

describe("buildRemediation — план целиком", () => {
  it("сортирует high выше medium/low", () => {
    const r = mkReport({
      positions: [
        pos({ rateCode: "lo", status: "off-volume", deltaPct: 2, studentVolume: 10.2, refVolume: 10 }),
        pos({ rateCode: "hi", status: "missing", studentVolume: null, deltaPct: null }),
      ],
    });
    const plan = buildRemediation(r);
    expect(plan.items[0].severity).toBe("high");
  });

  it("trap-подсказка добавляется только при наличии ошибок", () => {
    const withErr = buildRemediation(mkReport({ positions: [pos({ status: "missing", studentVolume: null, deltaPct: null })] }), { trap: "не забудь проёмы" });
    expect(withErr.items.some((x) => x.action === "не забудь проёмы")).toBe(true);
    const clean = buildRemediation(mkReport({ score: 90 }), { trap: "не забудь проёмы" });
    expect(clean.items.some((x) => x.action === "не забудь проёмы")).toBe(false);
  });

  it("отличный балл без ошибок → пустой план", () => {
    const plan = buildRemediation(mkReport({ score: 92 }));
    expect(plan.items).toHaveLength(0);
    expect(plan.summary).toContain("Ошибок нет");
  });

  it("estimatedGain = 100 − score", () => {
    expect(buildRemediation(mkReport({ score: 73 })).estimatedGain).toBe(27);
  });

  it("summary считает по уровням критичности", () => {
    const r = mkReport({
      score: 40,
      positions: [
        pos({ rateCode: "A", status: "missing", studentVolume: null, deltaPct: null }),
        pos({ rateCode: "Z", status: "extra", refVolume: 0, studentVolume: 1 }),
      ],
    });
    const plan = buildRemediation(r);
    expect(plan.summary).toContain("1 критич.");
    expect(plan.summary).toContain("1 на внимание");
    expect(plan.summary).toContain("+60 баллов");
  });
});
