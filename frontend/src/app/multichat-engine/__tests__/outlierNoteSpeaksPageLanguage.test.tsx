/**
 * Хвост строки «Особняком: <агент> — его ответ дальше всех от остальных…» на /en должен быть английским.
 *
 * ПОВОД (замер на проде 30.10.2026, сайт 4f71ad70f, живой консилиум на /en, ?c=probe-multichat):
 * «Stands apart: Analyst — его ответ дальше всех от остальных. Это не «неправ», это «прочитать первым».»
 * Заголовок шёл через tm(), а хвост остался русским литералом в JSX (CouncilConsole.tsx:594).
 *
 * КОНТРОЛЬ: на e46dddc0a оба случая красные (литерал в исходнике есть, перевода в MC_TEXT нет).
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MC_TEXT, tm } from "../mcText";

const ХВОСТ = "— его ответ дальше всех от остальных. Это не «неправ», это «прочитать первым».";

describe("строка «Особняком» говорит на языке страницы", () => {
  test("перевод хвоста есть на en и kk, без кириллицы на en", () => {
    expect(MC_TEXT[ХВОСТ]?.en, "нет перевода хвоста на en").toBeTruthy();
    expect(MC_TEXT[ХВОСТ]?.kk, "нет перевода хвоста на kk").toBeTruthy();
    expect(tm("en", ХВОСТ)).not.toMatch(/[А-Яа-яЁё]/);
    expect(tm("en", ХВОСТ)).toMatch(/farthest from the rest/);
    expect(tm("ru", ХВОСТ)).toBe(ХВОСТ);
  });

  test("в CouncilConsole хвост не лежит голым литералом — только через tm()", () => {
    const src = readFileSync(join(__dirname, "..", "CouncilConsole.tsx"), "utf8");
    const голый = src.split("\n").filter((l) => l.includes(ХВОСТ) && !l.includes("tm("));
    expect(голый, `русский литерал вне tm():\n${голый.join("\n")}`).toEqual([]);
    expect(src.includes(`tm(mcLang, "${ХВОСТ}")`), "хвост должен идти через tm(mcLang, …)").toBe(true);
  });
});
