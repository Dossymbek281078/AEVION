import { describe, it, expect } from "vitest";
import {
  detectPhase,
  calcMaterialBalance,
  assessCenter,
  assessKingSafety,
} from "../chessCoachEngine";

/* These feed the sentences the coach says out loud, so a wrong answer here is not a
   silent miscalculation — it is the product telling the player something untrue. */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("detectPhase", () => {
  it("calls the first twenty plies the opening regardless of material", () => {
    expect(detectPhase(START, 0)).toBe("opening");
    expect(detectPhase("8/8/4k3/8/8/4K3/8/8 w - - 0 1", 5)).toBe("opening");
  });

  it("switches to endgame once few pieces remain", () => {
    // Two kings and a rook — nothing but the rook counts as a piece.
    expect(detectPhase("4k3/8/8/8/8/8/8/R3K3 w - - 0 60", 60)).toBe("endgame");
  });

  it("calls a full board past the opening a middlegame", () => {
    expect(detectPhase(START, 30)).toBe("middlegame");
  });
});

describe("calcMaterialBalance", () => {
  it("is zero at the start", () => {
    expect(calcMaterialBalance(START)).toBe(0);
  });

  /* The doc used to say centipawns while the values are 1/3/3/5/9 — the number goes
     straight into "опережает на N единиц", so pawns is what the caller needs. */
  it("counts in pawns, not centipawns", () => {
    // White has an extra queen: 9, not 900.
    expect(calcMaterialBalance("4k3/8/8/8/8/8/8/3QK3 w - - 0 1")).toBe(9);
  });

  it("is negative when Black is ahead", () => {
    expect(calcMaterialBalance("3qk3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(-9);
  });

  it("ignores the kings, which are never material", () => {
    expect(calcMaterialBalance("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(0);
  });
});

describe("assessCenter", () => {
  it("reports an open centre when neither side has a pawn there", () => {
    expect(assessCenter("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe("открытый центр");
  });

  it("notices a white pawn on the fourth rank", () => {
    expect(assessCenter("4k3/8/8/8/4P3/8/8/4K3 w - - 0 1")).toContain("белые");
  });

  it("notices a black pawn on the fifth rank", () => {
    expect(assessCenter("4k3/8/8/4p3/8/8/8/4K3 w - - 0 1")).toContain("чёрные");
  });
});

describe("assessKingSafety", () => {
  /* It used to answer "рокировал" — a claim about how the king got there, which the
     position cannot support. A king that walked to c1 in an endgame got the same
     sentence. It now describes where the king stands, which is all it can know. */
  it("describes the king's position rather than claiming a castling happened", () => {
    const castled = assessKingSafety("4k3/8/8/8/8/8/PPP5/2KR4 w - - 0 1");
    expect(castled.white).not.toContain("рокировал");
    expect(castled.white).toBe("укрыт на фланге");
  });

  it("calls a central king central", () => {
    expect(assessKingSafety(START).white).toBe("в центре или активен");
    expect(assessKingSafety(START).black).toBe("в центре или активен");
  });

  it("judges each side on its own back rank", () => {
    // White tucked on g1, Black still in the middle.
    const r = assessKingSafety("4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1");
    expect(r.white).toBe("укрыт на фланге");
    expect(r.black).toBe("в центре или активен");
  });

  it("says it does not know rather than throwing on a broken FEN", () => {
    const r = assessKingSafety("this is not a fen");
    expect(r.white).toBe("неизвестно");
    expect(r.black).toBe("неизвестно");
  });
});
