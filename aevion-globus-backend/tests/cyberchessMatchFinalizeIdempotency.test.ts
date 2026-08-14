import { describe, test, expect, beforeEach, vi } from "vitest";

// finalizeMatch — paying for a game exactly once. 2026-08-12.
//
// Closing a network game hands out Glicko rating changes and Chessy (10 for a
// win, 3 for a draw, 1 for having played). It guards against paying twice by
// checking whether the match row is already `status='ended'` — and that mark
// was written LAST, after the rating and after both wallet credits.
//
// No crash is needed to fall through the gap. Every query goes through a
// wrapper that catches the error, logs a warning and returns an empty array, so
// one ordinary failure on that final UPDATE is enough: the function returns as
// if it succeeded, both players are already paid, and the row stays open. The
// retry is routine — both clients report the end of a game, and the in-process
// guard that separates them is wiped by a restart, which is exactly when
// retries arrive.
//
// The store drives Postgres through one thin wrapper, so these tests replace
// the driver and watch what is actually sent.

const { queries, failOn, state } = vi.hoisted(() => ({
  queries: [] as { text: string; params: unknown[] }[],
  failOn: { pattern: null as RegExp | null },
  state: { ended: false },
}));

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      queries.push({ text, params });
      if (failOn.pattern && failOn.pattern.test(text)) {
        throw new Error("connection reset by peer");
      }
      if (/SELECT\s+"status"/i.test(text)) {
        return {
          rows: [
            {
              status: state.ended ? "ended" : "live",
              whiteRatingBefore: 1500,
              blackRatingBefore: 1500,
              whiteRatingAfter: 1510,
              blackRatingAfter: 1490,
            },
          ],
        };
      }
      if (/UPDATE\s+"CyberMatch"/i.test(text) && /"status"\s*=\s*'ended'/i.test(text)) {
        // A conditional claim only wins when the row is not ended yet; an
        // unconditional write always "succeeds". Modelled so the test can tell
        // the two implementations apart.
        const conditional = /"status"\s*<>\s*'ended'/i.test(text);
        if (conditional && state.ended) return { rows: [], rowCount: 0 };
        state.ended = true;
        // RETURNING "id": захват узнаётся по наличию строки, потому что
        // обёртка q() отдаёт только rows и теряет rowCount.
        return { rows: [{ id: "claimed" }], rowCount: 1 };
      }
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import { finalizeMatch } from "../src/routes/cyberchessMatchStore";

const INFO = {
  whiteUserId: "white-player",
  blackUserId: "black-player",
  whiteName: "White",
  blackName: "Black",
  timeControl: "300+5",
  result: "white" as const,
  termination: "checkmate",
};

const credits = () => queries.filter((q) => /INSERT INTO "CyberWallet"/i.test(q.text));

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  queries.length = 0;
  failOn.pattern = null;
  state.ended = false;
});

describe("the driver really is the one under test", () => {
  test("queries reach the stand-in", async () => {
    // Guards the whole file: under `require("pg")` the mock never engaged and
    // every assertion below passed for the wrong reason.
    await finalizeMatch("m-0", INFO);
    expect(queries.length).toBeGreaterThan(0);
  });
});

describe("a game is paid for once", () => {
  test("a normal finalize credits both players", async () => {
    await finalizeMatch("m-1", INFO);
    expect(credits()).toHaveLength(2);
  });

  test("a repeat after a successful finalize pays nothing more", async () => {
    await finalizeMatch("m-2", INFO);
    const after = credits().length;

    await finalizeMatch("m-2", INFO);

    expect(credits()).toHaveLength(after);
  });

  test("a failed write plus the routine retry still pays exactly once", async () => {
    // The case the old ordering got wrong. One ordinary query failure, then the
    // other client's report arrives — the invariant is the total: two credits
    // across the whole episode, one per player, no matter which attempt landed.
    failOn.pattern = /UPDATE "CyberMatch"/i;
    await finalizeMatch("m-3", INFO);

    failOn.pattern = null;
    await finalizeMatch("m-3", INFO);

    expect(credits()).toHaveLength(2);
  });

  test("a failure while claiming pays nobody", async () => {
    // Claiming first means a failure there costs nothing: the money has not
    // moved yet. Under the old order the same failure came after both credits.
    failOn.pattern = /UPDATE "CyberMatch"/i;
    await finalizeMatch("m-6", INFO);

    expect(credits()).toHaveLength(0);
  });

  test("the row is claimed before any money moves", async () => {
    // The ordering that makes the case above true.
    await finalizeMatch("m-4", INFO);

    const claimAt = queries.findIndex(
      (q) => /UPDATE "CyberMatch"/i.test(q.text) && /"status"\s*=\s*'ended'/i.test(q.text),
    );
    const firstCreditAt = queries.findIndex((q) => /INSERT INTO "CyberWallet"/i.test(q.text));

    expect(claimAt).toBeGreaterThanOrEqual(0);
    expect(firstCreditAt).toBeGreaterThanOrEqual(0);
    expect(claimAt).toBeLessThan(firstCreditAt);
  });

  test("the claim is conditional, so two callers cannot both win it", async () => {
    await finalizeMatch("m-5", INFO);
    const claim = queries.find(
      (q) => /UPDATE "CyberMatch"/i.test(q.text) && /"status"\s*=\s*'ended'/i.test(q.text),
    );
    expect(claim?.text).toMatch(/"status"\s*<>\s*'ended'/i);
  });
});
