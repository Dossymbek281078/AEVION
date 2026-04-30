import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import { verifyWebhookSig } from "../lib/webhookSig";
import {
  chessPrizes,
  ensureEcosystemLoaded,
  scheduleEcosystemPersist,
  type ChessPrize,
} from "./ecosystem";

function sendCsv(res: Response, baseName: string, rows: (string | number | null | undefined)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csvFromRows(rows));
}

// /api/cyberchess/* — three test-mode endpoints the bank UI reads to render
// ChessWinnings live instead of mocked. In production these will be proxied
// to the chess service; for now they're an in-memory ledger fed by an
// auth'd webhook (`/tournament-finalized`).
export const cyberchessRouter = Router();

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

// Read-only endpoints — auth required, scoped to caller.
cyberchessRouter.get("/results", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = chessPrizes
    .filter((x) => x.email === email)
    .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
  res.json({ items });
});

cyberchessRouter.get("/results.csv", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = chessPrizes
    .filter((x) => x.email === email)
    .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
  const rows: (string | number | null | undefined)[][] = [
    ["id", "tournament_id", "place", "amount_aec", "finalized_at", "transfer_id"],
    ...items.map((x) => [x.id, x.tournamentId, x.place, x.amount, x.finalizedAt, x.transferId]),
  ];
  sendCsv(res, "cyberchess-results", rows);
});

// Public list of upcoming tournaments anyone can register for.
// In-memory seed so the UI has something to display before the chess service
// pushes real entries via the webhook below.
const upcomingTournaments: Array<{
  id: string;
  startsAt: string;
  format: string;
  prizePool: number;
  entries: number;
  capacity: number;
}> = [
  {
    id: "tour_demo_swiss_001",
    startsAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    format: "Swiss · 3+2 · 7 rounds",
    prizePool: 250,
    entries: 32,
    capacity: 64,
  },
  {
    id: "tour_demo_arena_002",
    startsAt: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
    format: "Arena · 1+0 · 60 min",
    prizePool: 100,
    entries: 14,
    capacity: 100,
  },
];

cyberchessRouter.get("/upcoming", (_req, res) => {
  res.json({ items: upcomingTournaments });
});

// Webhook called by the tournament service when a tournament finalizes.
// Validates a shared secret, then appends a ChessPrize per podium spot.
// Idempotent on (tournamentId, place, email).
const WEBHOOK_SECRET = process.env.CYBERCHESS_WEBHOOK_SECRET || "dev-chess-webhook";

cyberchessRouter.post("/tournament-finalized", async (req, res) => {
  const verdict = verifyWebhookSig({
    signature: req.headers["x-aevion-signature"],
    timestamp: req.headers["x-aevion-timestamp"],
    legacySecret: req.headers["x-cyberchess-secret"],
    body: req.body,
    secret: WEBHOOK_SECRET,
  });
  if (!verdict.ok) {
    return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
  }
  await ensureEcosystemLoaded();

  const { tournamentId, podium } = req.body || {};
  if (typeof tournamentId !== "string" || !Array.isArray(podium)) {
    return res
      .status(400)
      .json({ error: "tournamentId (string) and podium (array) required" });
  }

  type PodiumEntry = { email?: unknown; place?: unknown; amount?: unknown };
  const entries = podium as PodiumEntry[];
  const recorded: Array<{ id: string; email: string; place: number; amount: number }> = [];
  const replayed: Array<{ id: string; email: string; place: number }> = [];

  for (const e of entries) {
    if (typeof e.email !== "string" || typeof e.place !== "number") continue;
    const amt = Number(e.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;

    const dup = chessPrizes.find(
      (x) =>
        x.tournamentId === tournamentId &&
        x.place === e.place &&
        x.email === (e.email as string).toLowerCase(),
    );
    if (dup) {
      replayed.push({ id: dup.id, email: dup.email, place: dup.place });
      continue;
    }

    const prize: ChessPrize = {
      id: `prize_${randomUUID()}`,
      email: (e.email as string).toLowerCase(),
      tournamentId,
      place: e.place,
      amount: amt,
      finalizedAt: new Date().toISOString(),
      transferId: null,
      source: "cyberchess",
    };
    chessPrizes.push(prize);
    recorded.push({ id: prize.id, email: prize.email, place: prize.place, amount: prize.amount });
  }

  // Drop the tournament from upcoming once finalized.
  const idx = upcomingTournaments.findIndex((x) => x.id === tournamentId);
  if (idx >= 0) upcomingTournaments.splice(idx, 1);

  if (recorded.length > 0) scheduleEcosystemPersist();

  res.status(201).json({
    tournamentId,
    recorded,
    replayed,
    finalizedAt: new Date().toISOString(),
  });
});
