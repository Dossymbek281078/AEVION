import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { resolveBookMove } from "../localOpeningBook";

/* The book keys positions on placement + side to move + castling and drops the
   en-passant field so transpositions collapse. That makes it possible for an
   entry to offer an en-passant capture that is illegal in the position actually
   on the board. Both consumers played such a move unchecked once: the bot
   stalled the game, the explorer produced a dead click. resolveBookMove is the
   single guard they both go through now. */

const START = new Chess().fen();

describe("resolveBookMove", () => {
  it("resolves a legal uci and reports the real move", () => {
    const mv = resolveBookMove(START, "e2e4");
    expect(mv?.san).toBe("e4");
    expect(mv?.from).toBe("e2");
    expect(mv?.to).toBe("e4");
  });

  it("falls back to san when there is no uci — the deep tree carries no uci", () => {
    expect(resolveBookMove(START, "", "Nf3")?.san).toBe("Nf3");
    expect(resolveBookMove(START, undefined, "d4")?.san).toBe("d4");
  });

  it("returns null for a move that is not legal in this position", () => {
    expect(resolveBookMove(START, "e2e5")).toBeNull(); // pawn cannot reach e5
    expect(resolveBookMove(START, "d1h5")).toBeNull(); // queen is blocked
    expect(resolveBookMove(START, "", "Qh5")).toBeNull();
  });

  it("rejects the en-passant capture this whole guard exists for", () => {
    // Black has just played ...f7-f5, so exf6 is legal here.
    const withEp = "rnbqkbnr/ppppp1pp/8/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3";
    expect(resolveBookMove(withEp, "e5f6")?.san).toBe("exf6");

    // Identical placement, castling and side to move — but reached another way,
    // so there is no en-passant right. This is exactly the position the book's
    // key cannot tell apart from the one above, and the capture must be refused.
    const noEp = "rnbqkbnr/ppppp1pp/8/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
    expect(resolveBookMove(noEp, "e5f6")).toBeNull();
  });

  it("never throws on malformed input", () => {
    expect(resolveBookMove(START, "zz")).toBeNull();
    expect(resolveBookMove(START, "z9z9")).toBeNull();
    expect(resolveBookMove(START)).toBeNull();
    expect(resolveBookMove("not a fen", "e2e4")).toBeNull();
  });

  it("leaves the caller's position untouched", () => {
    const g = new Chess();
    const before = g.fen();
    resolveBookMove(g.fen(), "e2e4");
    expect(g.fen()).toBe(before);
  });
});
