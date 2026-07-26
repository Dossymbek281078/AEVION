import { describe, it, expect } from "vitest";
import {
  AI_PERSONALITIES,
  findPersonality,
  selectMoveByPersonality,
  DEFAULT_PERSONALITY_ID,
} from "../aiPersonalities";

/* selectMoveByPersonality has two modes and the difference is the whole feature:
   without a random source it returns the argmax, with one it samples a softmax whose
   temperature comes from the personality's timeUsage — a fast, intuitive opponent is
   supposed to vary more than a deep thinker. The production call site omitted the
   random source, so every personality answered a given position with the same move
   forever and a rematch replayed the same game. */

const candidates = [
  { uci: "e2e4", signals: { cp: 30, mate: 0 } },
  { uci: "d2d4", signals: { cp: 25, mate: 0 } },
  { uci: "g1f3", signals: { cp: 20, mate: 0 } },
];

describe("AI_PERSONALITIES", () => {
  it("has unique ids", () => {
    const ids = AI_PERSONALITIES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(1);
  });

  /* "standard" is a sentinel meaning "no personality", not a list entry — the game
     loop checks `id !== "standard"` before looking anything up. findPersonality
     returning null for it is the contract, not a missing record. */
  it("treats the default id as no-personality rather than an entry", () => {
    expect(AI_PERSONALITIES.map((p) => p.id)).not.toContain(DEFAULT_PERSONALITY_ID);
    expect(findPersonality(DEFAULT_PERSONALITY_ID)).toBeNull();
  });

  it("returns null for an unknown or missing id rather than a wrong personality", () => {
    expect(findPersonality("no-such-personality")).toBeNull();
    expect(findPersonality(null)).toBeNull();
    expect(findPersonality(undefined)).toBeNull();
  });

  it("keeps every style weight in range — they feed a softmax temperature", () => {
    for (const p of AI_PERSONALITIES) {
      expect(p.style.timeUsage).toBeGreaterThanOrEqual(0);
      expect(p.style.timeUsage).toBeLessThanOrEqual(1);
    }
  });
});

describe("selectMoveByPersonality", () => {
  const persona = AI_PERSONALITIES.find((p) => p.id !== DEFAULT_PERSONALITY_ID) ?? AI_PERSONALITIES[0];

  it("handles the degenerate inputs", () => {
    expect(selectMoveByPersonality(persona, [])).toBeNull();
    expect(selectMoveByPersonality(persona, [candidates[0]])).toBe(candidates[0]);
  });

  it("is deterministic without a random source", () => {
    const first = selectMoveByPersonality(persona, candidates);
    for (let i = 0; i < 20; i++) {
      expect(selectMoveByPersonality(persona, candidates)).toBe(first);
    }
  });

  it("varies once a random source is supplied — this is what the call site was missing", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const picked = selectMoveByPersonality(persona, candidates, {}, Math.random);
      if (picked) seen.add(picked.uci);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  /* Seeded, so the assertion is on the sampler and not on the luck of a particular run.
     An earlier version drew from Math.random over 1000 tries and asserted a rate barely
     below the true one — it failed roughly one run in four, which is a broken test rather
     than a broken sampler. */
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const share = (moves: typeof candidates, seed = 12345, n = 20000) => {
    const rnd = seeded(seed);
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const m = selectMoveByPersonality(persona, moves, {}, rnd);
      if (m) count[m.uci] = (count[m.uci] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / n]));
  };

  it("picks the stronger move more often than the weaker one", () => {
    const s = share(candidates);
    expect(s["e2e4"]).toBeGreaterThan(s["d2d4"]);
    expect(s["d2d4"]).toBeGreaterThan(s["g1f3"]);
  });

  /* Moves five centipawns apart are near enough to equal that the split stays close —
     that is the point of the temperature. A move three pawns worse is a different
     matter and has to be rare, or the personality is just noise. */
  it("nearly never plays a move that is much worse", () => {
    const s = share([
      { uci: "e2e4", signals: { cp: 30, mate: 0 } },
      { uci: "b1a3", signals: { cp: -300, mate: 0 } },
    ]);
    expect(s["e2e4"]).toBeGreaterThan(0.9);
    expect(s["b1a3"] ?? 0).toBeLessThan(0.1);
  });

  it("only ever returns a move it was given", () => {
    const allowed = candidates.map((c) => c.uci);
    for (let i = 0; i < 300; i++) {
      const picked = selectMoveByPersonality(persona, candidates, {}, Math.random);
      expect(allowed).toContain(picked!.uci);
    }
  });

  it("gives every personality a usable selection for the same position", () => {
    for (const p of AI_PERSONALITIES) {
      const picked = selectMoveByPersonality(p, candidates, { ply: 10 }, Math.random);
      expect(picked).not.toBeNull();
      expect(candidates.map((c) => c.uci)).toContain(picked!.uci);
    }
  });
});
