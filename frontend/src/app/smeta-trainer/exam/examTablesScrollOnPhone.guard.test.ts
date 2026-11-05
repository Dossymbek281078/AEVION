/**
 * 05.11.2026 (Приложения): на телефоне 390×844 страница кейса экзамена получала горизонтальный сдвиг
 * +120…140 px — таблица позиций (469 px) лежала прямо в колонке. Замер прода 3c9b2d343757, 3 кейса из 3.
 * Каждая таблица страницы кейса обязана лежать в контейнере с прокруткой по X.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");

describe("страница кейса экзамена: таблицы на узком экране", () => {
  it("контроль: таблицы на странице есть", () => {
    expect((SRC.match(/<table\b/g) || []).length).toBeGreaterThanOrEqual(3);
  });
  it("каждая <table> сразу внутри блока overflow-x-auto", () => {
    const rows = SRC.split("\n");
    const bad: number[] = [];
    rows.forEach((l, i) => {
      if (/<table\b/.test(l) && !/overflow-x-auto/.test(rows[i - 1] ?? "")) bad.push(i + 1);
    });
    expect(bad, `таблицы без прокрутки по X, строки: ${bad.join(", ")}`).toEqual([]);
  });
  it("число открывающих и закрывающих обёрток сходится", () => {
    expect((SRC.match(/data-exam-table-scroll/g) || []).length).toBe((SRC.match(/<\/table>/g) || []).length);
  });
});
