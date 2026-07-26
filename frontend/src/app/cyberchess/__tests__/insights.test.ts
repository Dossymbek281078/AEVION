import { describe, it, expect } from "vitest";
import { computeInsights, type SavedGame } from "../insights";

/* The dashboard prints these numbers straight to the player. Until now the module
   classified the result string itself, with a second set of substrings that disagreed
   with the shared classifier on the Russian endings — a draw agreed in a live game
   showed up as a loss on one screen and a draw on another. */

let n = 0;
const g = (result: string, over: Partial<SavedGame> = {}): SavedGame => ({
  id: `g${++n}`,
  date: "2026-07-20",
  moves: ["e4", "e5", "Nf3", "Nc6"],
  result,
  playerColor: "w",
  aiLevel: "3",
  rating: 1200,
  tc: "10+0",
  category: "Rapid",
  ...over,
});

const WIN = "Checkmate! You win! 🏆";
const LOSS = "Checkmate — AI wins";
const DRAW = "Stalemate";

describe("computeInsights", () => {
  it("says nothing rather than dividing by zero on an empty history", () => {
    const i = computeInsights([]);
    expect(i.total).toBe(0);
    expect(i.overall.winPct).toBe(0);
    expect(i.bestOpening).toBeNull();
  });

  it("counts wins, losses and draws once each", () => {
    const i = computeInsights([g(WIN), g(WIN), g(LOSS), g(DRAW)]);
    expect(i.overall).toMatchObject({ wins: 2, losses: 1, draws: 1, total: 4 });
    expect(i.overall.winPct).toBe(50);
  });

  /* The three percentages describe the same four games, so they cannot come to more
     than a whole — an earlier winrate elsewhere counted a loss twice and produced a
     negative draw count. */
  it("keeps the three percentages a description of one set of games", () => {
    const i = computeInsights([g(WIN), g(LOSS), g(DRAW), g(LOSS)]);
    expect(i.overall.wins + i.overall.losses + i.overall.draws).toBe(i.overall.total);
    expect(i.overall.winPct + i.overall.lossPct + i.overall.drawPct).toBeLessThanOrEqual(101);
  });

  /* This is the divergence that prompted the change: both endings are Russian, both
     used to fall through to "loss" here while the rest of the app read them correctly. */
  it("reads the Russian endings the way the rest of the app does", () => {
    const i = computeInsights([g("Ничья (договорились)"), g("Соперник сдался — Вы победили!")]);
    expect(i.overall).toMatchObject({ wins: 1, draws: 1, losses: 0 });
  });

  it("splits the record by the colour the player had", () => {
    const i = computeInsights([
      g(WIN, { playerColor: "w" }),
      g(LOSS, { playerColor: "w" }),
      g(WIN, { playerColor: "b" }),
    ]);
    expect(i.asWhite).toMatchObject({ wins: 1, losses: 1 });
    expect(i.asBlack).toMatchObject({ wins: 1, losses: 0 });
  });

  it("splits it by time control", () => {
    const i = computeInsights([
      g(WIN, { category: "Bullet" }),
      g(LOSS, { category: "Blitz" }),
      g(WIN, { category: "Blitz" }),
    ]);
    expect(i.byCategory.Bullet.total).toBe(1);
    expect(i.byCategory.Blitz).toMatchObject({ wins: 1, losses: 1 });
    expect(i.byCategory.Classical.total).toBe(0);
  });

  it("names the opening from the moves when the game did not record one", () => {
    const sicilian = computeInsights([g(WIN, { moves: ["e4", "c5", "Nf3"] })]);
    expect(sicilian.openings[0].name).toContain("Сицилианская");
  });

  it("prefers the opening the game recorded over guessing", () => {
    const i = computeInsights([g(WIN, { opening: "Испанская партия", moves: ["d4", "d5"] })]);
    expect(i.openings[0].name).toBe("Испанская партия");
  });

  it("reports the recent form newest first and no longer than ten", () => {
    const many = Array.from({ length: 14 }, (_, k) => g(k % 2 ? WIN : LOSS));
    const i = computeInsights(many);
    expect(i.recentForm.length).toBeLessThanOrEqual(10);
    for (const c of i.recentForm) expect(["W", "L", "D"]).toContain(c);
  });

  /* saveGame unshifts, so the history arrives newest-first — the module reverses it
     before reading the trend. Passing it the other way round would report the rating
     change with the sign flipped, which is why the order is stated here. */
  it("measures the rating change from the oldest game to the newest", () => {
    const newestFirst = [g(WIN, { rating: 1240 }), g(WIN, { rating: 1200 })];
    expect(computeInsights(newestFirst).ratingDelta).toBe(40);
  });

  it("counts a streak of wins as a streak", () => {
    const i = computeInsights([g(WIN), g(WIN), g(WIN), g(LOSS)]);
    expect(i.streaks.longestWin).toBeGreaterThanOrEqual(3);
  });
});
