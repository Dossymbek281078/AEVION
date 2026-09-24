// Подсказка и «Правильный ход» печатаются шахматной нотацией, а не UCI.
// Замер 23.09.2026 на проде: «Решение» показывало «d2d1» на задаче «Мат в 2» —
// машинный формат, который шахматист не читает.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hodPoRusski } from "../puzzleNormalize";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("ход решения по-человечески", () => {
  it("мат ферзём, взятие, шах и рокировка", () => {
    expect(hodPoRusski("7k/8/8/8/8/8/3q4/6K1 b - - 0 1", "d2d1")).toBe("Фd1+");
    expect(hodPoRusski("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a8")).toBe("Лa8#");
    expect(hodPoRusski("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "e4d5")).toBe("exd5");
    expect(hodPoRusski("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1")).toBe("O-O");
  });
  it("контроль: мусор и невозможный ход возвращаются как есть, без падения", () => {
    expect(hodPoRusski("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a7a")).toBe("Лa7");
    expect(hodPoRusski("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "h4h5")).toBe("h4h5");
    expect(hodPoRusski("не-фен", "a1a8")).toBe("a1a8");
    expect(hodPoRusski("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "")).toBe("");
  });
  it("обе строки страницы идут через перевод, UCI напрямую не печатается", () => {
    expect(page.match(/hodPoRusski\(pzCurrent\.fen,pzCurrent\.sol\[0\]\)/g)?.length).toBe(2);
    expect(page).not.toContain("letterSpacing:1}}>{pzCurrent.sol[0]}</span>");
  });
});
