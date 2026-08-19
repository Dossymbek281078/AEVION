import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { stableStringify } from "../src/lib/stableStringify";

// CyberChess tournaments — result reporting and the registration ticket.
// 2026-08-12.
//
// Two things this file pins.
//
// 1. POST /:id/result decides who won a bracket pair, which drives standings,
//    placement and the prize podium — and it was open to anyone who knew a
//    tournament id. The rest of this router is open on purpose (CyberChess has
//    no accounts; a player registers under an id their own browser makes up,
//    so there is nothing to authenticate against), but "who won" is different
//    in kind. Nothing in the product calls it: real games settle through
//    onMatchSettled() inside the matchmaking module, an in-process call.
//
// 2. The registration ticket was minted for the response and thrown away. The
//    page printed "ticket tkt_…" as proof of entry while the server had never
//    heard of that string, so nobody — player, support, or the tournament
//    itself — could confirm it, and a cleared browser lost it for good.

const SECRET = "test-chess-webhook-secret";

// Set before the router is imported: it reads the data directory once, at
// module load. The real file lives in the repository and holds live
// registrations — a test run must not rewrite it.
const { scratchDir } = vi.hoisted(() => {
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-tour-test-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  // The literal is repeated rather than referenced: vi.hoisted runs before the
  // SECRET const above is initialised.
  process.env.CYBERCHESS_WEBHOOK_SECRET = "test-chess-webhook-secret";
  return { scratchDir: dir };
});

// The matchmaking module opens timers and sockets when a pairing is created;
// none of that is under test here.
vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(() => null),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["blitz", "rapid", "classic"],
}));

// Imported statically: the first cold dynamic import of this router does not
// fit the per-test timeout. Same cure as checkoutZeroPrice, 3fb80dc7d.
import tournamentsRouter from "../src/routes/cyberchessTournaments";

const app = express();
// Same as index.ts — without it req.ip ignores X-Forwarded-For entirely and
// the rate-limit test below would pass for the wrong reason.
app.set("trust proxy", 1);
app.use(express.json());
app.use("/api/cyberchess-tournaments", tournamentsRouter);

function sign(body: unknown, timestamp: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${timestamp}.${stableStringify(body)}`)
    .digest("hex");
}

function postSigned(url: string, body: Record<string, unknown>) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return request(app)
    .post(url)
    .set("x-aevion-timestamp", timestamp)
    .set("x-aevion-signature", sign(body, timestamp))
    .send(body);
}

/** A tournament id plus a bracket match that has not been decided yet. */
async function findOpenMatch(): Promise<{ tournamentId: string; matchId: string }> {
  const list = await request(app).get("/api/cyberchess-tournaments/list");
  for (const t of list.body.tournaments ?? list.body.items ?? []) {
    const bracket = await request(app).get(`/api/cyberchess-tournaments/${t.id}/bracket`);
    for (const round of bracket.body.rounds ?? []) {
      for (const m of round.matches ?? []) {
        if (m.status !== "done") return { tournamentId: t.id, matchId: m.id };
      }
    }
  }
  throw new Error("no undecided match in the seed fixtures");
}

beforeEach(() => {
  process.env.CYBERCHESS_WEBHOOK_SECRET = SECRET;
});

afterAll(() => {
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

describe("the scratch directory is really being used", () => {
  test("the repository's tournament file is not the one under test", () => {
    // If this ever fails, every test below is quietly rewriting real data.
    expect(process.env.CYBERCHESS_TOURNAMENTS_DIR).toBe(scratchDir);
    expect(scratchDir).toContain(os.tmpdir());
    expect(fs.existsSync(path.join(scratchDir, "cyberchess-tournaments.json"))).toBe(true);
  });
});

describe("only a signed sender can decide who won", () => {
  test("an unsigned result is refused", async () => {
    const { tournamentId, matchId } = await findOpenMatch();
    const res = await request(app)
      .post(`/api/cyberchess-tournaments/${tournamentId}/result`)
      .send({ matchId, winner: "white" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_signature");
  });

  test("a wrong signature is refused", async () => {
    const { tournamentId, matchId } = await findOpenMatch();
    const res = await request(app)
      .post(`/api/cyberchess-tournaments/${tournamentId}/result`)
      .set("x-aevion-timestamp", String(Math.floor(Date.now() / 1000)))
      .set("x-aevion-signature", "deadbeef")
      .send({ matchId, winner: "white" });

    expect(res.status).toBe(401);
  });

  test("the refusal happens before the match is touched", async () => {
    const { tournamentId, matchId } = await findOpenMatch();
    await request(app)
      .post(`/api/cyberchess-tournaments/${tournamentId}/result`)
      .send({ matchId, winner: "white" });

    const bracket = await request(app).get(`/api/cyberchess-tournaments/${tournamentId}/bracket`);
    const found = (bracket.body.rounds ?? [])
      .flatMap((r: any) => r.matches ?? [])
      .find((m: any) => m.id === matchId);
    expect(found.status).not.toBe("done");
  });

  test("a signed result is applied", async () => {
    const { tournamentId, matchId } = await findOpenMatch();
    const res = await postSigned(`/api/cyberchess-tournaments/${tournamentId}/result`, {
      matchId,
      winner: "white",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.matchId).toBe(matchId);

    const bracket = await request(app).get(`/api/cyberchess-tournaments/${tournamentId}/bracket`);
    const found = (bracket.body.rounds ?? [])
      .flatMap((r: any) => r.matches ?? [])
      .find((m: any) => m.id === matchId);
    expect(found.status).toBe("done");
  });

  test("registration stays open — it is the result that is signed, not the router", async () => {
    const list = await request(app).get("/api/cyberchess-tournaments/list");
    const upcoming = (list.body.tournaments ?? list.body.items ?? []).find(
      (t: any) => t.status === "upcoming",
    );
    const res = await request(app)
      .post(`/api/cyberchess-tournaments/${upcoming.id}/register`)
      .send({ userId: `open_${crypto.randomUUID().slice(0, 8)}`, displayName: "Open Door" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("the registration ticket is something the server can recognise", () => {
  test("a repeat registration returns the ticket that was issued", async () => {
    const list = await request(app).get("/api/cyberchess-tournaments/list");
    const upcoming = (list.body.tournaments ?? list.body.items ?? []).find(
      (t: any) => t.status === "upcoming",
    );
    const userId = `tkt_owner_${crypto.randomUUID().slice(0, 8)}`;

    const first = await request(app)
      .post(`/api/cyberchess-tournaments/${upcoming.id}/register`)
      .send({ userId, displayName: "Ticket Holder" });
    expect(first.body.ticketId).toMatch(/^tkt_/);

    // The player cleared the browser: the only copy of the ticket is gone and
    // registering again is refused. The refusal has to carry it back, or the
    // ticket is unrecoverable.
    const again = await request(app)
      .post(`/api/cyberchess-tournaments/${upcoming.id}/register`)
      .send({ userId, displayName: "Ticket Holder" });

    expect(again.status).toBe(409);
    expect(again.body.error).toBe("already_registered");
    expect(again.body.ticketId).toBe(first.body.ticketId);
  });

  test("the ticket survives a restart, because it is written with the tournament", async () => {
    const list = await request(app).get("/api/cyberchess-tournaments/list");
    const upcoming = (list.body.tournaments ?? list.body.items ?? []).find(
      (t: any) => t.status === "upcoming",
    );
    const userId = `tkt_disk_${crypto.randomUUID().slice(0, 8)}`;

    const reg = await request(app)
      .post(`/api/cyberchess-tournaments/${upcoming.id}/register`)
      .send({ userId, displayName: "On Disk" });

    const stored = JSON.parse(
      fs.readFileSync(path.join(scratchDir, "cyberchess-tournaments.json"), "utf-8"),
    );
    const t = stored.tournaments.find((x: any) => x.id === upcoming.id);
    expect(t.tickets[userId]).toBe(reg.body.ticketId);
  });

  test("two players in the same tournament get different tickets", async () => {
    const list = await request(app).get("/api/cyberchess-tournaments/list");
    const upcoming = (list.body.tournaments ?? list.body.items ?? []).find(
      (t: any) => t.status === "upcoming",
    );

    const a = await request(app)
      .post(`/api/cyberchess-tournaments/${upcoming.id}/register`)
      .send({ userId: `a_${crypto.randomUUID().slice(0, 8)}` });
    const b = await request(app)
      .post(`/api/cyberchess-tournaments/${upcoming.id}/register`)
      .send({ userId: `b_${crypto.randomUUID().slice(0, 8)}` });

    expect(a.body.ticketId).not.toBe(b.body.ticketId);
  });
});

describe("creating tournaments cannot be sped up with a header", () => {
  test("a rotating X-Forwarded-For does not buy extra creations", async () => {
    // Creating a tournament is open — CyberChess has no accounts — so the only
    // thing standing between it and unbounded writes to persistent storage is
    // a limit of 5 per 10 minutes per caller. That limit used to be keyed on
    // the LEFTMOST X-Forwarded-For entry, which the caller writes: a different
    // value per request meant a fresh bucket every time and the limit never
    // fired. The address the proxy observed is appended on the right, as in
    // production.
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post("/api/cyberchess-tournaments")
        .set("x-forwarded-for", `10.0.0.${i}, 203.0.113.77`)
        .send({
          title: `Spoof Cup ${i}`,
          format: "swiss",
          timeControl: "blitz",
          maxPlayers: 8,
        });
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // The first few are genuinely allowed — this is a limit, not a wall.
    expect(statuses[0]).not.toBe(429);
  });
});
