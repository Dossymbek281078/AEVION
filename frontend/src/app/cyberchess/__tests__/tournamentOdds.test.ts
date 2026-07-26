import { describe, it, expect } from "vitest";
import { eloP, rollBotMatch, createTournament, finalPlace } from "../tournament";

/* Bot-vs-bot results decide most of a tournament bracket, so a bias here quietly
   rewrites who the player ends up facing and what place they finish in. */

const N = 60_000;

function distribution(eloA: number, eloB: number) {
  const c = { a: 0, b: 0, draw: 0 };
  for (let i = 0; i < N; i++) c[rollBotMatch(eloA, eloB)]++;
  return { a: c.a / N, b: c.b / N, draw: c.draw / N };
}

describe("eloP", () => {
  it("is 50% for equal ratings and symmetric around it", () => {
    expect(eloP(1500, 1500)).toBeCloseTo(0.5, 6);
    expect(eloP(1600, 1400) + eloP(1400, 1600)).toBeCloseTo(1, 6);
  });

  it("gives the classic 400-point gap ≈ 91%", () => {
    expect(eloP(1900, 1500)).toBeCloseTo(0.909, 2);
  });
});

describe("rollBotMatch", () => {
  /* The draw band used to be carved from [0, drawZone), which lies entirely inside
     "a"'s winning range — so "a" lost the whole 5% while "b" kept its share.
     Measured at 45.1% / 50.0% before the fix. The tournament field is sorted by
     rating with the favourite always in slot "a", so the favourite was the one
     being shortchanged and upsets came up more often than the ratings imply. */
  it("does not favour either side when the ratings are equal", () => {
    const d = distribution(1500, 1500);
    expect(Math.abs(d.a - d.b)).toBeLessThan(0.01);
  });

  it("keeps the draw rate near 5% in close matches", () => {
    const d = distribution(1500, 1500);
    expect(d.draw).toBeGreaterThan(0.03);
    expect(d.draw).toBeLessThan(0.07);
  });

  it("tracks the Elo expectation once draws are shared out", () => {
    for (const [ea, eb] of [[1500, 1500], [1600, 1400], [1800, 1500]] as const) {
      const d = distribution(ea, eb);
      const expected = eloP(ea, eb);
      // Draws split evenly between the two sides for scoring purposes.
      const scored = d.a + d.draw / 2;
      expect(Math.abs(scored - expected)).toBeLessThan(0.02);
    }
  });

  it("stops offering draws once one side is a clear favourite", () => {
    // |p − 0.5| ≥ 0.15 is outside the band by design.
    expect(distribution(1800, 1400).draw).toBe(0);
  });

  it("always returns one of the three outcomes", () => {
    for (let i = 0; i < 2000; i++) {
      expect(["a", "b", "draw"]).toContain(rollBotMatch(1200 + i, 1500));
    }
  });
});

describe("createTournament", () => {
  it("builds an eight-player field containing the player", () => {
    const t = createTournament(1500);
    expect(t.field).toHaveLength(8);
    expect(t.field.filter((p) => p.id === "you")).toHaveLength(1);
    expect(t.bracket.qf).toHaveLength(4);
  });

  it("seeds so the top two can only meet in the final", () => {
    // qf[0] and qf[1] feed one semi-final, qf[2] and qf[3] the other.
    const t = createTournament(2000);
    const seedOf = (id: string) => t.field.findIndex((p) => p.id === id);
    const half = (m: { a: string; b: string }, i: number) => (i < 2 ? "top" : "bottom");
    const halves: Record<number, string> = {};
    t.bracket.qf.forEach((m, i) => {
      halves[seedOf(m.a)] = half(m, i);
      halves[seedOf(m.b)] = half(m, i);
    });
    expect(halves[0]).not.toBe(halves[1]);
  });

  it("puts every player in exactly one quarter-final", () => {
    const t = createTournament(1500);
    const ids = t.bracket.qf.flatMap((m) => [m.a, m.b]);
    expect(new Set(ids).size).toBe(8);
  });

  it("marks exactly one quarter-final as needing the player", () => {
    const t = createTournament(1500);
    expect(t.bracket.qf.filter((m) => m.needsPlayer)).toHaveLength(1);
  });
});

describe("finalPlace", () => {
  it("returns nothing while the tournament is still running", () => {
    expect(finalPlace(createTournament(1500))).toBeNull();
  });
});
