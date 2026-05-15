import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { qsignRouter } from "../src/routes/qsign";

// QSign v1 (legacy) Tier 3 hardening — regressions for findings 2026-05-08:
//
//   1. QSIGN_SECRET defaulted to public "dev-qsign-secret" — anyone with OSS
//      source could forge signatures.
//   2. /verify echoed `expected` — forgery oracle: hit with any signature,
//      read back the correct one, replay.
//   3. /verify used `expected === signature` — timing leak, full-string
//      compare gives bit-by-bit oracle on slow ops (less critical for hex
//      because HMAC-SHA256 hex is fixed length, but still wrong).
//   4. No payload size cap, no rate limit, no Deprecation header.

const ENV_KEYS = ["QSIGN_SECRET", "NODE_ENV"];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/qsign", qsignRouter);
  return app;
}

describe("qsign legacy — secret hardening", () => {
  test("dev fallback works in non-production", async () => {
    process.env.NODE_ENV = "development";
    const res = await request(makeApp())
      .post("/api/qsign/sign")
      .send({ hello: "world" });
    expect(res.status).toBe(200);
    expect(res.body.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  test("production refuses missing QSIGN_SECRET", async () => {
    process.env.NODE_ENV = "production";
    const res = await request(makeApp())
      .post("/api/qsign/sign")
      .send({ hello: "world" });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/QSIGN_SECRET/);
  });

  test("production refuses dev- prefixed secret", async () => {
    process.env.NODE_ENV = "production";
    process.env.QSIGN_SECRET = "dev-still-32-characters-long-pad-pad";
    const res = await request(makeApp())
      .post("/api/qsign/sign")
      .send({ hello: "world" });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/QSIGN_SECRET/);
  });

  test("production refuses short secret", async () => {
    process.env.NODE_ENV = "production";
    process.env.QSIGN_SECRET = "tooshort";
    const res = await request(makeApp())
      .post("/api/qsign/sign")
      .send({ hello: "world" });
    expect(res.status).toBe(500);
  });

  test("production accepts strong secret", async () => {
    process.env.NODE_ENV = "production";
    process.env.QSIGN_SECRET = "x".repeat(48);
    const res = await request(makeApp())
      .post("/api/qsign/sign")
      .send({ hello: "world" });
    expect(res.status).toBe(200);
    expect(res.body.signature).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("qsign legacy — verify hardening", () => {
  test("verify with valid signature returns valid:true", async () => {
    process.env.NODE_ENV = "development";
    const app = makeApp();
    const signRes = await request(app).post("/api/qsign/sign").send({ x: 1 });
    expect(signRes.status).toBe(200);
    const verifyRes = await request(app)
      .post("/api/qsign/verify")
      .send({ payload: { x: 1 }, signature: signRes.body.signature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
  });

  test("verify with bad signature returns valid:false (and does NOT echo expected)", async () => {
    process.env.NODE_ENV = "development";
    const app = makeApp();
    const verifyRes = await request(app)
      .post("/api/qsign/verify")
      .send({ payload: { x: 1 }, signature: "f".repeat(64) });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(false);
    // Critical: response must NOT contain the correct signature anywhere.
    expect(verifyRes.body.expected).toBeUndefined();
    expect(verifyRes.body.provided).toBeUndefined();
    expect(JSON.stringify(verifyRes.body)).not.toMatch(/[a-f0-9]{64}/);
  });

  test("verify with mismatched length returns false (no timingSafeEqual throw leaked)", async () => {
    process.env.NODE_ENV = "development";
    const app = makeApp();
    const verifyRes = await request(app)
      .post("/api/qsign/verify")
      .send({ payload: { x: 1 }, signature: "deadbeef" });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(false);
  });

  test("verify rejects missing fields with 400", async () => {
    process.env.NODE_ENV = "development";
    const res = await request(makeApp()).post("/api/qsign/verify").send({});
    expect(res.status).toBe(400);
  });
});

describe("qsign legacy — deprecation headers", () => {
  test("/sign sets Deprecation + Sunset + Link successor-version", async () => {
    process.env.NODE_ENV = "development";
    const res = await request(makeApp()).post("/api/qsign/sign").send({ x: 1 });
    expect(res.status).toBe(200);
    expect(res.headers["deprecation"]).toBe("true");
    expect(res.headers["sunset"]).toBe("2026-12-31");
    expect(res.headers["link"]).toMatch(/successor-version/);
  });

  test("/health surfaces deprecated:true + sunset for monitoring", async () => {
    const res = await request(makeApp()).get("/api/qsign/health");
    expect(res.status).toBe(200);
    expect(res.body.deprecated).toBe(true);
    expect(res.body.sunset).toBe("2026-12-31");
  });
});
