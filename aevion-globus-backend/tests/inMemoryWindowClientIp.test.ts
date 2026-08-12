import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { clientIp, createInMemoryRateLimiter } from "../src/lib/rateLimit/inMemoryWindow";

// lib/rateLimit/inMemoryWindow.ts — the second copy of the "who is calling"
// helper, 2026-08-12. Used by routes/pipeline.ts (four limits) and
// routes/quantum-shield.ts.
//
// It read the LEFTMOST X-Forwarded-For entry. A proxy appends on the right, so
// the leftmost value is whatever the caller wrote. Rotating it gave every
// request its own window and the limits never fired — the same defect the
// shared middleware had, in a second place, which is why the reasoning now
// lives in a comment next to both.
//
// Callers hand it `{ ip: req.ip, headers: req.headers }`, so the tests build a
// real express app to produce a real req.ip rather than inventing one.

/** Runs a request through express so req.ip is computed the way it is in prod. */
async function seenAs(headers: Record<string, string>): Promise<string> {
  const app = express();
  app.set("trust proxy", 1); // same as index.ts
  let seen = "";
  app.get("/x", (req, res) => {
    seen = clientIp({ ip: req.ip, headers: req.headers });
    res.json({ ok: true });
  });
  const r = request(app).get("/x");
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  await r;
  return seen;
}

describe("the caller is identified by the address, not by what they wrote", () => {
  test("an invented leftmost entry is ignored when the proxy appends the real client", async () => {
    const seen = await seenAs({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" });
    expect(seen).toBe("203.0.113.9");
  });

  test("rotating the leftmost entry does not change who is counted", async () => {
    const a = await seenAs({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" });
    const b = await seenAs({ "x-forwarded-for": "10.0.0.2, 203.0.113.9" });
    const c = await seenAs({ "x-forwarded-for": "172.16.9.9, 203.0.113.9" });

    expect(new Set([a, b, c]).size).toBe(1);
  });

  test("two genuinely different clients are told apart", async () => {
    const a = await seenAs({ "x-forwarded-for": "203.0.113.9" });
    const b = await seenAs({ "x-forwarded-for": "198.51.100.4" });

    expect(a).not.toBe(b);
  });

  test("no forwarding header at all still yields an address", async () => {
    const seen = await seenAs({});
    expect(seen).not.toBe("");
    expect(seen).not.toBe("unknown");
  });

  test("an object with no ip at all degrades to a single shared bucket", async () => {
    // Not a normal path — pinned so the fallback is a deliberate choice rather
    // than an empty string quietly becoming a key of its own.
    expect(clientIp({ headers: {} })).toBe("unknown");
  });
});

describe("the window itself still limits what it is given", () => {
  test("a caller past the allowance is refused and told how long to wait", () => {
    const win = createInMemoryRateLimiter({ windowMs: 60_000, max: 2 });

    expect(win.check("caller-a").allowed).toBe(true);
    expect(win.check("caller-a").allowed).toBe(true);
    const third = win.check("caller-a");

    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  test("a different caller keeps its own allowance", () => {
    const win = createInMemoryRateLimiter({ windowMs: 60_000, max: 1 });

    expect(win.check("caller-a").allowed).toBe(true);
    expect(win.check("caller-a").allowed).toBe(false);
    // The exhausted budget must not follow the next caller.
    expect(win.check("caller-b").allowed).toBe(true);
  });
});
