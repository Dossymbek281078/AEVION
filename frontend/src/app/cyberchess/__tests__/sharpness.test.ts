import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { sharpnessOf, scoreMoves } from "../humanBot";

/* Острота нужна, чтобы бот ошибался там же, где ошибается человек: в позициях с
   кучей форсированных продолжений, а не в мёртвой тишине. Тест проверяет не
   формулу, а то, что порядок величин соответствует шахматному смыслу. */

const scoredOf = (fen: string) => scoreMoves(new Chess(fen), () => 0);

describe("острота позиции", () => {
  it("стартовая позиция тиха: ни взятий, ни шахов", () => {
    expect(sharpnessOf(scoredOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"))).toBe(0);
  });

  it("голый король против короля — тоже ноль", () => {
    expect(sharpnessOf(scoredOf("8/8/4k3/8/8/4K3/8/8 w - - 0 1"))).toBe(0);
  });

  it("позиция со взятиями острее тихой", () => {
    const quiet = sharpnessOf(scoredOf("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"));
    // пешки в контакте: e4 может взять d5 — форсированное продолжение на доске
    const loud = sharpnessOf(scoredOf("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1"));
    expect(loud).toBeGreaterThan(quiet);
  });

  it("значение всегда в пределах от 0 до 1", () => {
    for (const fen of [
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
      "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    ]) {
      const v = sharpnessOf(scoredOf(fen));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("пустой список ходов не роняет счёт", () => {
    expect(sharpnessOf([])).toBe(0);
  });
});
