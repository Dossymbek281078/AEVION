import { describe, it, expect } from "vitest";
import { английскийРедирект } from "../middleware";

/**
 * Английские адреса без своей страницы отвечали 404 (замер 29.09.2026:
 * /en, /en/pricing, /en/apps, /en/qventure, /en/bureau, /en/cyberchess,
 * /en/about, /en/contact — при 200 у тех же адресов без /en).
 *
 * Тест держит ДВЕ стороны сразу: что переадресуется то, что должно, и что
 * НЕ трогается то, у чего есть своя английская страница. Односторонний тест
 * здесь бесполезен: правило, которое переадресует всё подряд, снесло бы
 * /en/devhub — ровно ту страницу, на которую ведёт Product Hunt.
 */
describe("английскийРедирект", () => {
  it("переадресует английский адрес без своей страницы", () => {
    expect(английскийРедирект("/en/pricing")).toBe("/pricing");
    expect(английскийРедирект("/en/apps")).toBe("/apps");
    expect(английскийРедирект("/en/qventure")).toBe("/qventure");
    expect(английскийРедирект("/en/bureau/org")).toBe("/bureau/org");
  });

  it("сводит /en на главную", () => {
    expect(английскийРедирект("/en")).toBe("/");
    expect(английскийРедирект("/en/")).toBe("/");
  });

  it("НЕ трогает страницы, у которых есть своя английская версия", () => {
    expect(английскийРедирект("/en/devhub")).toBeNull();
    expect(английскийРедирект("/en/devhub/launch")).toBeNull();
    expect(английскийРедирект("/en/shop")).toBeNull();
    expect(английскийРедирект("/en/go")).toBeNull();
  });

  it("НЕ трогает обычные адреса", () => {
    expect(английскийРедирект("/")).toBeNull();
    expect(английскийРедирект("/pricing")).toBeNull();
    expect(английскийРедирект("/devhub")).toBeNull();
  });

  it("не путает префикс с началом слова", () => {
    // «/english-club» начинается на en, но это не языковой префикс.
    expect(английскийРедирект("/english-club")).toBeNull();
    expect(английскийРедирект("/energy")).toBeNull();
  });

  it("переносит пустое и мусорное без падения", () => {
    expect(английскийРедирект(null)).toBeNull();
    expect(английскийРедирект(undefined)).toBeNull();
    expect(английскийРедирект("")).toBeNull();
  });
});
