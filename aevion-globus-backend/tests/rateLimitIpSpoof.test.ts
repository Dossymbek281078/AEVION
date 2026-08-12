import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { rateLimit } from "../src/lib/rateLimit";

// The shared rate limiter — 2026-08-12.
//
// It keyed its buckets on the LEFTMOST entry of X-Forwarded-For. A proxy
// appends on the right, so the leftmost value is simply whatever the caller
// wrote and nothing verifies it. Changing that header per request gave every
// request a fresh bucket, so the counter never reached the limit — on all 120
// call sites at once, including the ones in front of login.
//
// Every test here builds its own app with its own keyPrefix: the buckets live
// in one process-wide map, so a shared prefix would leak counts between tests.

function makeApp(prefix: string, max = 3) {
  const app = express();
  // Same as index.ts. Without it req.ip ignores the header entirely and the
  // test would pass for the wrong reason.
  app.set("trust proxy", 1);
  app.use(rateLimit({ windowMs: 60_000, max, keyPrefix: prefix }));
  app.get("/thing", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("the limit counts the caller, not a header the caller writes", () => {
  test("the boundary, measured: a lone header value is still taken at face value", async () => {
    // Honest about what the fix does and does not do. `trust proxy: 1` says
    // "one hop in front of me is mine", so when X-Forwarded-For carries a
    // single entry Express treats it as written by that proxy. Reached with no
    // proxy in front, the caller supplies that entry themselves and still gets
    // a bucket per value. Closing that is a deployment question — declaring a
    // trusted hop that does not exist — not something this helper can decide.
    // What the fix removes is the case below, which is the production shape.
    const app = makeApp("boundary-lone", 3);
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await request(app).get("/thing").set("x-forwarded-for", `10.0.0.${i}`);
      statuses.push(res.status);
    }

    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  test("a rotating header buys nothing once the proxy appends the client it saw", async () => {
    // What the request looks like in production: the attacker's invented value
    // first, the address the proxy observed appended after it.
    const app = makeApp("spoof-appended");
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .get("/thing")
        .set("x-forwarded-for", `10.0.0.${i}, 203.0.113.9`);
      statuses.push(res.status);
    }

    expect(statuses[5]).toBe(429);
  });

  test("the refusal says how long to wait", async () => {
    const app = makeApp("spoof-retry", 1);
    await request(app).get("/thing").set("x-forwarded-for", "10.0.0.1, 203.0.113.9");
    const blocked = await request(app)
      .get("/thing")
      .set("x-forwarded-for", "10.0.0.2, 203.0.113.9");

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("what must keep working", () => {
  test("two genuinely different clients get their own budgets", async () => {
    const app = makeApp("two-clients", 2);

    // Each proxy-observed client is the last entry; the first entry differs
    // too, but it is the last one that decides.
    const a1 = await request(app).get("/thing").set("x-forwarded-for", "203.0.113.1");
    const a2 = await request(app).get("/thing").set("x-forwarded-for", "203.0.113.1");
    const a3 = await request(app).get("/thing").set("x-forwarded-for", "203.0.113.1");
    const b1 = await request(app).get("/thing").set("x-forwarded-for", "198.51.100.7");

    expect([a1.status, a2.status]).toEqual([200, 200]);
    expect(a3.status).toBe(429);
    // A different client must not inherit the exhausted budget.
    expect(b1.status).toBe(200);
  });

  test("requests under the limit pass and report what is left", async () => {
    const app = makeApp("headers", 5);
    const res = await request(app).get("/thing").set("x-forwarded-for", "203.0.113.2");

    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("5");
    expect(res.headers["x-ratelimit-remaining"]).toBe("4");
  });

  test("a request with no forwarding header at all is still counted", async () => {
    const app = makeApp("no-header", 2);
    await request(app).get("/thing");
    await request(app).get("/thing");
    const third = await request(app).get("/thing");

    expect(third.status).toBe(429);
  });
});
