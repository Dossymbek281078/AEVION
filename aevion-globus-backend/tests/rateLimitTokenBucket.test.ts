import { describe, test, expect, vi, afterEach } from "vitest";
import request from "supertest";
import express from "express";

import { rateLimit } from "../src/lib/rateLimit";

// refillPerSec — 2026-08-12.
//
// Three call sites configure this helper as a token bucket:
//
//   multichat.ts:43   capacity: 12, refillPerSec: 12/60
//   multichat.ts:898  capacity: 30, refillPerSec: 0.5
//   multichat.ts:937  capacity: 60, refillPerSec: 1
//
// The option was accepted by the type and dropped ("ignored compat field from
// bank token-bucket API"), so all three ran as a fixed 60s window instead. The
// average rate matches either way — what differs is the SHAPE, and the shape is
// what a bucket is for:
//
//   * a fixed window hands out the whole allowance instantly and then refuses
//     for the rest of the window, where a bucket drips one token per interval;
//   * a fixed window allows 2× the allowance back-to-back across its boundary —
//     12 at t=59s and 12 more at t=61s. On the dispatch endpoint each of those
//     is a fan-out to up to 8 providers, so the burst the author ruled out is
//     ~192 provider calls in a couple of seconds.
//
// Same defect class as the dropped keyFn: an option the type promises and the
// implementation ignores. Both tests below are red on the code before this
// commit.

afterEach(() => vi.useRealTimers());

function bucketApp(opts: Parameters<typeof rateLimit>[0]) {
  const app = express();
  app.set("trust proxy", 1);
  app.get("/r", rateLimit(opts), (_req, res) => res.json({ ok: true }));
  return app;
}

describe("rateLimit — refillPerSec means the tokens drip back", () => {
  test("a spent bucket recovers one request per refill interval, not all at once", async () => {
    vi.useFakeTimers();
    // 2 tokens, one back per second.
    const app = bucketApp({ capacity: 2, refillPerSec: 1, keyPrefix: "drip" });

    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(429);

    // One second later exactly one token is back.
    vi.advanceTimersByTime(1000);
    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(429);

    // Two more seconds → two tokens, and the bucket never exceeds capacity.
    vi.advanceTimersByTime(2000);
    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(429);
  });

  test("no 2x burst across what would have been the window boundary", async () => {
    vi.useFakeTimers();
    // The real dispatch shape: 12 per minute.
    const app = bucketApp({ capacity: 12, refillPerSec: 12 / 60, keyPrefix: "dispatch-shape" });

    // One call now — with a fixed window this is what opens the [0s, 60s) window.
    expect((await request(app).get("/r")).status).toBe(200);

    // Spend the rest at the very end of that window.
    vi.advanceTimersByTime(59_000);
    let servedAtEdge = 0;
    for (let i = 0; i < 11; i++) {
      if ((await request(app).get("/r")).status === 200) servedAtEdge++;
    }
    expect(servedAtEdge).toBe(11); // whole allowance legitimately spent

    // Two seconds later. A fixed window has rolled over and hands back all 12,
    // i.e. 23 requests inside ~2 seconds. A bucket has accrued 2s × 0.2/s = 0.4
    // of a token, so it serves at most the one it had left over.
    vi.advanceTimersByTime(2_000);
    let servedAfterEdge = 0;
    for (let i = 0; i < 12; i++) {
      if ((await request(app).get("/r")).status === 200) servedAfterEdge++;
    }
    expect(servedAfterEdge).toBeLessThanOrEqual(2);

    // And it is not a latch: a full minute later the allowance is back.
    vi.advanceTimersByTime(60_000);
    expect((await request(app).get("/r")).status).toBe(200);
  });

  test("without refillPerSec the fixed window is unchanged", async () => {
    const app = bucketApp({ windowMs: 60_000, max: 2, keyPrefix: "window-still-window" });
    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(200);
    expect((await request(app).get("/r")).status).toBe(429);
  });
});
