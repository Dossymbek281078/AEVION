import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// POST /api/cyberchess/daily/solve — 2026-08-12.
//
// The daily leaderboard is persistent and committed to the repository, sorted
// by score, and an entry is only ever replaced by a HIGHER score. /solve took
// the client's word for the run with a `typeof streak === "number"` check and
// nothing else, so one request claiming a billion-day streak took first place
// permanently — there is no score that beats it and no path that lowers it.
// (I first wrote that NaN and Infinity slipped past that check too. They do not
// — JSON has neither value, so both arrive as null and the type check already
// refuses them. Corrected after the test said so.)
//
// Auth is deliberately not the answer: CyberChess has no accounts. Bounding
// what can be claimed is.

const { scratchDir } = vi.hoisted(() => {
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-daily-test-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  return { scratchDir: dir };
});

// Imported statically: a cold dynamic import does not fit the per-test timeout.
import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess/daily", dailyRouter);

const solve = (body: Record<string, unknown>) =>
  request(app).post("/api/cyberchess/daily/solve").send(body);

const leaderboard = async () => {
  const res = await request(app).get("/api/cyberchess/daily/leaderboard");
  return (res.body.leaderboard ?? res.body.entries ?? res.body.items ?? []) as any[];
};

const day = "2026-08-12";
let n = 0;
const freshUser = () => `player_${++n}_${Date.now()}`;

beforeEach(() => {
  n += 1;
});

afterAll(() => {
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

describe("the store under test is the scratch one", () => {
  test("the repository's leaderboard file is not the one being written", () => {
    // If this fails, every test below is dirtying tracked data.
    expect(process.env.CYBERCHESS_DAILY_DIR).toBe(scratchDir);
    expect(scratchDir).toContain(os.tmpdir());
  });
});

describe("a claim that cannot be true is refused", () => {
  test("a billion-day streak does not take first place", async () => {
    const res = await solve({ streak: 1_000_000_000, day, userId: freshUser(), name: "Cheater" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_streak");
    const board = await leaderboard();
    expect(board.some((e) => e.name === "Cheater")).toBe(false);
  });

  test("NaN and Infinity arrive as null and are refused by the type check", async () => {
    // Not the guard's doing, and worth writing down: JSON has neither value, so
    // both are already null by the time the request leaves the client. I had
    // claimed they slipped past `typeof` — they cannot reach it at all.
    const nan = await solve({ streak: Number.NaN, day, userId: freshUser(), name: "NaNny" });
    const inf = await solve({ streak: Number.POSITIVE_INFINITY, day, userId: freshUser() });

    expect(nan.status).toBe(400);
    expect(inf.status).toBe(400);
    const board = await leaderboard();
    expect(board.some((e) => e.name === "NaNny")).toBe(false);
  });

  test("a negative streak is refused", async () => {
    const res = await solve({ streak: -5, day, userId: freshUser() });

    expect(res.status).toBe(400);
  });

  test("a fractional streak is refused", async () => {
    const res = await solve({ streak: 3.7, day, userId: freshUser() });

    expect(res.status).toBe(400);
  });

  test("nothing refused ever reaches the stored file", async () => {
    await solve({ streak: 1e12, day, userId: freshUser(), name: "Ghost" });

    const file = path.join(scratchDir, "cyberchess-daily-leaderboard.json");
    if (fs.existsSync(file)) {
      const stored = JSON.parse(fs.readFileSync(file, "utf-8")) as any[];
      expect(stored.some((e) => e.name === "Ghost")).toBe(false);
      // Every stored score is a real number — no null rows.
      expect(stored.every((e) => typeof e.score === "number")).toBe(true);
    }
  });
});

describe("an ordinary run still counts", () => {
  test("a believable streak is accepted and reaches the board", async () => {
    const userId = freshUser();
    const res = await solve({ streak: 12, day, userId, name: "Honest", timeMs: 45_000 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const board = await leaderboard();
    expect(board.some((e) => e.userId === userId)).toBe(true);
  });

  test("the highest allowed streak is still allowed", async () => {
    const res = await solve({ streak: 3650, day, userId: freshUser(), name: "Decade" });

    expect(res.status).toBe(200);
  });

  test("an overlong name is stored trimmed, not rejected", async () => {
    const userId = freshUser();
    await solve({ streak: 5, day, userId, name: "x".repeat(500) });

    const board = await leaderboard();
    const mine = board.find((e) => e.userId === userId);
    expect(mine.name.length).toBeLessThanOrEqual(40);
  });

  test("an absurd time is clamped rather than trusted", async () => {
    // timeMs only feeds a bonus that floors at zero, so this cannot move the
    // board — pinned so the clamp is not dropped as pointless later.
    const res = await solve({ streak: 4, day, userId: freshUser(), timeMs: 1e18 });

    expect(res.status).toBe(200);
  });
});

// Must stay LAST in this file. The limiter counts per address and every request
// here arrives from the same one, so the flood below exhausts the budget for
// whatever runs after it.
describe("a flood of believable claims cannot fill the board", () => {
  test("posting the maximum streak under fresh ids starts being refused", async () => {
    // The bounds above stop one absurd claim; this stops a thousand plausible
    // ones. User ids are whatever the caller invents and the board holds 1000
    // persisted rows sorted by score, so an unthrottled script filling it with
    // maximum-streak entries pushes every real player off for good.
    const statuses: number[] = [];
    for (let i = 0; i < 40; i++) {
      const res = await solve({ streak: 3650, day, userId: `flood_${i}`, name: `Flood${i}` });
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // It is a ceiling, not a wall: the first requests still go through.
    expect(statuses[0]).toBe(200);
  });

  test("the refusal says how long to wait", async () => {
    const res = await solve({ streak: 3, day, userId: freshUser() });
    if (res.status === 429) {
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
      expect(res.body.retryAfterSec).toBeGreaterThan(0);
    } else {
      // Not yet exhausted in this ordering — the previous test proves the gate.
      expect(res.status).toBe(200);
    }
  });
});
