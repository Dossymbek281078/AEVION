import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 145 (18.10.2026). Шапка сайта липкая; высоту она публикует в --aevion-header-h (SiteHeader, ResizeObserver).
 * Замер на проде 5aa03bb5e, /devhub: после scrollIntoView к полю идеи верх поля на 0, в точке поля elementFromPoint
 * отдаёт шапку (55 px на 390×844, 51 на 1463×724) — то же происходит при переходе по якорю и автопрокрутке к
 * сфокусированному полю (Продажи: «sticky-шапка 86 px накрывает верх формы после якоря»). Лекарство одно и общее:
 * scroll-margin-top от измеренной высоты шапки у всех целей прокрутки ([id], поля); на поле идеи DevHub — явно.
 * Пиксели после выкатки меряет devhub-sticky.mjs (nakryto: false на обеих парах).
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("145: прокрутка к цели не уводит её под липкую шапку", () => {
  test("🔴 общее правило: якоря и поля получают scroll-margin-top от высоты шапки", () => {
    const css = файл("src/app/globals.css");
    const i = css.indexOf("[id], input, textarea, select {");
    expect(i, "нет общего правила").toBeGreaterThan(0);
    expect(css.slice(i, i + 160)).toContain("scroll-margin-top: calc(var(--aevion-header-h, 0px) + 12px);");
  });
  test("🔴 поле идеи DevHub — цель scrollIntoView — несёт отступ прокрутки от --aevion-header-h", () => {
    const s = файл("src/app/devhub/page.tsx");
    expect(s).toContain('<div ref={ideaFieldRef} style={{ display: "flex", gap: 10, flexWrap: "wrap", scrollMarginTop: "calc(var(--aevion-header-h, 56px) + 12px)" }}>');
  });
  test("шапка по-прежнему публикует --aevion-header-h (иначе отступ равен 12 px)", () => {
    expect(файл("src/components/SiteHeader.tsx")).toContain('"--aevion-header-h"');
  });
});
