import { describe, it, expect } from "vitest";
import { gameResultOf } from "../gameResult";

/* Результат в PGN абсолютен («1-0» = выиграли белые), а строка окончания партии
   относительна игроку («You win»). Во всех четырёх местах, где строился PGN и метаданные
   ролика, стояло `includes("You win") ? "1-0"` без учёта цвета — победа ЧЁРНЫМИ уходила в
   файл как 1-0, причём теги White/Black цвет уже учитывали, и файл противоречил сам себе.

   Логика вынесена в page.tsx (pgnResultOf); здесь проверяется её ядро — что классификатор
   даёт нужный исход для реальных строк, и правило перевода в абсолютный результат. */

const pgnResult = (over: string, playerColor: "w" | "b", hotseat = false): string => {
  if (hotseat) {
    if (over.includes("Белые победили")) return "1-0";
    if (over.includes("Чёрные победили")) return "0-1";
    return "1/2-1/2";
  }
  const r = gameResultOf(over);
  if (r === "D") return "1/2-1/2";
  return (r === "W") === (playerColor === "w") ? "1-0" : "0-1";
};

describe("pgn result", () => {
  it("writes a win as 1-0 for White and 0-1 for Black", () => {
    expect(pgnResult("Checkmate! You win! 🏆", "w")).toBe("1-0");
    expect(pgnResult("Checkmate! You win! 🏆", "b")).toBe("0-1");
  });

  it("writes a loss from the winner's side, not the player's", () => {
    expect(pgnResult("Checkmate — AI wins", "w")).toBe("0-1");
    expect(pgnResult("Checkmate — AI wins", "b")).toBe("1-0");
  });

  it("counts a win on the clock like any other win", () => {
    expect(pgnResult("AI timed out — you win!", "b")).toBe("0-1");
  });

  it("marks every draw the same way whoever the player is", () => {
    for (const c of ["w", "b"] as const) {
      expect(pgnResult("Stalemate", c)).toBe("1/2-1/2");
      expect(pgnResult("Draw agreed", c)).toBe("1/2-1/2");
    }
  });

  it("reads the winner off the board in hotseat, where both sides are people", () => {
    expect(pgnResult("Checkmate — Белые победили", "b", true)).toBe("1-0");
    expect(pgnResult("Checkmate — Чёрные победили", "w", true)).toBe("0-1");
  });
});
