import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { stableStringify } from "../src/lib/stableStringify";
// Imported statically, not via `await import()` inside makeApp(): the first
// cold import of this router does not fit the 10s per-test timeout, so the
// first test failed on load time rather than on behaviour (once in eight runs
// here, reliably in a full suite). Same cure as checkoutZeroPrice. The hoisted
// vi.mock calls below still apply.
import { cyberchessRouter } from "../src/routes/cyberchess";

// CyberChess tournament prize webhook — first tests, 2026-08-12.
//
// This endpoint moves money (AEC credit) into a winner's QTrade account and
// had no coverage at all. The defect it shipped with is the "answers 2xx while
// doing the wrong thing" kind: when the credit call failed, the prize was
// recorded anyway with transferId null and the response was 201. Senders act
// on the status, so no retry followed — while /ecosystem and the bank's
// ChessWinnings listed the prize as awarded. The winner was never paid and
// nothing anywhere said so.
//
// The podium is a batch, so the fix has to be per-spot: the spots that were
// credited stay recorded (the dedup makes the retry skip them), only the
// failed spot is left un-recorded and the whole delivery answers 502.

const SECRET = "test-chess-webhook-secret";

const { mockCredit } = vi.hoisted(() => ({ mockCredit: vi.fn() }));

vi.mock("../src/routes/qtrade", () => ({
  internalCreditAccount: mockCredit,
}));

const { prizes, mockPersist } = vi.hoisted(() => ({
  prizes: [] as any[],
  mockPersist: vi.fn(),
}));

vi.mock("../src/routes/ecosystem", () => ({
  ensureEcosystemLoaded: vi.fn().mockResolvedValue(undefined),
  chessPrizes: prizes,
  scheduleEcosystemPersist: mockPersist,
}));

const { mockFinalize } = vi.hoisted(() => ({ mockFinalize: vi.fn() }));

vi.mock("../src/lib/ecosystemStore", () => ({
  loadTournaments: vi.fn().mockResolvedValue([]),
  saveTournament: vi.fn().mockResolvedValue(undefined),
  markTournamentFinalized: mockFinalize,
}));

function sign(body: unknown, timestamp: string): string {
  // The receiver signs stableStringify(body) — sorted keys, the same
  // convention QSign uses — so the test has to sign the same bytes.
  const raw = `${timestamp}.${stableStringify(body)}`;
  return crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/cyberchess", cyberchessRouter);
  return app;
}

function post(app: express.Express, body: Record<string, unknown>) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return request(app)
    .post("/api/cyberchess/tournament-finalized")
    .set("x-aevion-timestamp", timestamp)
    .set("x-aevion-signature", sign(body, timestamp))
    .send(body);
}

const event = (over: Record<string, unknown> = {}) => ({
  tournamentId: "t-spring-open",
  podium: [{ email: "winner@example.com", place: 1, amount: 250 }],
  ...over,
});

beforeEach(() => {
  process.env.CYBERCHESS_WEBHOOK_SECRET = SECRET;
  prizes.length = 0;
  mockPersist.mockReset();
  mockFinalize.mockReset();
  mockFinalize.mockResolvedValue(undefined);
  mockCredit.mockReset();
  let n = 0;
  mockCredit.mockImplementation(async () => {
    n += 1;
    return { ok: true, accountId: `acc_${n}`, operationId: `op_${n}`, balance: 250 };
  });
});

afterEach(() => {
  delete process.env.CYBERCHESS_WEBHOOK_SECRET;
  vi.resetModules();
});

describe("a podium spot is paid exactly once", () => {
  test("first delivery credits and records", async () => {
    const app = makeApp();
    const res = await post(app, event());

    expect(res.status).toBe(201);
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(res.body.recorded).toHaveLength(1);
    expect(res.body.recorded[0].transferId).toBe("op_1");
    expect(prizes).toHaveLength(1);
    expect(mockPersist).toHaveBeenCalled();
  });

  test("a repeat delivery does not credit again", async () => {
    const app = makeApp();
    await post(app, event());
    const res = await post(app, event());

    expect(res.status).toBe(201);
    expect(res.body.replayed).toHaveLength(1);
    expect(res.body.recorded).toHaveLength(0);
    expect(mockCredit).toHaveBeenCalledTimes(1);
    expect(prizes).toHaveLength(1);
  });

  test("a repeat survives a restart, because the dedup reads stored prizes", async () => {
    // The state after a restart: nothing in this process has seen the event,
    // the only trace is the prize row ensureEcosystemLoaded() reloads from
    // storage. A dedup kept in process memory would miss it and pay twice —
    // that is how the Planet payout webhook double-credited.
    prizes.push({
      id: "prize_from_before_the_restart",
      email: "winner@example.com",
      tournamentId: "t-spring-open",
      place: 1,
      amount: 250,
      finalizedAt: new Date(Date.now() - 3600_000).toISOString(),
      transferId: "op_before",
      source: "cyberchess",
    });

    const app = makeApp();
    const res = await post(app, event());

    expect(res.status).toBe(201);
    expect(res.body.replayed).toEqual([
      { id: "prize_from_before_the_restart", email: "winner@example.com", place: 1 },
    ]);
    expect(mockCredit).not.toHaveBeenCalled();
    expect(prizes).toHaveLength(1);
  });

  test("email case does not create a second payout", async () => {
    const app = makeApp();
    await post(app, event());
    const res = await post(
      app,
      event({ podium: [{ email: "WINNER@Example.com", place: 1, amount: 250 }] }),
    );

    expect(res.body.replayed).toHaveLength(1);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });
});

describe("a credit that did not go through is not reported as paid", () => {
  test("failed credit records nothing and answers 502", async () => {
    mockCredit.mockResolvedValue({ ok: false, error: "ledger unavailable" });
    const app = makeApp();
    const res = await post(app, event());

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("credit_failed");
    expect(res.body.failed).toEqual([
      { email: "winner@example.com", place: 1, reason: "ledger unavailable" },
    ]);
    expect(res.body.recorded).toHaveLength(0);
    // Nothing recorded: /ecosystem must not show a prize nobody received.
    expect(prizes).toHaveLength(0);
  });

  test("the retry after a failed credit pays exactly once", async () => {
    mockCredit.mockResolvedValueOnce({ ok: false, error: "ledger unavailable" });
    const app = makeApp();

    const first = await post(app, event());
    expect(first.status).toBe(502);

    const retry = await post(app, event());
    expect(retry.status).toBe(201);
    expect(retry.body.recorded).toHaveLength(1);
    expect(retry.body.recorded[0].transferId).toBe("op_1");
    expect(prizes).toHaveLength(1);
  });

  test("a credit that throws is treated as a failure, not as success", async () => {
    mockCredit.mockRejectedValue(new Error("socket hang up"));
    const app = makeApp();
    const res = await post(app, event());

    expect(res.status).toBe(502);
    expect(res.body.failed[0].reason).toBe("socket hang up");
    expect(prizes).toHaveLength(0);
  });

  test("one failed spot does not cancel the spots that were paid", async () => {
    // Second place fails; first and third go through.
    mockCredit
      .mockResolvedValueOnce({ ok: true, accountId: "acc_1", operationId: "op_1", balance: 250 })
      .mockResolvedValueOnce({ ok: false, error: "ledger unavailable" })
      .mockResolvedValueOnce({ ok: true, accountId: "acc_3", operationId: "op_3", balance: 50 });

    const app = makeApp();
    const podium = [
      { email: "first@example.com", place: 1, amount: 250 },
      { email: "second@example.com", place: 2, amount: 100 },
      { email: "third@example.com", place: 3, amount: 50 },
    ];
    const res = await post(app, event({ podium }));

    expect(res.status).toBe(502);
    expect(res.body.recorded.map((r: any) => r.place)).toEqual([1, 3]);
    expect(res.body.failed.map((f: any) => f.place)).toEqual([2]);
    expect(prizes).toHaveLength(2);
    // The paid spots must be on disk before the sender is told anything —
    // otherwise a restart loses the record while the credit itself survives,
    // and the retry pays them a second time.
    expect(mockPersist).toHaveBeenCalled();

    // The retry pays only the spot that failed.
    mockCredit.mockResolvedValue({ ok: true, accountId: "acc_2", operationId: "op_2", balance: 100 });
    const retry = await post(app, event({ podium }));
    expect(retry.status).toBe(201);
    expect(retry.body.recorded.map((r: any) => r.place)).toEqual([2]);
    expect(retry.body.replayed.map((r: any) => r.place)).toEqual([1, 3]);
    expect(prizes).toHaveLength(3);
  });
});

describe("an entry that cannot be read is reported, not dropped in silence", () => {
  test("a malformed spot is listed in skipped", async () => {
    const app = makeApp();
    const res = await post(
      app,
      event({
        podium: [
          { email: "winner@example.com", place: 1, amount: 250 },
          { place: 2, amount: 100 },
        ],
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body.recorded).toHaveLength(1);
    expect(res.body.skipped).toEqual([
      { place: 2, reason: "email (string) and place (number) required" },
    ]);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });

  test("a non-positive amount is listed in skipped and never reaches the ledger", async () => {
    const app = makeApp();
    const res = await post(
      app,
      event({ podium: [{ email: "winner@example.com", place: 1, amount: 0 }] }),
    );

    expect(res.status).toBe(201);
    expect(res.body.skipped).toEqual([
      { place: 1, reason: "amount must be a positive number" },
    ]);
    expect(mockCredit).not.toHaveBeenCalled();
    expect(prizes).toHaveLength(0);
  });
});

describe("the ledger is not reachable without a valid signature", () => {
  test("a wrong signature is rejected before any credit", async () => {
    const app = makeApp();
    const body = event();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const res = await request(app)
      .post("/api/cyberchess/tournament-finalized")
      .set("x-aevion-timestamp", timestamp)
      .set("x-aevion-signature", "deadbeef")
      .send(body);

    expect(res.status).toBe(401);
    expect(mockCredit).not.toHaveBeenCalled();
    expect(prizes).toHaveLength(0);
  });

  test("a missing podium is a 400, not a partial payout", async () => {
    const app = makeApp();
    const res = await post(app, { tournamentId: "t-spring-open" } as any);

    expect(res.status).toBe(400);
    expect(mockCredit).not.toHaveBeenCalled();
  });
});
