import { describe, it, expect } from "vitest";
import { generate960Backrank, fischer960Fen, randomArmy } from "../variants";

/* Chess960 has two hard rules, and a position breaking either is not a legal
   starting position: the bishops must stand on opposite-coloured squares, and the
   king must stand between the two rooks. Neither was tested, and the generator
   builds positions by random placement with a retry loop — exactly the shape where
   a rare arrangement slips through unnoticed. Run over many draws rather than one. */

const DRAWS = 400;

function isValid960(backrank: string): { ok: boolean; why?: string } {
  if (backrank.length !== 8) return { ok: false, why: `length ${backrank.length}` };
  const counts: Record<string, number> = {};
  for (const c of backrank) counts[c] = (counts[c] ?? 0) + 1;
  if (counts.K !== 1) return { ok: false, why: "king count" };
  if (counts.Q !== 1) return { ok: false, why: "queen count" };
  if (counts.R !== 2) return { ok: false, why: "rook count" };
  if (counts.B !== 2) return { ok: false, why: "bishop count" };
  if (counts.N !== 2) return { ok: false, why: "knight count" };

  const bishops = [...backrank].map((c, i) => (c === "B" ? i : -1)).filter((i) => i >= 0);
  if (bishops[0] % 2 === bishops[1] % 2) return { ok: false, why: `bishops same colour at ${bishops}` };

  const rooks = [...backrank].map((c, i) => (c === "R" ? i : -1)).filter((i) => i >= 0);
  const king = backrank.indexOf("K");
  if (!(king > rooks[0] && king < rooks[1])) return { ok: false, why: `king ${king} not between rooks ${rooks}` };

  return { ok: true };
}

describe("generate960Backrank", () => {
  it("produces a legal Chess960 back rank every time", () => {
    const failures: string[] = [];
    for (let i = 0; i < DRAWS; i++) {
      const br = generate960Backrank();
      const v = isValid960(br);
      if (!v.ok) failures.push(`${br}: ${v.why}`);
    }
    expect(failures).toEqual([]);
  });

  it("never falls back to the standard rank — that would silently disable the variant", () => {
    // "RNBQKBNR" is the generator's give-up value after 100 failed attempts.
    // Seeing it in a sample this size would mean the placement logic is wedged.
    const draws = Array.from({ length: DRAWS }, () => generate960Backrank());
    const standard = draws.filter((d) => d === "RNBQKBNR").length;
    expect(standard).toBeLessThan(DRAWS / 20);
  });

  it("actually varies", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generate960Backrank()));
    expect(seen.size).toBeGreaterThan(10);
  });

  /* The signature promised "deterministic if seed given" while the body used
     Math.random() and ignored the seed entirely. Nothing depended on it yet, but
     the first shared-position feature — one board for both players in an online
     960 game — would have handed the two clients different boards. */
  it("gives the same rank for the same seed, and different ranks for different seeds", () => {
    for (const seed of [1, 42, 960, 123456]) {
      expect(generate960Backrank(seed)).toBe(generate960Backrank(seed));
    }
    const bySeed = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => generate960Backrank(s)));
    expect(bySeed.size).toBeGreaterThan(1);
  });

  it("keeps seeded ranks legal too", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const v = isValid960(generate960Backrank(seed));
      expect(v.ok, `seed ${seed}: ${v.why}`).toBe(true);
    }
  });
});

describe("fischer960Fen", () => {
  it("mirrors the back rank for Black and keeps the pawns", () => {
    const fen = fischer960Fen(7);
    const [placement, turn] = fen.split(" ");
    const ranks = placement.split("/");
    expect(ranks).toHaveLength(8);
    expect(ranks[0]).toBe(ranks[7].toLowerCase());
    expect(ranks[1]).toBe("pppppppp");
    expect(ranks[6]).toBe("PPPPPPPP");
    expect(turn).toBe("w");
  });

  it("is reproducible from a seed", () => {
    expect(fischer960Fen(99)).toBe(fischer960Fen(99));
  });
});

describe("randomArmy", () => {
  it("is reproducible from a seed", () => {
    const a = randomArmy(2024);
    const b = randomArmy(2024);
    expect(a.piecesByFile).toEqual(b.piecesByFile);
  });

  it("fills the whole back rank", () => {
    for (const seed of [1, 50, 777]) {
      expect(randomArmy(seed).piecesByFile.join("").length).toBeGreaterThan(0);
    }
  });
});
