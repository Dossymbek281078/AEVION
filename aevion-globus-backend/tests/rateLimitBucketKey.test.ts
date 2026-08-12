import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";

import { rateLimit } from "../src/lib/rateLimit";

// lib/rateLimit bucket keys — 2026-08-12.
//
// The middleware counts a caller under `${keyPrefix}:${ip}`. Two properties of
// that expression were wrong in a way nothing could see from the outside — the
// endpoints kept answering, they just refused the wrong callers:
//
//   1. keyPrefix defaulted to a single shared literal ("rl"). 45 of the 115
//      call sites omit it, so all 45 incremented ONE counter per address while
//      each compared that counter against its own `max`. z-tide's 300/min read
//      limit and qsign's 60/min signing limit are two of them: 61 z-tide reads
//      left signing refused for the rest of the minute, and the 429 named the
//      limit that had not been reached.
//
//   2. keyFn was accepted by the options type and then dropped on the floor
//      ("per-request key customisation not supported in this impl"). multichat's
//      dispatch limiter passes one to count per signed-in user; without it every
//      user behind one address shared 12 dispatches per minute.
//
// Both tests below are red on the code before this commit.

/** Fresh app per case so buckets can't be inherited from another test. */
function appWith(...mws: express.RequestHandler[]) {
  const app = express();
  app.set("trust proxy", 1);
  mws.forEach((mw, i) => app.get(`/r${i}`, mw, (_req, res) => res.json({ ok: true })));
  return app;
}

describe("rateLimit — one limiter must not spend another limiter's budget", () => {
  test("a busy 300/min endpoint does not exhaust an unrelated 60/min endpoint", async () => {
    // Two limiters written the way 45 call sites write them: no keyPrefix.
    const readLimiter = rateLimit({ windowMs: 60_000, max: 300 });
    const signLimiter = rateLimit({ windowMs: 60_000, max: 60 });
    const app = appWith(readLimiter, signLimiter);

    // 61 reads — well inside the read limiter's own 300/min allowance.
    for (let i = 0; i < 61; i++) {
      const r = await request(app).get("/r0");
      expect(r.status).toBe(200);
    }

    // The signing endpoint has served nothing yet, so its first call must pass.
    const signed = await request(app).get("/r1");
    expect(signed.status).toBe(200);
  });

  test("two limiters at the same max keep independent counters", async () => {
    const a = rateLimit({ windowMs: 60_000, max: 2 });
    const b = rateLimit({ windowMs: 60_000, max: 2 });
    const app = appWith(a, b);

    expect((await request(app).get("/r0")).status).toBe(200);
    expect((await request(app).get("/r0")).status).toBe(200);
    expect((await request(app).get("/r0")).status).toBe(429); // its own budget: spent

    // b has served nothing. Both of its calls must pass.
    expect((await request(app).get("/r1")).status).toBe(200);
    expect((await request(app).get("/r1")).status).toBe(200);
  });
});

describe("rateLimit — keyFn counts the caller the call site names", () => {
  test("two signed-in users from one address get separate budgets", async () => {
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      keyPrefix: "mc-dispatch",
      keyFn: (req) => `mc:${(req as any).auth?.sub || "anon"}`,
    });

    const app = express();
    app.set("trust proxy", 1);
    // Stand-in for verifyBearer: the identity multichat's keyFn reads.
    app.get("/dispatch", (req, _res, next) => {
      (req as any).auth = { sub: String(req.query.user || "anon") };
      next();
    }, limiter, (_req, res) => res.json({ ok: true }));

    // user-a spends its whole allowance.
    expect((await request(app).get("/dispatch?user=a")).status).toBe(200);
    expect((await request(app).get("/dispatch?user=a")).status).toBe(200);
    expect((await request(app).get("/dispatch?user=a")).status).toBe(429);

    // user-b shares the address but not the account, and has spent nothing.
    expect((await request(app).get("/dispatch?user=b")).status).toBe(200);
    expect((await request(app).get("/dispatch?user=b")).status).toBe(200);
  });

  test("without keyFn the address is still what gets counted", async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: "by-ip" });
    const app = appWith(limiter);
    expect((await request(app).get("/r0")).status).toBe(200);
    expect((await request(app).get("/r0")).status).toBe(429);
  });
});
