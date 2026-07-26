import { describe, it, expect } from "vitest";
import { gameResultOf } from "../gameResult";

/* Every string the game actually ends with, taken from the sOver(...) call sites rather
   than invented. Four of them used to come back "L": threefold repetition, insufficient
   material, the Russian draw, and — worst — a win against a live opponent. Rating and
   streaks are computed from this, so each miss cost the player rating. */

const REAL_ENDINGS: [string, "W" | "L" | "D"][] = [
  ["Checkmate! You win! 🏆", "W"],
  ["Checkmate — AI wins", "L"],
  ["Stalemate", "D"],
  ["Threefold repetition", "D"],
  ["Insufficient material", "D"],
  ["50-move draw", "D"],
  ["AI timed out — you win!", "W"],
  ["Draw agreed", "D"],
  ["Time out", "L"],
  ["You resigned", "L"],
  ["Ничья (договорились)", "D"],
  ["Соперник сдался — Вы победили!", "W"],
  ["Мат — вы победили! 🏆", "W"],
  ["Пат", "D"],
];

describe("gameResultOf over the endings the game really produces", () => {
  for (const [ending, want] of REAL_ENDINGS) {
    it(`«${ending}» → ${want}`, () => {
      expect(gameResultOf(ending)).toBe(want);
    });
  }

  it("counts an unrecognised ending as a loss rather than throwing", () => {
    expect(gameResultOf("что-то новое")).toBe("L");
    expect(gameResultOf("")).toBe("L");
  });

  /* "AI wins" contains "win" — an earlier classifier elsewhere matched on that and put
     the same game into both the win and the loss column. */
  it("does not read the opponent's win as the player's", () => {
    expect(gameResultOf("Checkmate — AI wins")).toBe("L");
    expect(gameResultOf("AI wins on time")).toBe("L");
  });
});
