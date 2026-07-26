import { describe, it, expect, beforeEach } from "vitest";
import { Chess } from "chess.js";
import {
  BRILLIANCIES,
  applyGuess,
  showHint,
  giveUp,
  hintFor,
  personalStats,
  todayHunt,
  type BrilliancyState,
} from "../brilliancy";

/* The hunt is a curated position with one right answer typed in by hand, so a wrong FEN
   or a solution that is not legal in it would make the puzzle unsolvable with no way for
   the player to tell. Checked against a real board rather than trusted. */

const freshState = (over: Partial<BrilliancyState> = {}): BrilliancyState => ({
  v: 1,
  date: "2026-7-26",
  idx: 0,
  attempts: 0,
  solved: false,
  hintShown: false,
  givenUp: false,
  history: [],
  streak: 0,
  bestStreak: 0,
  ...over,
});

beforeEach(() => localStorage.clear());

describe("the curated positions", () => {
  it("ships some", () => {
    expect(BRILLIANCIES.length).toBeGreaterThan(0);
  });

  it("gives every hunt a distinct id", () => {
    const ids = BRILLIANCIES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sets up a legal position with the stated side to move", () => {
    const bad: string[] = [];
    for (const h of BRILLIANCIES) {
      try {
        const c = new Chess(h.fen);
        if (c.turn() !== h.side) bad.push(`${h.id}: ходит ${c.turn()}, заявлено ${h.side}`);
      } catch {
        bad.push(`${h.id}: FEN не читается`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("has a solution that is actually playable in the position", () => {
    const bad: string[] = [];
    for (const h of BRILLIANCIES) {
      const c = new Chess(h.fen);
      const legal = c.moves();
      const stripped = legal.map((m) => m.replace(/[+#]/g, ""));
      if (!stripped.includes(h.solutionSan.replace(/[+#]/g, ""))) {
        bad.push(`${h.id}: ${h.solutionSan} нет среди легальных`);
      }
    }
    expect(bad).toEqual([]);
  });

  /* A hunt written as "#" claims mate. If it is not mate, the player who finds the real
     mate is told they are wrong. */
  it("delivers the mate where the notation claims one", () => {
    const bad: string[] = [];
    for (const h of BRILLIANCIES.filter((x) => x.solutionSan.includes("#"))) {
      const c = new Chess(h.fen);
      c.move(h.solutionSan.replace(/[+#]/g, ""));
      if (!c.isCheckmate()) bad.push(`${h.id}: ${h.solutionSan} — не мат`);
    }
    expect(bad).toEqual([]);
  });

  it("keeps difficulty inside the scale the reward table pays for", () => {
    for (const h of BRILLIANCIES) expect([1, 2, 3, 4, 5]).toContain(h.difficulty);
  });
});

describe("applyGuess", () => {
  const hunt = BRILLIANCIES[0];

  it("accepts the solution written without the check or mate symbol", () => {
    const r = applyGuess(hunt, freshState(), hunt.solutionSan.replace(/[+#]/g, ""));
    expect(r.correct).toBe(true);
  });

  it("accepts it with the symbol too", () => {
    expect(applyGuess(hunt, freshState(), hunt.solutionSan).correct).toBe(true);
  });

  it("counts the try whether or not it was right", () => {
    expect(applyGuess(hunt, freshState(), "e4").state.attempts).toBe(1);
  });

  it("pays more for finding it first try than after several", () => {
    const first = applyGuess(hunt, freshState(), hunt.solutionSan).reward;
    const later = applyGuess(hunt, freshState({ attempts: 5 }), hunt.solutionSan).reward;
    expect(first).toBeGreaterThan(later);
  });

  it("pays less when the hint was taken", () => {
    const clean = applyGuess(hunt, freshState(), hunt.solutionSan).reward;
    const hinted = applyGuess(hunt, freshState({ hintShown: true }), hunt.solutionSan).reward;
    expect(hinted).toBeLessThan(clean);
    expect(hinted).toBeGreaterThan(0);
  });

  it("pays nothing for a wrong move", () => {
    expect(applyGuess(hunt, freshState(), "a3").reward).toBe(0);
  });

  /* Without this the player could keep typing the same right answer and be paid for it
     every time — the streak and the Chessy would both come free. */
  it("cannot be solved twice", () => {
    const once = applyGuess(hunt, freshState(), hunt.solutionSan);
    const twice = applyGuess(hunt, once.state, hunt.solutionSan);
    expect(twice.reward).toBe(0);
    expect(twice.state.attempts).toBe(once.state.attempts);
  });

  it("cannot be solved after giving up", () => {
    const quit = giveUp(hunt, freshState());
    expect(applyGuess(hunt, quit, hunt.solutionSan).reward).toBe(0);
  });

  it("extends the streak and records the best one reached", () => {
    const r = applyGuess(hunt, freshState({ streak: 4, bestStreak: 4 }), hunt.solutionSan);
    expect(r.state.streak).toBe(5);
    expect(r.state.bestStreak).toBe(5);
  });

  it("writes the finished hunt into the history once", () => {
    const r = applyGuess(hunt, freshState(), hunt.solutionSan);
    expect(r.state.history).toHaveLength(1);
    expect(r.state.history[0]).toMatchObject({ solved: true, attempts: 1 });
  });
});

describe("giveUp", () => {
  const hunt = BRILLIANCIES[0];

  it("breaks the streak and keeps the best one", () => {
    const s = giveUp(hunt, freshState({ streak: 6, bestStreak: 9 }));
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(9);
  });

  it("records the hunt as unsolved", () => {
    const s = giveUp(hunt, freshState({ attempts: 3 }));
    expect(s.history[0]).toMatchObject({ solved: false, attempts: 3 });
  });

  it("does nothing once the hunt is already solved", () => {
    const solved = applyGuess(hunt, freshState(), hunt.solutionSan).state;
    expect(giveUp(hunt, solved)).toBe(solved);
  });
});

describe("hintFor", () => {
  it("names the piece without naming the square it goes to", () => {
    for (const h of BRILLIANCIES) {
      const hint = hintFor(h);
      expect(hint.length).toBeGreaterThan(0);
      const dest = h.solutionSan.replace(/[+#]/g, "").slice(-2);
      if (/^[a-h][1-8]$/.test(dest)) expect(hint).not.toContain(dest);
    }
  });

  it("says which castling it is", () => {
    expect(hintFor({ ...BRILLIANCIES[0], solutionSan: "O-O" })).toContain("Короткая");
    expect(hintFor({ ...BRILLIANCIES[0], solutionSan: "O-O-O" })).toContain("Длинная");
  });

  it("marks it as taken so the reward is cut", () => {
    expect(showHint(BRILLIANCIES[0], freshState()).hintShown).toBe(true);
  });
});

/* This panel used to display invented community figures — a player count and a solve
   rate generated from the date, sitting next to the player's real streak. There is no
   server collecting hunt results, so it now counts what the player actually did. */
describe("personalStats", () => {
  it("shows nothing to average before the first hunt is finished", () => {
    const s = personalStats(freshState());
    expect(s).toMatchObject({ played: 0, solved: 0, solveRate: null, avgAttempts: null });
  });

  it("counts a finished hunt exactly once", () => {
    const solved = applyGuess(BRILLIANCIES[0], freshState(), BRILLIANCIES[0].solutionSan).state;
    expect(personalStats(solved).played).toBe(1);
    expect(personalStats(solved).solved).toBe(1);
  });

  it("reports the solve rate as a percentage of hunts played", () => {
    const s = personalStats(
      freshState({
        history: [
          { date: "a", idx: 0, solved: true, attempts: 2 },
          { date: "b", idx: 1, solved: false, attempts: 5 },
          { date: "c", idx: 2, solved: true, attempts: 4 },
          { date: "d", idx: 3, solved: false, attempts: 1 },
        ],
      }),
    );
    expect(s).toMatchObject({ played: 4, solved: 2, solveRate: 50, avgAttempts: 3 });
  });

  /* Attempts on a hunt that was abandoned measure when the player quit, not how hard
     the position was, so they do not belong in the average. */
  it("averages tries over solved hunts only", () => {
    const s = personalStats(
      freshState({
        history: [
          { date: "a", idx: 0, solved: true, attempts: 2 },
          { date: "b", idx: 1, solved: false, attempts: 40 },
        ],
      }),
    );
    expect(s.avgAttempts).toBe(2);
  });
});

describe("todayHunt", () => {
  it("hands out the same hunt for the same day", () => {
    const a = todayHunt();
    const b = todayHunt();
    expect(b.hunt.id).toBe(a.hunt.id);
    expect(b.isNew).toBe(false);
  });

  it("carries the streak and history forward into a new day", () => {
    const stale = freshState({
      date: "2000-1-1",
      solved: true,
      streak: 3,
      bestStreak: 3,
      history: [{ date: "2000-1-1", idx: 0, solved: true, attempts: 1 }],
    });
    localStorage.setItem("aevion_brilliancy_v1", JSON.stringify(stale));
    const { state } = todayHunt();
    expect(state.history).toHaveLength(1);
    expect(state.bestStreak).toBe(3);
    expect(state.solved).toBe(false);
  });
});
