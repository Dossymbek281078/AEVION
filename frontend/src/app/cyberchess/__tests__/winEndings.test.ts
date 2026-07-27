import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Награда за победу и достижения висят на эффектах, которые узнают победу по подстроке
   "you win" в тексте окончания партии. Так сделано потому, что победа приходит разными
   путями (мат, флаг соперника), и учёт на одной ветке уже подводил.

   Слабое место такой связки — текст. Стоит перевести «You win» на русский или добавить
   восклицание иначе, и оба эффекта умрут МОЛЧА: партия выиграна, Chessy нет, значок не
   загорелся, ошибок ноль. Тест держит контракт: тексты победы над AI содержат маркер, а
   тексты, которые платить не должны, — не содержат. */

const PAGE = readFileSync("src/app/cyberchess/page.tsx", "utf8");
const isWin = (over: string) => over.toLowerCase().includes("you win");

describe("win endings", () => {
  it("still marks the two AI wins the effects listen for", () => {
    // мат: r=w?"Checkmate! You win! 🏆":…   и   флаг: sOver("AI timed out — you win!")
    const mate = /r=w\?"([^"]+)"/.exec(PAGE);
    const flag = /sOver\("(AI timed out[^"]*)"\)/.exec(PAGE);
    expect(mate, "текст мата не найден — эффект награды мог остаться без источника").not.toBeNull();
    expect(flag, "текст флага не найден").not.toBeNull();
    expect(isWin(mate![1])).toBe(true);
    expect(isWin(flag![1])).toBe(true);
  });

  it("does not pay on endings that are not a win over the AI", () => {
    const quiet = [
      "Checkmate — AI wins",
      "Checkmate — Чёрные победили", // хотсит: рейтинга и награды за уровень нет
      "Checkmate — цель достигнута! 🏆", // эндшпильный дрил платит своей наградой
      "You resigned",
      "Time out",
      "Stalemate",
      "Draw agreed",
    ];
    expect(quiet.filter(isWin)).toEqual([]);
  });
});
