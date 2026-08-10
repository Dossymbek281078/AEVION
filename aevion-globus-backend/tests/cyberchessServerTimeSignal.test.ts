import { describe, it, expect } from "vitest";
import {
  computeServerTimeStats,
  classifyServerTimeSignal,
  type ServerMove,
} from "../src/lib/cyberchessServerTimeSignal";

const WHITE = "userWhite";
const BLACK = "userBlack";

/** Build a moves array alternating white/black, `at` timestamps given in ms from game start. */
function movesAt(offsetsMs: number[], gameStartAt = 0): ServerMove[] {
  return offsetsMs.map((ms, i) => ({
    uci: "e2e4",
    by: i % 2 === 0 ? WHITE : BLACK,
    at: gameStartAt + ms,
  }));
}

describe("computeServerTimeStats", () => {
  it("returns null for a game with no moves", () => {
    expect(computeServerTimeStats([], 0, WHITE)).toBeNull();
  });

  it("computes plausible human-like variance as a normal (non-suspicious) CoV", () => {
    // White think-times: 3s, 8s, 2s, 12s, 5s, 9s, 4s, 7s — naturally variable.
    const offsets = [3000, 3500, 11000, 11700, 13700, 14100, 25700, 26400, 30700, 31200, 39700, 40300, 44700, 45200, 51700, 52300];
    const moves = movesAt(offsets);
    const stats = computeServerTimeStats(moves, 0, WHITE);
    expect(stats).not.toBeNull();
    expect(stats!.timeCoV).toBeGreaterThan(0.35); // healthy variance, not flat
    expect(stats!.instantMoves).toBe(0);
  });

  it("flags a suspiciously uniform think-time pattern (low CoV) after the book-move window", () => {
    // White takes exactly 2000ms every single move from ply 8 onward (ply>6 required
    // for instant-move scoring; here times aren't <800ms, they're just perfectly flat).
    const offsets: number[] = [];
    let t = 0;
    for (let ply = 0; ply < 20; ply++) {
      t += 2000;
      offsets.push(t);
    }
    const moves = movesAt(offsets);
    const stats = computeServerTimeStats(moves, 0, WHITE);
    expect(stats).not.toBeNull();
    expect(stats!.timeCoV).toBeLessThan(0.05); // near-zero variance = red flag
  });

  it("counts instant moves only past the book-move window (ply > 6)", () => {
    // Plies 0-6: fast (200ms) opening book moves — should NOT count as instant.
    // Plies 7+: fast (300ms) moves post-opening — SHOULD count as instant.
    const offsets: number[] = [];
    let t = 0;
    for (let ply = 0; ply < 16; ply++) {
      t += ply <= 6 ? 210 : 300;
      offsets.push(t);
    }
    const moves = movesAt(offsets);
    const whiteStats = computeServerTimeStats(moves, 0, WHITE);
    expect(whiteStats).not.toBeNull();
    // White plies are 0,2,4,6,8,10,12,14 — only 8,10,12,14 are past ply>6.
    expect(whiteStats!.instantMoves).toBe(4);
  });

  it("attributes think-time correctly per side using gameStartAt for the very first move", () => {
    // White's first move (ply 0) takes 5s from game start; black's first move
    // (ply 1) takes 3s from white's move, not from game start.
    const moves: ServerMove[] = [
      { uci: "e2e4", by: WHITE, at: 5000 },
      { uci: "e7e5", by: BLACK, at: 8000 },
    ];
    const blackStats = computeServerTimeStats(moves, 0, BLACK);
    // Only one black move and it's filtered by the >200ms rule but n=1 is still
    // reported (diagnosticMoves=1) — just verifying the elapsed delta is 3000ms
    // by checking it doesn't equal the wrong (8000ms from game start) value.
    expect(blackStats).not.toBeNull();
    expect(blackStats!.avgMoveTimeMs).toBe(3000);
  });

  it("ignores near-zero artifacts (<=200ms) per the same filter as the client signal", () => {
    const moves: ServerMove[] = [
      { uci: "e2e4", by: WHITE, at: 100 }, // 100ms from start — filtered out
    ];
    expect(computeServerTimeStats(moves, 0, WHITE)).toBeNull();
  });
});

describe("classifyServerTimeSignal", () => {
  it("returns insufficient confidence below the 8-move floor, regardless of stats", () => {
    const v = classifyServerTimeSignal({
      diagnosticMoves: 5,
      avgMoveTimeMs: 2000,
      timeCoV: 0.01, // would otherwise look extremely suspicious
      instantMoves: 10,
    });
    expect(v.confidence).toBe("insufficient");
    expect(v.verdict).toBe("clean");
    expect(v.suspicionScore).toBe(0);
  });

  it("scores healthy human-like variance as clean with meaningful confidence", () => {
    const v = classifyServerTimeSignal({
      diagnosticMoves: 20,
      avgMoveTimeMs: 8000,
      timeCoV: 0.85,
      instantMoves: 0,
    });
    expect(v.verdict).toBe("clean");
    expect(v.confidence).toBe("high");
  });

  it("never reaches 'flagged' from timing alone — caps at 'suspicious'", () => {
    const v = classifyServerTimeSignal({
      diagnosticMoves: 30,
      avgMoveTimeMs: 2000,
      timeCoV: 0.0,
      instantMoves: 15,
    });
    expect(v.suspicionScore).toBeGreaterThan(60);
    expect(v.verdict).toBe("suspicious");
  });

  it("scales confidence with sample size (12-19 moves → medium, 20+ → high)", () => {
    const base = { avgMoveTimeMs: 5000, timeCoV: 0.8, instantMoves: 0 };
    expect(classifyServerTimeSignal({ ...base, diagnosticMoves: 12 }).confidence).toBe("medium");
    expect(classifyServerTimeSignal({ ...base, diagnosticMoves: 20 }).confidence).toBe("high");
  });
});
