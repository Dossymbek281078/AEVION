import { describe, it, expect } from "vitest";
import { gameResultOf } from "../gameResult";

/* Every string sOver(...) can put into a SavedGame.result. The stats panel used to
   classify wins with result.includes("win"), which "Checkmate — AI wins" also
   satisfies — so a loss counted as both a win and a loss, draws were derived as
   total−w−l and could go negative, and the win rate was overstated. Timeouts and
   resignations matched no filter at all and fell into the draw bucket. */
describe("gameResultOf", () => {
  it("reads a win", () => {
    expect(gameResultOf("Checkmate! You win! 🏆")).toBe("W");
    expect(gameResultOf("AI timed out — you win!")).toBe("W");
    expect(gameResultOf("⚡ Три шаха — победа! You win!")).toBe("W");
  });

  it("reads a loss, including the two that used to slip through", () => {
    expect(gameResultOf("Checkmate — AI wins")).toBe("L");
    expect(gameResultOf("Time out")).toBe("L");
    expect(gameResultOf("You resigned")).toBe("L");
  });

  it("reads a draw", () => {
    expect(gameResultOf("Draw agreed")).toBe("D");
    expect(gameResultOf("Stalemate")).toBe("D");
    expect(gameResultOf("Draw by repetition")).toBe("D");
  });

  it("never counts one game as both a win and a loss", () => {
    const results = [
      "Checkmate! You win! 🏆",
      "Checkmate — AI wins",
      "AI timed out — you win!",
      "Time out",
      "You resigned",
      "Draw agreed",
      "Stalemate",
    ];
    const w = results.filter((r) => gameResultOf(r) === "W").length;
    const l = results.filter((r) => gameResultOf(r) === "L").length;
    const d = results.filter((r) => gameResultOf(r) === "D").length;
    // The panel derives draws as total − w − l, so the three must partition exactly.
    expect(w + l + d).toBe(results.length);
    expect(results.length - w - l).toBe(d);
  });

  it("treats an unknown ending as a loss rather than silently a draw", () => {
    expect(gameResultOf("Что-то новое")).toBe("L");
  });
});
