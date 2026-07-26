import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { COACH_KNOWLEDGE } from "../coachKnowledge";
import { LESSONS } from "../coachLessons";

/* Each of these positions is loaded onto the board when the player opens the card, and
   `bestMove` is the answer the lesson is teaching. Thirteen of the knowledge positions
   and one lesson exercise shipped with a move that cannot be played there at all — a
   bishop asked to reach a square of the other colour, a rook standing on the square it
   was told to move to, a FEN with nine squares in a rank, two positions with no white
   king. The board would either refuse to load or refuse every answer.

   Nothing about that is visible by reading the file, so it is asserted here. */

type Row = { where: string; fen?: string; bestMove?: string };

const knowledgeRows: Row[] = COACH_KNOWLEDGE.flatMap((cat) =>
  cat.entries.map((e) => ({ where: `${cat.id}/${e.id}`, fen: e.fen, bestMove: e.bestMove })),
);

const lessonRows: Row[] = LESSONS.flatMap((l) =>
  l.steps.map((s, i) => ({ where: `${l.id}[${i}]`, fen: s.fen, bestMove: s.bestMove })),
);

const withFen = [...knowledgeRows, ...lessonRows].filter((r) => r.fen);

describe("coach teaching positions", () => {
  it("ships a good number of them", () => {
    expect(withFen.length).toBeGreaterThan(50);
  });

  it("every position loads on a real board", () => {
    const bad: string[] = [];
    for (const r of withFen) {
      try {
        new Chess(r.fen);
      } catch (e) {
        bad.push(`${r.where}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every taught move can be played in the position it is taught from", () => {
    const bad: string[] = [];
    for (const r of withFen.filter((x) => x.bestMove)) {
      let legal: string[];
      try {
        legal = new Chess(r.fen).moves().map((m) => m.replace(/[+#]/g, ""));
      } catch {
        continue; // already reported by the test above
      }
      if (!legal.includes(r.bestMove!.replace(/[+#!?]/g, ""))) {
        bad.push(`${r.where}: ${r.bestMove}`);
      }
    }
    expect(bad).toEqual([]);
  });

  /* A position with the side to move already delivering check is not a puzzle, it is a
     bug in the setup — the opponent's king would be capturable. chess.js rejects those
     outright, so this only guards the subtler case of a legal-but-nonsensical board. */
  it("never asks the player to move from a finished position", () => {
    const bad: string[] = [];
    for (const r of withFen) {
      let c: Chess;
      try {
        c = new Chess(r.fen);
      } catch {
        continue;
      }
      if (c.isGameOver()) bad.push(`${r.where}: партия уже окончена`);
    }
    expect(bad).toEqual([]);
  });

  it("gives every knowledge entry a unique id inside its category", () => {
    for (const cat of COACH_KNOWLEDGE) {
      const ids = cat.entries.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("lessons", () => {
  it("has unique ids", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* A prerequisite naming a lesson that does not exist would lock the course silently. */
  it("names prerequisites that exist and come earlier", () => {
    const byId = new Map(LESSONS.map((l) => [l.id, l]));
    for (const l of LESSONS) {
      if (!l.prerequisite) continue;
      const prev = byId.get(l.prerequisite);
      expect(prev, `${l.id} требует несуществующий ${l.prerequisite}`).toBeDefined();
      expect(prev!.num).toBeLessThan(l.num);
    }
  });

  it("numbers the lessons without gaps or repeats", () => {
    const nums = LESSONS.map((l) => l.num).sort((a, b) => a - b);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
});
