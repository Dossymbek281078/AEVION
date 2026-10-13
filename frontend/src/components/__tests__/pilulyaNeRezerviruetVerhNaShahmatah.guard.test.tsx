import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppShellLanguagePill } from "../AppShellLanguagePill";
import { I18nProvider } from "@/lib/i18n";

/*
 * 🔴 Волна 137 (14.10.2026). На /cyberchess* оболочка резервировала 50 px сверху под языковую пилюлю
 * (--aevion-pill-h → body padding-top), а шапка шахмат сама держит место справа. Полоса съедала высоту
 * доски (1463×724: 474 px = 65 % vh при цели lichess 76 %). Теперь на шахматах переменная = 0px,
 * на остальных страницах оболочки — высота пилюли + 12 (контроль: /devhub как было).
 */
// jsdom без ResizeObserver — заглушка только для наблюдения размера пилюли.
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
afterEach(() => { cleanup(); document.documentElement.style.removeProperty("--aevion-pill-h"); });

function сПутём(path: string) {
  Object.defineProperty(window, "location", { value: { ...window.location, pathname: path }, writable: true, configurable: true });
}

describe("пилюля языка и верхний отступ оболочки", () => {
  it("🔴 на /cyberchess переменная --aevion-pill-h = 0px — полосы над шапкой нет", () => {
    сПутём("/cyberchess");
    render(<I18nProvider><AppShellLanguagePill /></I18nProvider>);
    expect(document.documentElement.style.getPropertyValue("--aevion-pill-h")).toBe("0px");
  });
  it("🔴 на /cyberchess/puzzles — тоже 0px (весь раздел)", () => {
    сПутём("/cyberchess/puzzles");
    render(<I18nProvider><AppShellLanguagePill /></I18nProvider>);
    expect(document.documentElement.style.getPropertyValue("--aevion-pill-h")).toBe("0px");
  });
  it("контроль: на /devhub отступ публикуется как высота пилюли + 12 (не 0)", () => {
    сПутём("/devhub");
    render(<I18nProvider><AppShellLanguagePill /></I18nProvider>);
    const v = document.documentElement.style.getPropertyValue("--aevion-pill-h");
    expect(v).toMatch(/^\d+px$/);
    expect(v).not.toBe("0px");
  });
  it("шапка шахмат держит 84 px справа на десктопе под пилюлю (fixed top:12/right:12)", () => {
    const src = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
    expect(src).toContain('padding:vwPx<769?"3px 72px 3px 12px":"6px 84px 6px 12px"');
  });
});
