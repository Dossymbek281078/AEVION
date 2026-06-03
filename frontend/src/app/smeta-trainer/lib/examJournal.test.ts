import { describe, expect, it } from "vitest";
import { remediationProgress, commonMistakes, type ExamAttempt } from "./examJournal";

function att(over: Partial<ExamAttempt> & { id: string; taskId: string; timestamp: string }): ExamAttempt {
  return {
    taskTitle: "T",
    score: 50,
    grade: "удовл.",
    breakdown: { ai: 0, coverage: 0, volumes: 0, total: 0 },
    noticesCount: 0,
    studentTotal: 0,
    refTotal: 0,
    ...over,
  };
}

const rem = (high: number, medium: number, topActions: string[]): ExamAttempt["remediation"] => ({
  high, medium, low: 0, estimatedGain: 0, summary: "", topActions,
});

describe("remediationProgress", () => {
  it("первая попытка задания → дельты null", () => {
    const p = remediationProgress([att({ id: "a1", taskId: "T1", timestamp: "2026-06-01T10:00:00Z" })]);
    const pr = p.get("a1")!;
    expect(pr.prevAttemptId).toBeNull();
    expect(pr.scoreDelta).toBeNull();
    expect(pr.issuesDelta).toBeNull();
  });

  it("считает дельту балла и значимых замечаний к предыдущей попытке", () => {
    const p = remediationProgress([
      att({ id: "a1", taskId: "T1", timestamp: "2026-06-01T10:00:00Z", score: 50, remediation: rem(3, 2, ["x"]) }),
      att({ id: "a2", taskId: "T1", timestamp: "2026-06-01T11:00:00Z", score: 80, remediation: rem(1, 1, ["x"]) }),
    ]);
    const pr = p.get("a2")!;
    expect(pr.prevAttemptId).toBe("a1");
    expect(pr.scoreDelta).toBe(30);
    expect(pr.issuesDelta).toBe(-3); // было 5 значимых, стало 2
  });

  it("закрытые и новые действия по topActions", () => {
    const p = remediationProgress([
      att({ id: "a1", taskId: "T1", timestamp: "2026-06-01T10:00:00Z", remediation: rem(1, 1, ["добавь A", "исправь B"]) }),
      att({ id: "a2", taskId: "T1", timestamp: "2026-06-01T11:00:00Z", remediation: rem(1, 0, ["исправь B", "удали C"]) }),
    ]);
    const pr = p.get("a2")!;
    expect(pr.resolvedActions).toEqual(["добавь A"]); // было, нет сейчас
    expect(pr.newActions).toEqual(["удали C"]);       // появилось
  });

  it("разные задания не смешиваются", () => {
    const p = remediationProgress([
      att({ id: "a1", taskId: "T1", timestamp: "2026-06-01T10:00:00Z", score: 40 }),
      att({ id: "b1", taskId: "T2", timestamp: "2026-06-01T10:30:00Z", score: 90 }),
      att({ id: "a2", taskId: "T1", timestamp: "2026-06-01T11:00:00Z", score: 60 }),
    ]);
    expect(p.get("b1")!.prevAttemptId).toBeNull();   // первая по T2
    expect(p.get("a2")!.prevAttemptId).toBe("a1");    // прошлая по T1, не b1
    expect(p.get("a2")!.scoreDelta).toBe(20);
  });

  it("упорядочивает по времени независимо от порядка во входе", () => {
    const p = remediationProgress([
      att({ id: "a2", taskId: "T1", timestamp: "2026-06-01T11:00:00Z", score: 70 }),
      att({ id: "a1", taskId: "T1", timestamp: "2026-06-01T10:00:00Z", score: 50 }),
    ]);
    expect(p.get("a1")!.prevAttemptId).toBeNull();
    expect(p.get("a2")!.prevAttemptId).toBe("a1");
  });
});

describe("commonMistakes", () => {
  it("агрегирует topActions по частоте и числу заданий", () => {
    const agg = commonMistakes([
      att({ id: "a1", taskId: "T1", timestamp: "1", remediation: rem(1, 0, ["вычти проёмы", "добавь штукатурку"]) }),
      att({ id: "a2", taskId: "T2", timestamp: "2", remediation: rem(1, 0, ["вычти проёмы"]) }),
      att({ id: "a3", taskId: "T1", timestamp: "3", remediation: rem(0, 1, ["вычти проёмы"]) }),
    ]);
    const top = agg.items[0];
    expect(top.action).toBe("вычти проёмы");
    expect(top.count).toBe(3);
    expect(top.tasks).toBe(2); // T1 и T2
    expect(agg.attemptsAnalyzed).toBe(3);
  });

  it("считает чистые сдачи и суммарные значимые замечания", () => {
    const agg = commonMistakes([
      att({ id: "a1", taskId: "T1", timestamp: "1", remediation: rem(2, 1, ["x"]) }),
      att({ id: "a2", taskId: "T1", timestamp: "2", remediation: rem(0, 0, []) }),
    ]);
    expect(agg.totalSignificant).toBe(3); // 2+1 + 0
    expect(agg.cleanAttempts).toBe(1);
  });

  it("игнорирует попытки без remediation (старые записи)", () => {
    const agg = commonMistakes([att({ id: "a1", taskId: "T1", timestamp: "1" })]);
    expect(agg.attemptsAnalyzed).toBe(0);
    expect(agg.items).toHaveLength(0);
  });
});
