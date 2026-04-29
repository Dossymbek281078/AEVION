// Backend integration tests for the bank-track endpoints shipped in the
// 2026-04-29 sessions. Run with:
//
//     node --test aevion-globus-backend/tests/integration.test.mjs
//
// Boots the routers under a fresh express app on an ephemeral port (no
// external services touched). Uses the same JWT secret the routes verify
// against by setting AUTH_JWT_SECRET in-process before importing them.
//
// Coverage:
//   - JWT enforcement on /api/qtrade/* (401 without bearer)
//   - Pagination with cursor on /operations
//   - Idempotency replay on /topup
//   - Ownership rejection on /transfer
//   - Email lookup happy / 404 paths
//   - Ecosystem earnings shape
//   - QRight royalties webhook secret + idempotency
//   - CyberChess upcoming public access
//   - Planet payouts webhook flow

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.AUTH_JWT_SECRET = "test-secret-please-rotate";
process.env.AEVION_DATA_DIR = `${process.cwd()}/.aevion-data-test-${process.pid}`;
process.env.QRIGHT_WEBHOOK_SECRET = "test-qright";
process.env.CYBERCHESS_WEBHOOK_SECRET = "test-chess";
process.env.PLANET_WEBHOOK_SECRET = "test-planet";

const { qtradeRouter } = await import("../dist/routes/qtrade.js");
const { ecosystemRouter } = await import("../dist/routes/ecosystem.js");
const { qrightRoyaltiesRouter } = await import("../dist/routes/qrightRoyalties.js");
const { cyberchessRouter } = await import("../dist/routes/cyberchess.js");
const { planetPayoutsRouter } = await import("../dist/routes/planetPayouts.js");

function tokenFor(email) {
  return jwt.sign({ sub: `u_${email}`, email, role: "user" }, process.env.AUTH_JWT_SECRET, { expiresIn: "1h" });
}

let server;
let base;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/qtrade", qtradeRouter);
  app.use("/api/ecosystem", ecosystemRouter);
  app.use("/api/qright", qrightRoyaltiesRouter);
  app.use("/api/cyberchess", cyberchessRouter);
  app.use("/api/planet", planetPayoutsRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Best-effort cleanup of the per-pid data dir.
  const fs = await import("node:fs/promises");
  await fs.rm(process.env.AEVION_DATA_DIR, { recursive: true, force: true }).catch(() => {});
});

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return fetch(`${base}${path}`, { headers });
}

async function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("/api/qtrade/* JWT enforcement", () => {
  it("rejects /accounts without bearer", async () => {
    const r = await get("/api/qtrade/accounts");
    assert.equal(r.status, 401);
  });

  it("accepts /accounts with valid bearer", async () => {
    const r = await get("/api/qtrade/accounts", tokenFor("alice@aevion.test"));
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.items));
  });
});

describe("ownership + transfer + idempotency", () => {
  let aliceTok, bobTok, aliceAcc, bobAcc;

  before(async () => {
    aliceTok = tokenFor("alice@aevion.test");
    bobTok = tokenFor("bob@aevion.test");
    const a = await post("/api/qtrade/accounts", {}, { Authorization: `Bearer ${aliceTok}` });
    aliceAcc = (await a.json()).id;
    const b = await post("/api/qtrade/accounts", {}, { Authorization: `Bearer ${bobTok}` });
    bobAcc = (await b.json()).id;
  });

  it("topup is idempotent — replay returns same balance", async () => {
    const k = "topup-test-key-1";
    const headers = { Authorization: `Bearer ${aliceTok}`, "Idempotency-Key": k };
    const r1 = await post("/api/qtrade/topup", { accountId: aliceAcc, amount: 100 }, headers);
    const j1 = await r1.json();
    assert.equal(r1.status, 200);
    assert.equal(j1.balance, 100);

    const r2 = await post("/api/qtrade/topup", { accountId: aliceAcc, amount: 100 }, headers);
    const j2 = await r2.json();
    assert.equal(r2.status, 200);
    assert.equal(j2.balance, 100, "replay must not double-credit");
    assert.equal(r2.headers.get("idempotency-replayed"), "true");
  });

  it("transfer rejects with 403 if alice signs a from-bob transfer", async () => {
    const r = await post(
      "/api/qtrade/transfer",
      { from: bobAcc, to: aliceAcc, amount: 1 },
      { Authorization: `Bearer ${aliceTok}` },
    );
    assert.equal(r.status, 403);
  });

  it("operations pagination — limit + cursor advance", async () => {
    // Top up 3 more times with new keys to grow the operations list.
    for (let i = 0; i < 3; i++) {
      await post(
        "/api/qtrade/topup",
        { accountId: aliceAcc, amount: 10 },
        { Authorization: `Bearer ${aliceTok}`, "Idempotency-Key": `pg-${i}` },
      );
    }
    const r1 = await get("/api/qtrade/operations?limit=2", aliceTok);
    const j1 = await r1.json();
    assert.equal(j1.items.length, 2);
    assert.ok(j1.nextCursor, "should have nextCursor when more pages exist");

    const r2 = await get(`/api/qtrade/operations?limit=2&cursor=${encodeURIComponent(j1.nextCursor)}`, aliceTok);
    const j2 = await r2.json();
    assert.ok(j2.items.length > 0);
    assert.notEqual(j2.items[0].id, j1.items[0].id, "cursor must advance");
  });
});

describe("email lookup", () => {
  it("returns 400 without email param", async () => {
    const r = await get("/api/qtrade/accounts/lookup", tokenFor("alice@aevion.test"));
    assert.equal(r.status, 400);
  });

  it("returns 404 for unknown email", async () => {
    const r = await get(
      "/api/qtrade/accounts/lookup?email=ghost@nowhere.test",
      tokenFor("alice@aevion.test"),
    );
    assert.equal(r.status, 404);
  });
});

describe("ecosystem + royalties + chess + planet", () => {
  const tok = tokenFor("creator@aevion.test");

  it("/ecosystem/earnings returns shape with totals + perSource", async () => {
    const r = await get("/api/ecosystem/earnings", tok);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(j.totals);
    assert.ok(Array.isArray(j.perSource));
    assert.equal(j.perSource.length, 3);
  });

  it("qright webhook rejects bad secret", async () => {
    const r = await post(
      "/api/qright/royalties/verify-webhook",
      { eventId: "x", email: "creator@aevion.test", productKey: "p", period: "2026-Q1", amount: 1 },
      { "X-QRight-Secret": "wrong" },
    );
    assert.equal(r.status, 401);
  });

  it("qright webhook is idempotent on eventId", async () => {
    const body = {
      eventId: "test-evt-1",
      email: "creator@aevion.test",
      productKey: "album-x",
      period: "2026-Q1",
      amount: 5,
    };
    const r1 = await post("/api/qright/royalties/verify-webhook", body, { "X-QRight-Secret": "test-qright" });
    assert.equal(r1.status, 201);
    const r2 = await post("/api/qright/royalties/verify-webhook", body, { "X-QRight-Secret": "test-qright" });
    assert.equal(r2.status, 200);
    const j2 = await r2.json();
    assert.equal(j2.replayed, true);
  });

  it("/qright/royalties surfaces the appended event", async () => {
    const r = await get("/api/qright/royalties", tok);
    const j = await r.json();
    assert.ok(j.items.some((x) => x.productKey === "album-x"));
  });

  it("/cyberchess/upcoming is public", async () => {
    const r = await get("/api/cyberchess/upcoming");
    assert.equal(r.status, 200);
  });

  it("planet webhook + payouts round-trip", async () => {
    const r = await post(
      "/api/planet/payouts/certify-webhook",
      {
        eventId: "test-cert-1",
        email: "creator@aevion.test",
        artifactVersionId: "art_v1",
        amount: 3,
      },
      { "X-Planet-Secret": "test-planet" },
    );
    assert.equal(r.status, 201);

    const lr = await get("/api/planet/payouts", tok);
    const lj = await lr.json();
    assert.ok(lj.items.some((x) => x.artifactVersionId === "art_v1"));
  });
});
