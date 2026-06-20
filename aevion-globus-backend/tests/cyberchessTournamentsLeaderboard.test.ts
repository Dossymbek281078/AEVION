import { describe, test, expect } from "vitest";

/**
 * Tests for the cross-tournament leaderboard added to the CyberChess
 * tournaments router. Exercises the pure aggregator in isolation and
 * verifies the /leaderboard route is wired BEFORE /:id (otherwise the
 * literal "leaderboard" would be captured as a tournament id).
 */

import tournamentsRouter, {
  computeCrossTournamentLeaderboard,
  type Tournament,
  type BracketMatch,
} from "../src/routes/cyberchessTournaments";

function mkMatch(p: Partial<BracketMatch> & { id: string; round: number }): BracketMatch {
  return {
    white: null,
    black: null,
    whiteScore: null,
    blackScore: null,
    status: "scheduled",
    ...p,
  };
}

function baseTournament(p: Partial<Tournament> & { id: string }): Tournament {
  return {
    title: p.id,
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1000,
    eloMax: 3000,
    players: 0,
    maxPlayers: 8,
    prizeChessy: 0,
    status: "finished",
    startsAt: "2026-01-01T00:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    ...p,
  };
}

describe("computeCrossTournamentLeaderboard", () => {
  test("empty input → empty leaderboard", () => {
    expect(computeCrossTournamentLeaderboard([])).toEqual([]);
  });

  test("single-elimination: champion, runner-up and semifinal losers ranked", () => {
    // SF: Alice beat Carl, Bob beat Dina. Final: Alice beat Bob.
    const elim = baseTournament({
      id: "cup",
      rounds: [
        {
          name: "1/2",
          round: 1,
          matches: [
            mkMatch({ id: "sf1", round: 1, white: "Alice", black: "Carl", status: "done", winner: "white" }),
            mkMatch({ id: "sf2", round: 1, white: "Bob", black: "Dina", status: "done", winner: "white" }),
          ],
        },
        {
          name: "Финал",
          round: 2,
          matches: [
            mkMatch({ id: "f1", round: 2, white: "Alice", black: "Bob", status: "done", winner: "white" }),
          ],
        },
      ],
    });

    const lb = computeCrossTournamentLeaderboard([elim]);
    const byName = Object.fromEntries(lb.map((e) => [e.player, e]));

    expect(byName["Alice"]).toMatchObject({ tournaments: 1, wins: 1, podiums: 1, points: 11 });
    expect(byName["Bob"]).toMatchObject({ tournaments: 1, wins: 0, podiums: 1, points: 6 });
    expect(byName["Carl"]).toMatchObject({ wins: 0, podiums: 1 });
    expect(byName["Dina"]).toMatchObject({ wins: 0, podiums: 1 });
    // Champion sorts first on points.
    expect(lb[0].player).toBe("Alice");
  });

  test("unfinished single-elim (final still scheduled) contributes nothing", () => {
    const pending = baseTournament({
      id: "pending-cup",
      status: "live",
      rounds: [
        { name: "1/2", round: 1, matches: [mkMatch({ id: "sf1", round: 1, white: "X", black: "Y" })] },
        { name: "Финал", round: 2, matches: [mkMatch({ id: "f1", round: 2 })] },
      ],
    });
    expect(computeCrossTournamentLeaderboard([pending])).toEqual([]);
  });

  test("swiss standings only count once a game has been played", () => {
    const unplayed = baseTournament({
      id: "swiss-fresh",
      format: "swiss",
      roster: [
        { id: "a", name: "Ann", rating: 2000, score: 0, buchholz: 0, whiteCount: 0, blackCount: 0, opponentIds: [] },
        { id: "b", name: "Ben", rating: 1900, score: 0, buchholz: 0, whiteCount: 0, blackCount: 0, opponentIds: [] },
      ],
    });
    expect(computeCrossTournamentLeaderboard([unplayed])).toEqual([]);

    const played = baseTournament({
      id: "swiss-played",
      format: "swiss",
      roster: [
        { id: "a", name: "Ann", rating: 2000, score: 1, buchholz: 0, whiteCount: 1, blackCount: 0, opponentIds: ["b"] },
        { id: "b", name: "Ben", rating: 1900, score: 0, buchholz: 1, whiteCount: 0, blackCount: 1, opponentIds: ["a"] },
      ],
    });
    const lb = computeCrossTournamentLeaderboard([played]);
    expect(lb[0].player).toBe("Ann");
    expect(lb[0].wins).toBe(1);
  });
});

describe("tournaments router wiring", () => {
  test("/leaderboard route is registered before /:id", () => {
    const stack = (tournamentsRouter as any).stack as Array<{ route?: { path?: string } }>;
    const paths = stack.filter((l) => l.route?.path).map((l) => l.route!.path);
    expect(paths).toContain("/leaderboard");
    const lbIdx = paths.indexOf("/leaderboard");
    const idIdx = paths.indexOf("/:id");
    expect(lbIdx).toBeGreaterThanOrEqual(0);
    expect(idIdx).toBeGreaterThanOrEqual(0);
    expect(lbIdx).toBeLessThan(idIdx);
  });
});
