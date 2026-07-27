import { describe, it, expect } from "vitest";
import { analyzeGameForCheating } from "../anticheat";
import type { MoveMetric } from "../stockfishMetrics";
import type { BehaviorSummary } from "../behaviorTracker";

/* Anti-cheat had no tests, and it is the module where a mistake costs the most:
   a false positive accuses an honest player, and the result is POSTed to the
   backend whenever confidence is anything but "insufficient".

   These pin the conservative rules the module already implements — a verdict needs
   enough diagnostic moves and several converging signals — so that loosening them
   has to be a deliberate edit rather than a side effect. */

/** A move the analyser will treat as diagnostic: past the opening, no forcing gap. */
function move(ply: number, rank: 1 | 2 | 3 | 4, cpl: number, timeMs = 8000): MoveMetric {
  return {
    ply,
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    san: "Nf3",
    uci: "g1f3",
    engineTop3: [
      { uci: "g1f3", eval: 20, mateIn: null },
      { uci: "d2d4", eval: 10, mateIn: null },
      { uci: "e2e4", eval: 5, mateIn: null },
    ],
    cpl,
    rank,
    hadMate1: false, hadMate2: false, hadMate3: false,
    foundMate1: false, foundMate2: false, foundMate3: false,
    isHang: false, isBrilliancy: false,
    timeMs,
  };
}

/** White to move on odd plies, so these are all the player's own moves. */
const playerMoves = (count: number, rank: 1 | 2 | 3 | 4, cpl: number) =>
  Array.from({ length: count }, (_, i) => move(7 + i * 2, rank, cpl));

const calmBehaviour: BehaviorSummary = {
  tabHiddenCount: 0, windowBlurCount: 0, fenCopyCount: 0, rapidReturnCount: 0,
  instantMoveCount: 0, devtoolsCount: 0, maxHiddenMs: 0, totalHiddenMs: 0,
  suspicionEvents: [], behaviorScore: 0, fenCopyDetected: false,
};

describe("analyzeGameForCheating", () => {
  it("says nothing on a short game, however perfect the play", () => {
    // Engine-perfect, but only a handful of diagnostic moves to judge from.
    const r = analyzeGameForCheating(playerMoves(4, 1, 0), "w", 1500, calmBehaviour);
    expect(r.confidence).toBe("insufficient");
    expect(r.verdict).toBe("clean");
  });

  it("scales confidence with the number of diagnostic moves", () => {
    const at = (n: number) => analyzeGameForCheating(playerMoves(n, 2, 40), "w", 1500, calmBehaviour).confidence;
    expect(at(5)).toBe("insufficient");
    expect(at(12)).toBe("low");
    expect(at(25)).toBe("medium");
    expect(at(40)).toBe("high");
  });

  it("leaves ordinary club play alone", () => {
    // Varied on purpose: a real player's ranks, losses and clock usage all scatter.
    // Feeding perfectly uniform moves makes the analyser suspicious of the
    // uniformity itself, which is correct behaviour on unrealistic input.
    const ranks: Array<1 | 2 | 3 | 4> = [1, 3, 2, 4, 2, 1, 3, 4, 2, 3];
    const cpls = [10, 75, 45, 130, 55, 5, 90, 160, 35, 70];
    const times = [4200, 11000, 7300, 25000, 6100, 3400, 14500, 31000, 5200, 9800];
    const moves = Array.from({ length: 30 }, (_, i) =>
      move(7 + i * 2, ranks[i % ranks.length], cpls[i % cpls.length], times[i % times.length]),
    );
    const r = analyzeGameForCheating(moves, "w", 1500, calmBehaviour);
    expect(r.verdict).toBe("clean");
  });

  it("only counts the player's own moves", () => {
    // All even plies — Black's moves. For White there is nothing to analyse.
    const blackOnly = Array.from({ length: 30 }, (_, i) => move(8 + i * 2, 1, 0));
    const r = analyzeGameForCheating(blackOnly, "w", 1500, calmBehaviour);
    expect(r.confidence).toBe("insufficient");
    expect(r.stats).toBeDefined();
  });

  it("ignores the opening, where book moves look engine-perfect", () => {
    const bookOnly = [1, 2, 3, 4, 5, 6].map((ply) => move(ply, 1, 0));
    const r = analyzeGameForCheating(bookOnly, "w", 1500, calmBehaviour);
    expect(r.confidence).toBe("insufficient");
  });

  /* A FEN copy is the one signal strong enough to reach a verdict on its own. It used
     to reach "flagged" with no sample-size gate at all — which the app then earned on
     its own behalf: it offers a «Копировать FEN» button and, when the clipboard API
     fails, prints the FEN and asks the player to copy it by hand. On a three-move game
     the signal is kept but held at "suspicious" until there is something to judge. */
  it("holds a lone FEN copy at suspicion while the game is too short to judge", () => {
    const r = analyzeGameForCheating(
      playerMoves(3, 4, 120), // too short to judge, and played badly
      "w", 1500,
      { ...calmBehaviour, fenCopyCount: 1, fenCopyDetected: true },
    );
    expect(r.confidence).toBe("insufficient");
    expect(r.verdict).toBe("suspicious");
    expect(r.fenCopyDetected).toBe(true);
  });

  it("flags a FEN copy once the game gives enough to judge", () => {
    const r = analyzeGameForCheating(
      playerMoves(40, 1, 20),
      "w", 1500,
      { ...calmBehaviour, fenCopyCount: 1, fenCopyDetected: true },
    );
    expect(r.confidence).not.toBe("insufficient");
    expect(r.verdict).toBe("flagged");
  });

  it("survives an empty game without throwing", () => {
    const r = analyzeGameForCheating([], "w", null, null);
    expect(r.verdict).toBe("clean");
    expect(r.confidence).toBe("insufficient");
    // Note: the score is not 0 for an empty game — some signals default to a
    // non-zero baseline when there is nothing to measure. Harmless while the
    // verdict is gated on confidence, but it means the raw score must never be
    // shown without that gate.
    expect(r.suspicionScore).toBeLessThan(28);
  });

  it("clamps a wild fide estimate instead of trusting it", () => {
    const low = analyzeGameForCheating(playerMoves(20, 2, 50), "w", -9999, calmBehaviour);
    const high = analyzeGameForCheating(playerMoves(20, 2, 50), "w", 99999, calmBehaviour);
    expect(low.verdict).toBeDefined();
    expect(high.verdict).toBeDefined();
  });
});
