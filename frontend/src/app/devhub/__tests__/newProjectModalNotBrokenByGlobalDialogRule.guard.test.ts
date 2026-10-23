import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * В globals.css на ширине ≤768 стоит правило «[role="dialog"] > div — fixed,
 * прижать к низу». Оно написано для окон, где роль стоит на ПОДЛОЖКЕ. У окна
 * «Новый проект» DevHub роль на самой панели, и правило делало fixed каждый её
 * блок: замер прода 23.10.2026 на 390×844 — панель высотой 90 px (только
 * заголовок), 4 из 5 детей fixed, поля и стеки поверх страницы, кнопка
 * «Создать проект» обрезана. Первый шаг пути «вход → проект» был сломан.
 */
const CSS = fs.readFileSync(path.resolve(__dirname, "..", "..", "globals.css"), "utf8");
const PAGE = fs.readFileSync(path.resolve(__dirname, "..", "page.tsx"), "utf8");

describe("окно «Новый проект» не разбирает глобальное правило окон", () => {
  test("правило не трогает панели с data-dialog-panel", () => {
    expect(CSS).not.toMatch(/\[role="dialog"\] > div\s*\{/);
    expect(CSS).toContain('[role="dialog"]:not([data-dialog-panel]) > div {');
  });

  test("панель окна «Новый проект» помечена", () => {
    const i = PAGE.indexOf('aria-labelledby="devhub-new-project-title"');
    expect(i, "окно «Новый проект» не найдено").toBeGreaterThan(-1);
    expect(PAGE.slice(i, i + 200)).toContain("data-dialog-panel");
  });
});
