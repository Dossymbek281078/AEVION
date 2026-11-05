import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 5.11.2026, прод: пустая лента звала «создайте событие», а кнопки у гостя не было.
const PAGE = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("гость QEvents не упирается в пустоту", () => {
  test("кнопка создания не спрятана за currentUserId", () => {
    expect(PAGE).not.toMatch(/\{currentUserId && \(\s*<button\s+onClick=\{\(\) => setShowCreateModal\(true\)\}/);
    expect(PAGE.match(/<CreateEventAction /g)?.length).toBe(2);
  });
  test("гостю — вход с возвратом на /qevents, через общий помощник с меткой канала", () => {
    expect(PAGE).toContain('useСсылкаВхода("/qevents")');
  });
  test("первая строка страницы не потеряна", () => {
    expect(PAGE.split("\n")[0]).toMatch(/use client/);
  });
});
