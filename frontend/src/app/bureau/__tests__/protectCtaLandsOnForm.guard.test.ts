import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/**
 * 02.11.2026 (проход письма pb376, гость en 390 px): кнопки «Protect Your Work» на /bureau вели на верх
 * /qright, и человек нажимал второй раз, пролистывая блок «напишите мне, когда откроется Verified».
 * Якорь #protect-form срабатывает при загрузке страницы — форма сразу в кадре.
 */
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
describe("кнопки «защитить» на /bureau ведут сразу к форме", () => {
  test("ни одной ссылки cta_click→qright на голый /qright", () => {
    expect(PAGE).not.toMatch(/href="\/qright" onClick=\{\(\) => track\(\{ type: "cta_click"/);
    expect((PAGE.match(/href="\/qright#protect-form"/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
