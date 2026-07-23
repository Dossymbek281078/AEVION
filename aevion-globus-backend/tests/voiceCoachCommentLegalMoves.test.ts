import { describe, it, expect } from "vitest";
import { legalMovesFromFen } from "../src/lib/voiceCoachPrompt";

describe("legalMovesFromFen", () => {
  it("returns every legal SAN move for a normal middlegame position", () => {
    const fen =
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5";
    const moves = legalMovesFromFen(fen);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves).toContain("d4"); // a real central break available here
  });

  it("returns exactly the mating move in a forced-mate-in-1 position", () => {
    // Back-rank mate: Ra8# is legal, and nothing else changes that outcome.
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
    const moves = legalMovesFromFen(fen);
    expect(moves).toContain("Ra8#");
  });

  it("returns [] for checkmate/stalemate (no legal moves), not a throw", () => {
    // Fool's mate final position — black just delivered mate, white has none.
    const fen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(legalMovesFromFen(fen)).toEqual([]);
  });

  it("returns [] for an invalid FEN instead of throwing", () => {
    expect(legalMovesFromFen("not-a-real-fen")).toEqual([]);
  });
});
