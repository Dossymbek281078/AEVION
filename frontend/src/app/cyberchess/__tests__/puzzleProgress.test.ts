import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fenKey, loadSolved, isRewarded, claimReward } from "../puzzleProgress";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

beforeEach(() => localStorage.clear());

describe("fenKey", () => {
  it("is stable for the same position and differs across positions", () => {
    expect(fenKey(START)).toBe(fenKey(START));
    expect(fenKey(START)).not.toBe(fenKey("8/8/8/8/8/8/8/K6k w - - 0 1"));
  });

  it("is short — the whole corpus has to fit in localStorage", () => {
    expect(fenKey(START).length).toBeLessThanOrEqual(7);
  });
});

describe("claimReward", () => {
  it("pays the first solve and refuses the second", () => {
    const set = new Set<string>();
    expect(claimReward(set, START)).toBe(true);
    expect(claimReward(set, START)).toBe(false);
    expect(claimReward(set, START)).toBe(false);
  });

  it("treats different positions independently", () => {
    const set = new Set<string>();
    expect(claimReward(set, START)).toBe(true);
    expect(claimReward(set, "8/8/8/8/8/8/8/K6k w - - 0 1")).toBe(true);
  });

  it("survives a reload — this is the whole point", () => {
    claimReward(new Set<string>(), START);
    // Fresh session, state rebuilt from storage.
    const reloaded = loadSolved();
    expect(isRewarded(reloaded, START)).toBe(true);
    expect(claimReward(reloaded, START)).toBe(false);
  });

  it("degrades to repeatable rewards rather than crashing if storage is unavailable", () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceeded"); };
    try {
      const set = new Set<string>();
      expect(() => claimReward(set, START)).not.toThrow();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("ignores corrupted storage instead of throwing", () => {
    localStorage.setItem("aevion_pz_solved_v1", "{not json");
    expect(loadSolved().size).toBe(0);
    localStorage.setItem("aevion_pz_solved_v1", '{"not":"an array"}');
    expect(loadSolved().size).toBe(0);
  });

  /* Real data: hash collisions across the shipped corpus would silently deny a
     player the reward for a puzzle they had never solved. */
  it("has no collisions across the whole shipped puzzle corpus", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{ fen: string }>;
    const fens = new Set(puzzles.map((p) => p.fen));
    const keys = new Set([...fens].map(fenKey));
    expect(keys.size).toBe(fens.size);
  });
});
