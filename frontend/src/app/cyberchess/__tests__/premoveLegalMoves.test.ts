import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { premoveLegalMoves } from "../useBoardInput";

/**
 * Regression suite for premoveLegalMoves (P2-2).
 *
 * This pure function is the heart of CyberChess premove selection. Every UI
 * rewrite of the board-input hook (v6/v7/v8) historically broke something the
 * user could feel; the move-generation contract below is what those regressions
 * silently violated. Locking it in unit tests means a future "improvement" that
 * changes which squares light up for a premove fails CI instead of shipping.
 *
 * The contract (per the function's three passes):
 *   Pass 1 — standard chess.js legal moves for the side, with the turn forced
 *            to `pCol` regardless of whose turn the live FEN says it is.
 *   Pass 2 — RESCUE: own (non-king) pieces the FROM square attacks, addable
 *            because the opponent might capture that own piece first.
 *   Pass 3 — PAWN pseudo-legal: forward 1, forward 2 (from start rank only),
 *            and both diagonals — regardless of current square contents,
 *            because the opponent's reply might make them legal.
 */

// Collect the destination squares as a sorted, de-duped array for stable asserts.
function tos(game: Chess, color: "w" | "b", from: string): string[] {
  const moves = premoveLegalMoves(game, color, from as any);
  return [...new Set(moves.map((m) => m.to))].sort();
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("premoveLegalMoves · color & empty guards", () => {
  it("returns [] for an empty square", () => {
    expect(premoveLegalMoves(new Chess(START), "w", "e4" as any)).toEqual([]);
  });

  it("returns [] when the piece belongs to the other color", () => {
    // e7 is a black pawn; asking for white premoves there is invalid.
    expect(premoveLegalMoves(new Chess(START), "w", "e7" as any)).toEqual([]);
  });

  it("ignores whose turn the live FEN says it is (forces pCol to move)", () => {
    // FEN says black to move, but we premove for white from g1.
    const g = new Chess("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1");
    expect(tos(g, "w", "g1")).toContain("f3");
  });
});

describe("premoveLegalMoves · pass 1 (standard legal moves)", () => {
  it("knight on g1 in the start position reaches f3 and h3", () => {
    const r = tos(new Chess(START), "w", "g1");
    expect(r).toContain("f3");
    expect(r).toContain("h3");
  });
});

describe("premoveLegalMoves · pass 2 (rescue projection)", () => {
  it("adds an OWN piece the knight attacks (e2 pawn from g1)", () => {
    // The g1 knight attacks its own e2 pawn — addable as a rescue target.
    expect(tos(new Chess(START), "w", "g1")).toContain("e2");
  });

  it("never offers the own KING as a rescue square", () => {
    // White rook a1, white king a3 (rook attacks the king up the open a-file).
    const g = new Chess("4k3/8/8/8/8/K7/8/R7 w - - 0 1");
    const r = tos(g, "w", "a1");
    expect(r).toContain("a2"); // normal legal move up the file
    expect(r).not.toContain("a3"); // king must never be a rescue target
  });
});

describe("premoveLegalMoves · pass 3 (pawn pseudo-legal)", () => {
  it("offers the forward push even when the square is occupied (speculative)", () => {
    // White pawn e2 blocked by a black pawn on e3. A real move is impossible,
    // but a premove must still light up e3/e4 — the opponent might clear them.
    const g = new Chess("4k3/8/8/8/8/4p3/4P3/4K3 w - - 0 1");
    const r = tos(g, "w", "e2");
    expect(r).toContain("e3"); // forward 1 through the blocker
    expect(r).toContain("e4"); // forward 2 from the start rank
  });

  it("offers both diagonals even when empty (speculative captures)", () => {
    const g = new Chess("4k3/8/8/8/8/4p3/4P3/4K3 w - - 0 1");
    const r = tos(g, "w", "e2");
    expect(r).toContain("d3");
    expect(r).toContain("f3");
  });

  it("does NOT offer a double push when the pawn is off its start rank", () => {
    // White pawn on e3 — single push e4 and diagonals only, never e5.
    const g = new Chess("4k3/8/8/8/8/4P3/8/4K3 w - - 0 1");
    const r = tos(g, "w", "e3");
    expect(r).toContain("e4");
    expect(r).toContain("d4");
    expect(r).toContain("f4");
    expect(r).not.toContain("e5");
  });

  it("offers a black pawn's pseudo-legal squares with the board flipped", () => {
    // Black pawn d7 → d6/d5 forward, c6/e6 diagonals; premove for black.
    const g = new Chess(START);
    const r = tos(g, "b", "d7");
    expect(r).toContain("d6");
    expect(r).toContain("d5"); // double push from black's start rank
    expect(r).toContain("c6");
    expect(r).toContain("e6");
  });
});
