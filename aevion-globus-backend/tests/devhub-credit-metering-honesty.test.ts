/**
 * Quota metering must not disappear quietly when the database refuses.
 *
 * Two independent silent failures used to compose into "no metering at all":
 *
 *  1. getMonthUsage() answered `0` on a failed read. Zero is also the honest
 *     answer for a fresh month, so a database outage was indistinguishable
 *     from a user who had spent nothing — and every gate opened.
 *  2. debitCredit() caught its write failure and recorded the charge in an
 *     in-memory map that getMonthUsage() only reads when the database is
 *     KNOWN to be down. With the database nominally up, that fallback was
 *     never read back, so the debit went nowhere.
 *
 * Together: during a database wobble every paid capability became unlimited,
 * with nothing in the response, the logs or the credits screen to say so.
 * This is the money path, so the failure has to be visible even when the
 * decision is still to let the user through.
 *
 * Own harness because these tests need `isDevHubDbReady() === true` — the
 * other DevHub files pin it to false to use the in-memory store.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// The point of this file: the database is READY, and still fails.
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [],
  callProvider: vi.fn(),
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

function tokenFor(sub: string, role: string) {
  const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
  return `Bearer ${jwt.sign({ sub, email: `${sub}@e.com`, role }, secret, { algorithm: "HS256" })}`;
}
function authHeader(sub: string) {
  return { Authorization: tokenFor(sub, "user") };
}
/** POST /studio/tier is admin-only, and it addresses the target by targetUserId. */
function adminHeader(sub: string) {
  return { Authorization: tokenFor(sub, "admin") };
}

beforeEach(() => {
  __resetDevHubStore();
  mockQuery.mockReset();
});

afterEach(() => {
  mockQuery.mockReset();
});

/** Every query rejects — a database that is up as far as the app knows, and refusing. */
function databaseRefuses() {
  mockQuery.mockRejectedValue(new Error("connection terminated unexpectedly"));
}

/** Reads succeed and report a real, non-zero spend. */
function databaseReports(used: number) {
  mockQuery.mockResolvedValue({ rows: [{ used }] });
}

describe("GET /studio/credits — an unreadable meter is not a meter reading zero", () => {
  test("a failed usage read is marked, not served as 'nothing spent yet'", async () => {
    databaseRefuses();
    const app = makeApp();

    const r = await request(app).get("/api/devhub/studio/credits").set(authHeader("u1"));

    expect(r.status).toBe(200);
    // The screen may still render — but it must not present an unknown as a zero.
    expect(r.body.degraded).toBe(true);
    expect(r.body.degradedReason).toMatch(/usage|limit|прочитать|read/i);
    // Every capability the read covers is flagged, not just the first.
    for (const cap of ["video", "image", "tts", "music", "deploy"]) {
      expect(r.body.usage[cap].usedKnown).toBe(false);
    }
  });

  test("a working meter is not marked degraded and reports its real number", async () => {
    databaseReports(7);
    const app = makeApp();

    const r = await request(app).get("/api/devhub/studio/credits").set(authHeader("u2"));

    expect(r.status).toBe(200);
    expect(r.body.degraded).toBeUndefined();
    expect(r.body.usage.image.used).toBe(7);
    expect(r.body.usage.image.usedKnown).not.toBe(false);
  });
});

describe("a capability gate that could not read the meter says so", () => {
  test("the call is allowed through, but the answer admits the limit was unchecked", async () => {
    // Blocking a paying customer over a database blip is the worse of the two
    // mistakes, so the request proceeds — what must not happen is proceeding
    // in silence, which is how an unmetered month leaves no trace at all.
    databaseRefuses();
    const app = makeApp();

    const r = await request(app)
      .post("/api/devhub/media/image")
      .set(authHeader("u3"))
      .send({ prompt: "a cat" });

    // No provider is configured in this harness, so the route fails on the
    // provider — but the credit verdict it carries is what this pins.
    expect(r.body.creditUnverified).toBe(true);
  });
});

describe("a tier that could not be read is not silently downgraded to free", () => {
  // The mirror image of the usage bug, in the same two shapes:
  //  - getUserTier() answered "free" on a failed read, so a paying customer
  //    lost the plan they had bought for as long as the database wobbled;
  //  - setUserTier() parked a failed write in an in-memory map that
  //    getUserTier() only consulted with the database KNOWN to be down, so an
  //    upgrade applied during a wobble never took effect at all.
  test("the last known tier survives a failed read instead of collapsing to free", async () => {
    const app = makeApp();
    // An admin promotes a customer while the database is refusing: the write
    // fails and setUserTier parks the value in memory.
    databaseRefuses();
    const set = await request(app)
      .post("/api/devhub/studio/tier")
      .set(adminHeader("admin1"))
      .send({ targetUserId: "payer", tier: "pro" });
    // Asserted, not guarded by an `if` — a conditional here would let the
    // whole test pass while never running a single check.
    expect(set.status).toBe(200);

    const r = await request(app).get("/api/devhub/studio/credits").set(authHeader("payer"));

    expect(r.body.tier).toBe("pro");
    expect(r.body.tierKnown).toBe(false);
  });

  test("a user we have never seen still reads as free, and says the read failed", async () => {
    databaseRefuses();
    const app = makeApp();

    const r = await request(app).get("/api/devhub/studio/credits").set(authHeader("stranger"));

    // Nothing better than "free" is known about them, so free it is — but the
    // answer must not present that guess as a fact.
    expect(r.body.tier).toBe("free");
    expect(r.body.tierKnown).toBe(false);
  });

  test("a readable tier is not flagged", async () => {
    mockQuery.mockResolvedValue({ rows: [{ tier: "pro", used: 2 }] });
    const app = makeApp();

    const r = await request(app).get("/api/devhub/studio/credits").set(authHeader("u9"));

    expect(r.body.tier).toBe("pro");
    expect(r.body.tierKnown).not.toBe(false);
  });
});
