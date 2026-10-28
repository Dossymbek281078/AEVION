import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AiBadge, AI_BADGE_TEXT, aiBadgeLang } from "../AiBadge";

describe("AiBadge", () => {
  it("без провайдера — русская плашка с подсказкой и признаком для кадра", () => {
    const { container } = render(<AiBadge />);
    const el = container.querySelector("[data-ai-badge]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toContain(AI_BADGE_TEXT.ru.label);
    expect(el.getAttribute("title")).toBe(AI_BADGE_TEXT.ru.hint);
    expect(el.getAttribute("role")).toBe("note");
  });
  it("lang=en / kk — свой текст, en без кириллицы", () => {
    const en = render(<AiBadge lang="en" />).container.textContent ?? "";
    const kk = render(<AiBadge lang="kk" />).container.textContent ?? "";
    expect(en).toContain("Created with AI");
    expect(/[\u0400-\u04ff]/.test(en)).toBe(false);
    expect(kk).toContain(AI_BADGE_TEXT.kk.label);
  });
  it("неизвестный язык сайта → ru (не пустая строка)", () => {
    expect(aiBadgeLang(undefined)).toBe("ru");
    expect(aiBadgeLang("de")).toBe("ru");
    expect(aiBadgeLang("kk")).toBe("kk");
  });
});
