import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

// GET /api/cyberchess-anticheat/stats/:userId — 2026-08-12.
//
// Two things were wrong with a public, unauthenticated endpoint.
//
// 1. It returned the stored reports as they are, including the `ip` field the
//    router records for every submission. So anyone could read IP addresses out
//    of it by player id. Keeping the address for abuse investigation is fine;
//    handing it to whoever asks is not.
//
// 2. It counted client-submitted verdicts as evidence. A client report is a
//    browser POST carrying an arbitrary userId, so anyone could file "flagged"
//    against any player and it landed in that player's statistics next to the
//    server's own measurements. The admin endpoint one screen down already says
//    server signals are "unspoofable, a cheating client can't fake or suppress
//    them" — the knowledge was there, this endpoint just did not use it.

import anticheatRouter, { submitServerReport } from "../src/routes/cyberchessAnticheat";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-anticheat", anticheatRouter);

let n = 0;
const freshUser = () => `victim_${Date.now().toString(36)}_${++n}`;

/** A report as a browser sends one — the userId is whatever the caller typed. */
function clientReport(userId: string, verdict: string) {
  return request(app)
    .post("/api/cyberchess-anticheat/report")
    .send({
      userId,
      verdict,
      suspicionScore: 95,
      confidence: "high",
      analysedAt: Date.now(),
      gameId: `g-${n}`,
    });
}

const stats = (userId: string) =>
  request(app).get(`/api/cyberchess-anticheat/stats/${encodeURIComponent(userId)}`);

describe("a stranger's accusation is not the system's verdict", () => {
  test("a client-submitted flag does not become a flagged game", async () => {
    const userId = freshUser();
    const posted = await clientReport(userId, "flagged");
    expect(posted.status).toBe(200);

    const res = await stats(userId);

    expect(res.status).toBe(200);
    expect(res.body.summary.flaggedGames).toBe(0);
    expect(res.body.summary.latestVerdict).toBe("none");
  });

  test("it is still counted — as an unverified claim, under that name", async () => {
    const userId = freshUser();
    await clientReport(userId, "flagged");

    const res = await stats(userId);

    expect(res.body.summary.unverified.flagged).toBe(1);
    expect(res.body.summary.unverified.total).toBe(1);
  });

  test("a server measurement does count as a verdict", async () => {
    const userId = freshUser();
    submitServerReport({
      userId,
      verdict: "flagged",
      suspicionScore: 88,
      confidence: "high",
      timeCoV: 0.02,
      analysedAt: Date.now(),
    } as any);

    const res = await stats(userId);

    expect(res.body.summary.flaggedGames).toBe(1);
    expect(res.body.summary.latestVerdict).toBe("flagged");
  });

  test("a stranger cannot dilute a real verdict either", async () => {
    // The other direction: filing "clean" reports must not wash out what the
    // server measured.
    const userId = freshUser();
    submitServerReport({
      userId,
      verdict: "flagged",
      suspicionScore: 88,
      confidence: "high",
      timeCoV: 0.02,
      analysedAt: Date.now(),
    } as any);
    await clientReport(userId, "clean");
    await clientReport(userId, "clean");

    const res = await stats(userId);

    expect(res.body.summary.flaggedGames).toBe(1);
    expect(res.body.summary.totalGames).toBe(1);
  });
});

describe("addresses do not leave the server", () => {
  test("the public stats carry no ip field", async () => {
    const userId = freshUser();
    await clientReport(userId, "suspicious");

    const res = await stats(userId);

    expect(res.body.reports.length).toBeGreaterThan(0);
    for (const r of res.body.reports) {
      expect(r.ip).toBeUndefined();
    }
    expect(JSON.stringify(res.body)).not.toContain("127.0.0.1");
    expect(JSON.stringify(res.body)).not.toContain("::ffff:");
  });

  test("the report itself is still there — only the address is gone", async () => {
    const userId = freshUser();
    await clientReport(userId, "suspicious");

    const res = await stats(userId);
    const r = res.body.reports[0];

    expect(r.verdict).toBe("suspicious");
    expect(r.suspicionScore).toBe(95);
    expect(typeof r.reportId).toBe("string");
  });
});
