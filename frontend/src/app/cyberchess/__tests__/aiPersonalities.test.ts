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

  it("still prefers its best move most of the time", () => {
    const argmax = selectMoveByPersonality(persona, candidates)!;
    let hits = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (selectMoveByPersonality(persona, candidates, {}, Math.random)?.uci === argmax.uci) hits++;
    }
    // Sampling, not chaos: the top pick must still dominate.
    expect(hits / N).toBeGreaterThan(0.34);
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
