import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// POST /api/cyberchess/matchmaking/internal/pre-match — 2026-08-12.
//
// The endpoint creates a live match between two named user ids. It is meant to
// be reachable only from this machine, and with no INTERNAL_TOKEN configured
// (none is set anywhere in the repo or the deploy notes) that was the only
// gate. It read the caller's address from req.ip — but index.ts sets
// `trust proxy`, which makes req.ip come from the X-Forwarded-For header, a
// header the caller writes. One extra header and anyone on the internet passed
// a check meant to prove the call was local, then could create matches naming
// any user ids, including a real player's, feeding results into that player's
// rating, history and the tournament bracket.
//
// The peer address of the TCP connection cannot be set by a header, so that is
// what the check reads now.

const { mockStore } = vi.hoisted(() => ({ mockStore: vi.fn() }));

// The match store opens a Postgres pool; nothing here is about persistence.
vi.mock("../src/routes/cyberchessMatchStore", () => ({
  ensureDb: vi.fn().mockResolvedValue(undefined),
  recordMatchCreated: mockStore,
  appendMove: vi.fn().mockResolvedValue(undefined),
  finalizeMatch: vi.fn().mockResolvedValue(undefined),
  getRating: vi.fn().mockResolvedValue(null),
  getLeaderboard: vi.fn().mockResolvedValue([]),
  getHistory: vi.fn().mockResolvedValue([]),
  getWallet: vi.fn().mockResolvedValue(null),
  getWalletLeaderboard: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/routes/cyberchessAnticheat", () => ({
  submitServerReport: vi.fn(),
}));

// Imported statically: a cold dynamic import of this router does not fit the
// per-test timeout. Same cure as checkoutZeroPrice, 3fb80dc7d.
import matchmakingRouter from "../src/routes/cyberchessMatchmaking";

/** Address the request appears to arrive from, at the TCP level. */
let peerAddress: string | null = null;

const app = express();
// Exactly what index.ts does — without this the bug does not exist.
app.set("trust proxy", 1);
app.use(express.json());
app.use((req, _res, next) => {
  if (peerAddress) {
    Object.defineProperty(req.socket, "remoteAddress", {
      value: peerAddress,
      configurable: true,
    });
  }
  next();
});
app.use("/api/cyberchess/matchmaking", matchmakingRouter);

const body = {
  whiteUserId: "victim_real_player",
  blackUserId: "attacker",
  timeControl: "300+5",
};

const preMatch = () => request(app).post("/api/cyberchess/matchmaking/internal/pre-match");

beforeEach(() => {
  peerAddress = null;
  delete process.env.INTERNAL_TOKEN;
});

afterEach(() => {
  delete process.env.INTERNAL_TOKEN;
});

describe("a forwarded header cannot pass for a local call", () => {
  test("an outside caller claiming 127.0.0.1 is refused", async () => {
    peerAddress = "203.0.113.7"; // arrives from the internet
    const res = await preMatch().set("x-forwarded-for", "127.0.0.1").send(body);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden_no_token_and_non_loopback");
  });

  test("the header trick does not work with a chain of hops either", async () => {
    peerAddress = "203.0.113.7";
    const res = await preMatch()
      .set("x-forwarded-for", "8.8.8.8, 127.0.0.1")
      .send(body);

    expect(res.status).toBe(403);
  });

  test("an outside caller with no header at all is refused", async () => {
    peerAddress = "203.0.113.7";
    const res = await preMatch().send(body);

    expect(res.status).toBe(403);
  });

  test("no match is created when the call is refused", async () => {
    peerAddress = "203.0.113.7";
    const res = await preMatch().set("x-forwarded-for", "127.0.0.1").send(body);

    expect(res.body.matchId).toBeUndefined();
    // A refused call must not reach the store either.
    expect(mockStore).not.toHaveBeenCalled();
  });
});

describe("the legitimate paths still work", () => {
  test("a genuinely local call is accepted", async () => {
    peerAddress = null; // supertest connects over loopback
    const res = await preMatch().send(body);

    expect(res.status).toBe(200);
    expect(res.body.matchId).toMatch(/^m_/);
  });

  test("an IPv6-mapped loopback peer is accepted", async () => {
    peerAddress = "::ffff:127.0.0.1";
    const res = await preMatch().send(body);

    expect(res.status).toBe(200);
  });

  test("a correct token is accepted from outside", async () => {
    process.env.INTERNAL_TOKEN = "s3cret-internal-token";
    peerAddress = "203.0.113.7";
    const res = await preMatch()
      .set("x-internal-token", "s3cret-internal-token")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.matchId).toMatch(/^m_/);
  });

  test("a wrong token is refused even from loopback", async () => {
    process.env.INTERNAL_TOKEN = "s3cret-internal-token";
    peerAddress = null;
    const res = await preMatch().set("x-internal-token", "wrong").send(body);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden");
  });

  test("a token of a different length is refused, not crashed on", async () => {
    // The comparison hashes both sides before comparing: timingSafeEqual
    // throws outright when the buffers differ in length.
    process.env.INTERNAL_TOKEN = "s3cret-internal-token";
    peerAddress = null;
    const res = await preMatch().set("x-internal-token", "x").send(body);

    expect(res.status).toBe(403);
  });
});
