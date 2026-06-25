import { describe, expect, it } from "vitest";
import { buildNoticeAIPrompt, hasDedicatedPanel } from "./noticeAdvisor";
import type { AiNotice } from "../types";

const notice = (over: Partial<AiNotice>): AiNotice => ({
  id: "n", severity: "error", scenario: "double-count", context: {},
  title: "Двойной счёт", message: "Позиция ОТД-15 учтена дважды", ...over,
});

describe("buildNoticeAIPrompt", () => {
  it("вшивает человекочитаемый тип, детали и норматив", () => {
    const { extraSystem } = buildNoticeAIPrompt(
      notice({ scenario: "missing-coefficient", reference: "СН РК 8.02-10", suggestion: "примени К=1.15" }),
    );
    expect(extraSystem).toContain("Забыт коэффициент"); // человекочитаемый ярлык
    expect(extraSystem).toContain("СН РК 8.02-10");
    expect(extraSystem).toContain("примени К=1.15");
  });

  it("опускает отсутствующие suggestion/reference", () => {
    const { extraSystem } = buildNoticeAIPrompt(notice({ suggestion: undefined, reference: undefined }));
    expect(extraSystem).not.toContain("Рекомендация системы");
    expect(extraSystem).not.toContain("Норматив РК");
  });

  it("вопрос упоминает заголовок замечания", () => {
    const { question } = buildNoticeAIPrompt(notice({ title: "Неверный индекс" }));
    expect(question).toContain("Неверный индекс");
  });

  it("неизвестный сценарий → ярлык = сам код", () => {
    const { extraSystem } = buildNoticeAIPrompt(notice({ scenario: "what-is-this" }));
    expect(extraSystem).toContain("what-is-this");
  });
});

describe("hasDedicatedPanel", () => {
  it("проёмы имеют собственную панель", () => {
    expect(hasDedicatedPanel("missing-opening-subtraction")).toBe(true);
  });
  it("остальные — общий разбор", () => {
    expect(hasDedicatedPanel("double-count")).toBe(false);
  });
});
