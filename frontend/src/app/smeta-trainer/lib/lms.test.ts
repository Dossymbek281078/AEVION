import { describe, expect, it } from "vitest";
import {
  parseLmsParams,
  destinationFor,
  destinationHref,
  moduleForExamTask,
  buildReturnUrl,
  buildCompletionMessage,
  LMS_COMPLETION_TYPE,
  MODULE_DESTINATIONS,
  type LmsCompletion,
} from "./lms";
import { findExamTask } from "./examTasks";

describe("parseLmsParams", () => {
  it("читает module/return/sid/origin", () => {
    const p = new URLSearchParams("module=2.3&return=https://lms.kz/course/1&sid=u42&origin=https://lms.kz");
    const ctx = parseLmsParams(p)!;
    expect(ctx.module).toBe("2.3");
    expect(ctx.returnUrl).toBe("https://lms.kz/course/1");
    expect(ctx.studentId).toBe("u42");
    expect(ctx.origin).toBe("https://lms.kz");
  });

  it("принимает алиас lesson", () => {
    expect(parseLmsParams({ lesson: "2.5" })?.module).toBe("2.5");
  });

  it("null без module", () => {
    expect(parseLmsParams({ return: "x" })).toBeNull();
  });
});

describe("destinations", () => {
  it("известный модуль → назначение с префиксом", () => {
    const d = destinationFor("2.5")!;
    expect(d.path).toBe("/indexes");
    expect(destinationHref(d)).toBe("/smeta-trainer/indexes");
  });

  it("неизвестный модуль → null", () => {
    expect(destinationFor("9.9")).toBeNull();
    expect(destinationFor(null)).toBeNull();
  });

  it("все examTaskId карты существуют в банке", () => {
    for (const d of Object.values(MODULE_DESTINATIONS)) {
      if (d.examTaskId) expect(findExamTask(d.examTaskId), d.examTaskId).toBeTruthy();
    }
  });

  it("обратный поиск модуля по экзамену", () => {
    expect(moduleForExamTask("finishing-classroom")).toBe("2.3");
    expect(moduleForExamTask("painting-coef-double")).toBe("3.3");
    expect(moduleForExamTask("nope")).toBeNull();
  });
});

describe("buildReturnUrl", () => {
  const completion: LmsCompletion = {
    module: "2.3", taskId: "finishing-classroom", score: 88, grade: "отлично", passed: true, at: "2026-06-05T00:00:00Z",
  };

  it("добавляет результат в query", () => {
    const url = buildReturnUrl({ module: "2.3", returnUrl: "https://lms.kz/c/1", studentId: "u42" }, completion)!;
    const u = new URL(url);
    expect(u.searchParams.get("module")).toBe("2.3");
    expect(u.searchParams.get("score")).toBe("88");
    expect(u.searchParams.get("grade")).toBe("отлично");
    expect(u.searchParams.get("passed")).toBe("1");
    expect(u.searchParams.get("sid")).toBe("u42");
    expect(u.searchParams.get("task")).toBe("finishing-classroom");
  });

  it("null без returnUrl", () => {
    expect(buildReturnUrl({ module: "2.3" }, completion)).toBeNull();
  });

  it("null при невалидном URL", () => {
    expect(buildReturnUrl({ module: "2.3", returnUrl: "не-url" }, completion)).toBeNull();
  });
});

describe("buildCompletionMessage", () => {
  it("обёртывает payload с типом", () => {
    const c: LmsCompletion = { module: "2.5", score: 50, grade: "удовл.", passed: false, at: "t" };
    const msg = buildCompletionMessage(c);
    expect(msg.type).toBe(LMS_COMPLETION_TYPE);
    expect(msg.payload.passed).toBe(false);
  });
});
