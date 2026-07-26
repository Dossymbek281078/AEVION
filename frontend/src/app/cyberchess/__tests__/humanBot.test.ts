import { describe, it, expect } from "vitest";
import { Chess, type Move } from "chess.js";
import { mm } from "../minimax";
import {
  HUMAN_PROFILES,
  pickBookMove,
  pickHumanMove,
  scoreMoves,
  temptation,
  type ScoredMove,
} from "../humanBot";

/** Deterministic rng cycling through a fixed script of values. */
function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Cheap deterministic rng — enough spread for distribution assertions. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mv(partial: Partial<Move>): Move {
  return { color: "w", from: "e2", to: "e4", piece: "p", san: "e4", flags: "n", ...partial } as Move;
}

describe("pickBookMove", () => {
  const opts = [
    { uci: "e2e4", freq: 900 },
    { uci: "d2d4", freq: 700 },
    { uci: "b1a3", freq: 2 },
  ];

  it("returns null once past the profile's book depth", () => {
    const p = HUMAN_PROFILES[2];
    expect(pickBookMove(opts, p.bookPlies, p, () => 0)).toBeNull();
  });

  it("returns null when out of book", () => {
    expect(pickBookMove([], 0, HUMAN_PROFILES[2], () => 0)).toBeNull();
  });

  it("declines the book when the chance roll fails", () => {
    // Beginner follows book only 55% of the time.
    expect(pickBookMove(opts, 0, HUMAN_PROFILES[0], () => 0.9)).toBeNull();
  });

  it("prefers mainlines more strongly at higher level", () => {
    const rng = lcg(7);
    const count = (level: number) => {
      let sideline = 0;
      for (let i = 0; i < 3000; i++) {
        if (pickBookMove(opts, 0, HUMAN_PROFILES[level], rng) === "b1a3") sideline++;
      }
      return sideline;
    };
    // Club (sharpness 1.4) should reach for the near-unplayed 1.Na3 far less
    // often than Beginner (sharpness 0.4).
    expect(count(2)).toBeLessThan(count(0));
  });

  it("only ever returns one of the supplied continuations", () => {
    const rng = lcg(11);
    for (let i = 0; i < 500; i++) {
      const picked = pickBookMove(opts, 0, HUMAN_PROFILES[1], rng);
      if (picked !== null) expect(opts.map((o) => o.uci)).toContain(picked);
    }
  });
});

describe("temptation", () => {
  it("rates a queen capture above a quiet pawn move", () => {
    expect(temptation(mv({ captured: "q", san: "Rxd8" }))).toBeGreaterThan(temptation(mv({ san: "h3" })));
  });

  it("rates a check above an equivalent quiet move", () => {
    expect(temptation(mv({ san: "Bb5+" }))).toBeGreaterThan(temptation(mv({ san: "Bb5" })));
  });

  it("is always positive so it can be used as a weight", () => {
    const g = new Chess();
    for (const m of g.moves({ verbose: true }) as Move[]) expect(temptation(m)).toBeGreaterThan(0);
  });
});

describe("pickHumanMove", () => {
  const scored: ScoredMove[] = [
    { move: mv({ san: "Nf3" }), score: 40 },
    { move: mv({ san: "Nc3" }), score: 25 },
    { move: mv({ san: "Qh5", piece: "q", from: "d1", to: "h5" }), score: -450 },
    { move: mv({ san: "Rxa7", piece: "r", captured: "p", from: "a1", to: "a7" }), score: -900 },
  ];

  it("returns null on an empty list and the only move when forced", () => {
    expect(pickHumanMove([], HUMAN_PROFILES[0], () => 0)).toBeNull();
    const only = [scored[0]];
    expect(pickHumanMove(only, HUMAN_PROFILES[0], () => 0.99)?.san).toBe("Nf3");
  });

  it("takes a forced mate almost always, even at Beginner", () => {
    const mate: ScoredMove[] = [
      { move: mv({ san: "Qh7#" }), score: 1e5 },
      { move: mv({ san: "a3" }), score: 10 },
    ];
    const rng = lcg(3);
    let found = 0;
    for (let i = 0; i < 2000; i++) if (pickHumanMove(mate, HUMAN_PROFILES[0], rng)?.san === "Qh7#") found++;
    expect(found / 2000).toBeGreaterThan(0.85);
  });

  it("never walks into being mated, even on the blunder branch", () => {
    const withMateTrap: ScoredMove[] = [
      { move: mv({ san: "Kg1" }), score: 20 },
      { move: mv({ san: "Kg2" }), score: -1e5 },
    ];
    const rng = lcg(5);
    for (let i = 0; i < 2000; i++) expect(pickHumanMove(withMateTrap, HUMAN_PROFILES[0], rng)?.san).toBe("Kg1");
  });

  it("plays the top move outright when the bestChance roll wins", () => {
    // No mate on the board, so the first rng call is the bestChance roll.
    expect(pickHumanMove(scored, HUMAN_PROFILES[2], seq([0.01]))?.san).toBe("Nf3");
  });

  it("blunders more often at Beginner than at Club", () => {
    const blunderRate = (level: number) => {
      const rng = lcg(29 + level);
      let bad = 0;
      const n = 6000;
      for (let i = 0; i < n; i++) {
        const picked = pickHumanMove(scored, HUMAN_PROFILES[level], rng)!;
        if (picked.san === "Qh5" || picked.san === "Rxa7") bad++;
      }
      return bad / n;
    };
    const beginner = blunderRate(0);
    const club = blunderRate(2);
    expect(beginner).toBeGreaterThan(club);
    // Beginner must actually hang material sometimes — that is the whole point.
    expect(beginner).toBeGreaterThan(0.1);
    // ...but Club should still be mostly sound.
    expect(club).toBeLessThan(0.15);
  });

  it("plays the best move most of the time at Club", () => {
    const rng = lcg(41);
    let top = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) if (pickHumanMove(scored, HUMAN_PROFILES[2], rng)?.san === "Nf3") top++;
    expect(top / n).toBeGreaterThan(0.6);
  });

  it("picks the tempting blunder over the equally-bad quiet one", () => {
    // The whole reason blunders are weighted rather than uniform: a weak player
    // drops a piece grabbing something far more often than by playing a quiet
    // move. Both losers below cost exactly the same, so only temptation can
    // separate them. (Measured over a real walk, this shifts the share of
    // played blunders that are captures/checks/promotions/queen moves from the
    // 32% simply available in the position to 43% actually played.)
    const pair: ScoredMove[] = [
      { move: mv({ san: "Nf3" }), score: 0 },
      { move: mv({ san: "h3" }), score: -400 },
      { move: mv({ san: "Rxb7", piece: "r", captured: "r", from: "b1", to: "b7" }), score: -400 },
    ];
    const rng = lcg(1234);
    let grab = 0, quiet = 0;
    for (let i = 0; i < 8000; i++) {
      const san = pickHumanMove(pair, HUMAN_PROFILES[0], rng)!.san;
      if (san === "Rxb7") grab++;
      else if (san === "h3") quiet++;
    }
    expect(grab).toBeGreaterThan(quiet * 2);
  });

  it("only ever returns a move from the supplied list", () => {
    const rng = lcg(97);
    const sans = scored.map((s) => s.move.san);
    for (let i = 0; i < 3000; i++) {
      for (const level of [0, 1, 2]) {
        expect(sans).toContain(pickHumanMove(scored, HUMAN_PROFILES[level], rng)!.san);
      }
    }
  });
});

/* The synthetic lists above hand pickHumanMove ready-made 400-900cp gaps, so
   they pass no matter how the caller scores moves. These play a real position
   through the real search — the case that caught the scoring depth being too
   shallow for the blunder branch to have anything to fire on. */
describe("blunder branch on a real position", () => {
  // Italian-ish opening, both sides developed, several losing moves available.
  const FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5";
  const searchAt = (d: number) => (p: Chess) => mm(p, d, -Infinity, Infinity, p.turn() === "w");

  it("a 0-ply score cannot grade a blunder — the model needs at least 1", () => {
    const g = new Chess(FEN);
    const gaps = (d: number) => {
      const sc = scoreMoves(g, searchAt(d));
      const best = Math.max(...sc.map((s) => s.score));
      return sc.filter((s) => best - s.score >= 200).length;
    };
    // Static eval sees no reply, so a hanging piece looks as good as a sound
    // move. This is why the caller floors the search depth at 1.
    expect(gaps(0)).toBe(0);
    expect(gaps(1)).toBeGreaterThan(0);
  });

  it("Beginner really hangs material, Club mostly does not", () => {
    const g = new Chess(FEN);
    const scored = scoreMoves(g, searchAt(1));
    const best = Math.max(...scored.map((s) => s.score));
    const rate = (level: number) => {
      const rng = lcg(13 + level);
      let bad = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) {
        const picked = pickHumanMove(scored, HUMAN_PROFILES[level], rng)!;
        if (best - scored.find((s) => s.move.san === picked.san)!.score >= 200) bad++;
      }
      return bad / n;
    };
    const beginner = rate(0);
    const club = rate(2);
    expect(beginner).toBeGreaterThan(0.1);
    expect(club).toBeLessThan(beginner / 2);
  });
});

describe("scoreMoves", () => {
  it("normalises scores to the side to move and leaves the board untouched", () => {
    // Search stub: material count from White's point of view.
    const material = (c: Chess) => {
      const v: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      let s = 0;
      for (const row of c.board()) for (const sq of row) if (sq) s += (sq.color === "w" ? 1 : -1) * v[sq.type];
      return s;
    };

    // Black to move, and Black can win a free rook on a1.
    const g = new Chess("q6k/8/8/8/8/8/8/R6K b - - 0 1");
    const before = g.fen();
    const scored = scoreMoves(g, material);
    expect(g.fen()).toBe(before);
    expect(scored.length).toBe(g.moves().length);

    const grab = scored.find((s) => s.move.san.startsWith("Qxa1"));
    expect(grab).toBeDefined();
    // Higher must mean better *for Black* after the sign flip.
    const quiet = scored.filter((s) => !s.move.captured);
    expect(grab!.score).toBeGreaterThan(Math.max(...quiet.map((s) => s.score)));
  });

  it("returns an empty list in a finished position", () => {
    const mated = new Chess("7k/5QQ1/8/8/8/8/8/7K b - - 0 1");
    expect(scoreMoves(mated, () => 0)).toEqual([]);
  });
});
