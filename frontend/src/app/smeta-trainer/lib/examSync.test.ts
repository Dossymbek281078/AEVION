import { describe, expect, it } from "vitest";
import { buildExamAttemptPayload, EXAM_LEVEL, describeAttemptKind, examTaskTitleFromPayload } from "./examSync";
import type { ExamReport } from "./examGrader";

function report(over: Partial<ExamReport> = {}): ExamReport {
  return {
    score: 78,
    grade: "хорошо",
    breakdown: {
      ai: { score: 80, weight: 40, notices: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: "n1" } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: "n2" } as any,
      ] },
      coverage: { score: 90, weight: 30, matched: 9, total: 10 },
      volumes: { score: 75, weight: 20, avgDeltaPct: 3.2 },
      total: { score: 100, weight: 10, deltaPct: -4.5 },
    },
    positions: [],
    refTotal: 100000,
    studentTotal: 95500,
    ...over,
  };
}

describe("buildExamAttemptPayload", () => {
  const a = buildExamAttemptPayload("finishing-classroom", "Отделка класса", report());

  it("уровень экзамена = 5 (валидный для backend)", () => {
    expect(a.level).toBe(EXAM_LEVEL);
    expect(a.level).toBe(5);
  });

  it("переносит балл и компактный payload", () => {
    expect(a.score).toBe(78);
    expect(a.payload.taskId).toBe("finishing-classroom");
    expect(a.payload.grade).toBe("хорошо");
    expect(a.payload.coverage).toEqual({ matched: 9, total: 10 });
    expect(a.payload.notices).toBe(2);
  });

  it("feedback содержит оценку, балл, покрытие и замечания", () => {
    expect(a.feedback).toContain("хорошо");
    expect(a.feedback).toContain("78/100");
    expect(a.feedback).toContain("9/10");
    expect(a.feedback).toContain("замечаний 2");
  });
});

describe("describeAttemptKind", () => {
  it("человекочитаемые ярлыки", () => {
    expect(describeAttemptKind("lsr-submit")).toBe("Экзамен (ЛСР)");
    expect(describeAttemptKind("quiz")).toBe("Тест");
    expect(describeAttemptKind("exercise")).toBe("Практика");
  });
  it("неизвестный kind возвращается как есть", () => {
    expect(describeAttemptKind("custom")).toBe("custom");
  });
});

describe("examTaskTitleFromPayload", () => {
  it("достаёт taskTitle из payload", () => {
    expect(examTaskTitleFromPayload({ taskTitle: "Отделка класса" })).toBe("Отделка класса");
  });
  it("null для отсутствующего/неверного payload", () => {
    expect(examTaskTitleFromPayload(null)).toBeNull();
    expect(examTaskTitleFromPayload({ x: 1 })).toBeNull();
    expect(examTaskTitleFromPayload("str")).toBeNull();
  });
});
