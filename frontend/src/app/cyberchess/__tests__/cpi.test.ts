import { describe, it, expect, beforeEach } from "vitest";
import {
  computeGameCPI,
  applyGameToCPI,
  ldCPIState,
  DEFAULT_WEIGHTS,
  type GameMetrics,
} from "../cpi";

/* CPI is the number the player watches go up, and it is awarded for the quality of the
   game rather than the result. The module carried its own __runTests() with the three
   worked examples from the spec — exported, never called by anything, never run in CI.
   Those three cases are the first block here; the rest covers what they left open. */

const ranks = (n1: number, n2: number, n3: number, total: number): Array<1 | 2 | 3 | 4> => {
  const out: Array<1 | 2 | 3 | 4> = [];
  for (let i = 0; i < n1; i++) out.push(1);
  for (let i = 0; i < n2; i++) out.push(2);
  for (let i = 0; i < n3; i++) out.push(3);
  while (out.length < total) out.push(4);
  return out;
};

/* Alternating 0/1000ms drives the time sub-score to zero, which is how the spec examples
   were computed — it isolates everything else from the timing term. */
const alternatingTimes = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? 1000 : 0));
const constCpl = (avg: number, n: number) => Array.from({ length: n }, () => avg);

const game = (over: Partial<GameMetrics> = {}): GameMetrics => ({
  cplPerMove: constCpl(25, 40),
  timeMsPerMove: alternatingTimes(40),
  totalTimeMs: 600000,
  openingBookHits: 0,
  movesByEngineRank: ranks(0, 0, 0, 40),
  mateOpportunities: { m1: 0, m2: 0, m3: 0 },
  mateFound: { m1: 0, m2: 0, m3: 0 },
  hangs: 0,
  brilliancies: 0,
  result: "d",
  ...over,
});

describe("the three worked examples from the spec", () => {
  it("a loss played accurately still scores well", () => {
    const total = computeGameCPI(
      game({
        cplPerMove: constCpl(25, 40),
        movesByEngineRank: ranks(18, 0, 0, 40),
        mateOpportunities: { m1: 2, m2: 1, m3: 0 },
        mateFound: { m1: 2, m2: 1, m3: 0 },
        brilliancies: 1,
        result: "l",
      }),
    ).total;
    expect(total).toBeGreaterThan(83);
    expect(total).toBeLessThan(93);
  });

  it("a sloppy win with a blunder scores near nothing", () => {
    const total = computeGameCPI(
      game({
        cplPerMove: constCpl(80, 35),
        timeMsPerMove: alternatingTimes(35),
        movesByEngineRank: ranks(12, 0, 0, 35),
        hangs: 1,
        result: "w",
      }),
    ).total;
    expect(total).toBeGreaterThan(5);
    expect(total).toBeLessThan(15);
  });

  it("a clean draw scores in the middle", () => {
    const total = computeGameCPI(
      game({ cplPerMove: constCpl(8, 40), movesByEngineRank: ranks(30, 6, 0, 40) }),
    ).total;
    expect(total).toBeGreaterThan(45);
    expect(total).toBeLessThan(55);
  });
});

describe("what the score rewards", () => {
  /* The whole point of the index: a player who loses well outscores one who wins badly. */
  it("pays for the quality of the moves, not the result", () => {
    const wellPlayedLoss = computeGameCPI(
      game({ cplPerMove: constCpl(10, 40), movesByEngineRank: ranks(32, 4, 0, 40), result: "l" }),
    ).total;
    const luckyWin = computeGameCPI(
      game({ cplPerMove: constCpl(120, 40), movesByEngineRank: ranks(4, 2, 0, 40), hangs: 2, result: "w" }),
    ).total;
    expect(wellPlayedLoss).toBeGreaterThan(luckyWin);
  });

  it("scores a lower average centipawn loss higher", () => {
    const sharp = computeGameCPI(game({ cplPerMove: constCpl(10, 40) })).total;
    const loose = computeGameCPI(game({ cplPerMove: constCpl(90, 40) })).total;
    expect(sharp).toBeGreaterThan(loose);
  });

  it("stops paying for accuracy once the loss is huge rather than going negative", () => {
    const awful = computeGameCPI(game({ cplPerMove: constCpl(5000, 40) }));
    expect(awful.E).toBe(0);
  });

  it("ranks a win above a draw above a loss, all else equal", () => {
    const at = (result: GameMetrics["result"]) => computeGameCPI(game({ result })).total;
    expect(at("w")).toBeGreaterThan(at("d"));
    expect(at("d")).toBeGreaterThan(at("l"));
  });

  it("charges for every hung piece", () => {
    const one = computeGameCPI(game({ hangs: 1 })).total;
    const two = computeGameCPI(game({ hangs: 2 })).total;
    expect(one - two).toBeCloseTo(DEFAULT_WEIGHTS.H, 1);
  });

  it("pays for a found mate only where there was one to find", () => {
    const found = computeGameCPI(
      game({ mateOpportunities: { m1: 0, m2: 2, m3: 0 }, mateFound: { m1: 0, m2: 2, m3: 0 } }),
    ).M2;
    const nothingToFind = computeGameCPI(game()).M2;
    expect(found).toBeCloseTo(DEFAULT_WEIGHTS.M2, 1);
    expect(nothingToFind).toBe(0);
  });

  it("survives a game with no moves recorded instead of dividing by zero", () => {
    const empty = computeGameCPI(
      game({ cplPerMove: [], timeMsPerMove: [], movesByEngineRank: [] }),
    );
    for (const v of Object.values(empty)) expect(Number.isFinite(v)).toBe(true);
  });

  it("adds its parts up to the total it reports", () => {
    const b = computeGameCPI(
      game({ movesByEngineRank: ranks(10, 5, 3, 40), brilliancies: 1, hangs: 1, result: "w" }),
    );
    const sum = b.E + b.T + b.O + b.B1 + b.B2 + b.B3 + b.M1 + b.M2 + b.M3 - b.H + b.Br + b.R;
    expect(b.total).toBeCloseTo(sum, 1);
  });
});

describe("the running index", () => {
  beforeEach(() => localStorage.clear());

  it("starts every player at the same place", () => {
    expect(ldCPIState().cpi).toBe(1200);
  });

  it("moves by exactly what the game scored", () => {
    const before = ldCPIState().cpi;
    const metrics = game({ result: "w" });
    const delta = computeGameCPI(metrics).total;
    expect(applyGameToCPI(metrics).cpi).toBeCloseTo(before + delta, 1);
  });

  it("keeps a record of each game it counted", () => {
    applyGameToCPI(game({ result: "w" }), "game-1");
    const s = applyGameToCPI(game({ result: "l" }), "game-2");
    expect(s.history.map((h) => h.gameId)).toEqual(["game-1", "game-2"]);
    expect(s.history[1].result).toBe("l");
  });

  /* A run of terrible games subtracts 25 per hung piece with nothing bounding it, so the
     floor is what keeps the index from going negative and reading as nonsense. */
  it("never falls below zero however bad the run", () => {
    for (let i = 0; i < 30; i++) applyGameToCPI(game({ hangs: 6, cplPerMove: constCpl(400, 40), result: "l" }));
    expect(ldCPIState().cpi).toBe(0);
  });

  it("never runs past the top of the scale", () => {
    for (let i = 0; i < 200; i++) {
      applyGameToCPI(game({ cplPerMove: constCpl(0, 40), movesByEngineRank: ranks(40, 0, 0, 40), brilliancies: 3, result: "w" }));
    }
    expect(ldCPIState().cpi).toBe(4000);
  });

  it("reads a corrupted store as a fresh start rather than throwing", () => {
    localStorage.setItem("aevion_cyberchess_cpi_v1", "{not json");
    expect(ldCPIState().cpi).toBe(1200);
  });
});
