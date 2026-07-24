import { describe, it, expect } from "vitest";
import { describeBoardPieces } from "../src/lib/voiceCoachPrompt";

describe("describeBoardPieces", () => {
  it("lists every piece including pawns, matching chess.js .board() exactly (issue #858)", () => {
    // The exact FEN from checklist item 8: the model previously omitted the
    // black pawn on e5 (15/16 pieces) when asked to enumerate the board.
    const fen =
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5";
    const desc = describeBoardPieces(fen);
    expect(desc).toBeTruthy();
    expect(desc).toContain("пe5");
    expect(desc).toContain("белые (16)");
    expect(desc).toContain("чёрные (16)");
  });

  it("uses RU chess notation for each piece type", () => {
    const fen = "4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1";
    const desc = describeBoardPieces(fen) ?? "";
    expect(desc).toContain("Крe1"); // white king
    expect(desc).toContain("Крe8"); // black king
    expect(desc).toContain("Лd2"); // white rook
    expect(desc).toContain("Фd5"); // black queen
  });

  it("returns null for an invalid FEN instead of throwing", () => {
    expect(describeBoardPieces("not-a-real-fen")).toBeNull();
  });

  it("handles a near-empty endgame board (few pieces, no queens/rooks)", () => {
    const fen = "8/P7/8/8/8/8/8/K6k w - - 0 1";
    const desc = describeBoardPieces(fen) ?? "";
    expect(desc).toContain("белые (2)");
    expect(desc).toContain("чёрные (1)");
    expect(desc).toContain("пa7"); // unpromoted white pawn about to queen
    expect(desc).toContain("Крh1"); // white king
  });

  it("reflects promotions already on the board (piece type follows the FEN, not history)", () => {
    // White pawn has already promoted to a queen on a8.
    const fen = "Q6k/8/8/8/8/8/8/7K w - - 0 1";
    const desc = describeBoardPieces(fen) ?? "";
    expect(desc).toContain("Фa8");
    expect(desc).not.toContain("пa8");
  });
});
