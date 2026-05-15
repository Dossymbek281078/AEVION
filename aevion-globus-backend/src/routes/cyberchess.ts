import { Router, type Request, type Response } from "express";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pg = require("pg") as typeof import("pg");
import { randomUUID } from "node:crypto";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import {
  loadTournaments,
  markTournamentFinalized,
  saveTournament,
  type Tournament,
} from "../lib/ecosystemStore";
import { paginate, parsePageOpts } from "../lib/pagination";
import { verifyWebhookSig } from "../lib/webhookSig";
import { requireProdSecret } from "../lib/qsignSecret";
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
  const { page, nextCursor } = paginate(items, parsePageOpts(req));
  res.json({ items: page, total: items.length, nextCursor });
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

// Demo tournaments seeded once at first read when the store is empty,
// so the UI always has something visible without forcing partners to
// pre-populate. Persistence lives in ecosystemStore (Postgres or JSON
// file) — survives restarts and webhook-driven status changes.
const DEMO_SEED: Tournament[] = [
  {
    id: "tour_demo_swiss_001",
    startsAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    format: "Swiss · 3+2 · 7 rounds",
    prizePool: 250,
    entries: 32,
    capacity: 64,
    status: "upcoming",
  },
  {
    id: "tour_demo_arena_002",
    startsAt: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
    format: "Arena · 1+0 · 60 min",
    prizePool: 100,
    entries: 14,
    capacity: 100,
    status: "upcoming",
  },
];

let demoSeeded = false;
async function ensureDemoSeed(): Promise<void> {
  if (demoSeeded) return;
  demoSeeded = true;
  const existing = await loadTournaments();
  if (existing.length === 0) {
    for (const t of DEMO_SEED) await saveTournament(t);
  }
}

cyberchessRouter.get("/upcoming", async (_req, res) => {
  try {
    await ensureDemoSeed();
    const items = await loadTournaments();
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "tournaments load failed" });
  }
});

// Webhook called by the tournament service when a tournament finalizes.
// Validates a shared secret, then appends a ChessPrize per podium spot.
// Idempotent on (tournamentId, place, email).
// Lazy resolution: throwing at module load would crash the server on a
// misconfigured prod deploy.
const getWebhookSecret = () => requireProdSecret("CYBERCHESS_WEBHOOK_SECRET", "dev-chess-webhook");

cyberchessRouter.post("/tournament-finalized", async (req, res) => {
  const verdict = verifyWebhookSig({
    signature: req.headers["x-aevion-signature"],
    timestamp: req.headers["x-aevion-timestamp"],
    legacySecret: req.headers["x-cyberchess-secret"],
    body: req.body,
    secret: getWebhookSecret(),
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

  // Mark the tournament finalized in persistent storage so it stops
  // appearing in /upcoming. Idempotent — safe even if the same webhook
  // arrives multiple times (the chess prize dedup above already covers
  // double-recording on retry).
  await markTournamentFinalized(tournamentId).catch((err) => {
    console.error("[cyberchess] markTournamentFinalized failed", err);
  });

  if (recorded.length > 0) scheduleEcosystemPersist();

  res.status(201).json({
    tournamentId,
    recorded,
    replayed,
    finalizedAt: new Date().toISOString(),
  });
});

// =====================================================================
// CPI (Chess Performance Index) — per-user multi-factor rating
// 11 factors + overall composite for /cyberchess/cpi/leaderboard.
// Lazy Prisma init (mirrors routes/puzzles.ts pattern). Offline mode
// returns an empty leaderboard so the UI degrades gracefully when
// DATABASE_URL is unset locally.
// =====================================================================

const CPI_FACTORS = [
  "overall",
  "accuracy",
  "tactics",
  "endgame",
  "timing",
  "aggression",
  "timeControl",
  "opening",
  "defense",
  "consistency",
  "endgameTechnique",
  "psychology",
] as const;
type CpiFactor = (typeof CPI_FACTORS)[number];

// CPI store — raw pg (Prisma 7 requires adapter; raw pool avoids that dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cpiPool: any = null;
let cpiDbReady = false;
let cpiDbInitTried = false;

async function ensureCpiDb(): Promise<void> {
  if (cpiDbInitTried) return;
  cpiDbInitTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[CyberchessCPI] No DATABASE_URL — offline mode");
    return;
  }
  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    // Create table if not exists (idempotent — mirrors Prisma schema migration)
    // Ensure updatedAt has a default (table may have been created by prisma db push without one)
    await pool.query(`ALTER TABLE IF EXISTS "CyberchessCpiState" ALTER COLUMN "updatedAt" SET DEFAULT now()`).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CyberchessCpiState" (
        "userId"            TEXT PRIMARY KEY,
        "displayName"       TEXT,
        "overall"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "accuracy"          DOUBLE PRECISION NOT NULL DEFAULT 0,
        "tactics"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "endgame"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "timing"            DOUBLE PRECISION NOT NULL DEFAULT 0,
        "aggression"        DOUBLE PRECISION NOT NULL DEFAULT 0,
        "timeControl"       DOUBLE PRECISION NOT NULL DEFAULT 0,
        "opening"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "defense"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "consistency"       DOUBLE PRECISION NOT NULL DEFAULT 0,
        "endgameTechnique"  DOUBLE PRECISION NOT NULL DEFAULT 0,
        "psychology"        DOUBLE PRECISION NOT NULL DEFAULT 0,
        "gamesPlayed"       INTEGER NOT NULL DEFAULT 0,
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "cpi_overall_idx"     ON "CyberchessCpiState" ("overall" DESC);
      CREATE INDEX IF NOT EXISTS "cpi_tactics_idx"     ON "CyberchessCpiState" ("tactics" DESC);
      CREATE INDEX IF NOT EXISTS "cpi_accuracy_idx"    ON "CyberchessCpiState" ("accuracy" DESC);
      CREATE INDEX IF NOT EXISTS "cpi_endgame_idx"     ON "CyberchessCpiState" ("endgame" DESC);
    `);
    cpiPool = pool;
    cpiDbReady = true;
    console.log("[CyberchessCPI] pg connected — CPI store ready");
  } catch (e) {
    console.warn("[CyberchessCPI] pg init failed:", e instanceof Error ? e.message : e);
  }
}

// Map Prisma camelCase factor names to quoted PG column names
const PG_COL: Record<string, string> = {
  overall: '"overall"', accuracy: '"accuracy"', tactics: '"tactics"',
  endgame: '"endgame"', timing: '"timing"', aggression: '"aggression"',
  timeControl: '"timeControl"', opening: '"opening"', defense: '"defense"',
  consistency: '"consistency"', endgameTechnique: '"endgameTechnique"',
  psychology: '"psychology"',
};

function parseFactor(raw: unknown): CpiFactor {
  if (typeof raw === "string" && (CPI_FACTORS as readonly string[]).includes(raw)) {
    return raw as CpiFactor;
  }
  return "overall";
}

function parseLimit(raw: unknown, def = 20, max = 100): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(max, Math.floor(n));
}

function clampFactorValue(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// GET /api/cyberchess/cpi/leaderboard?factor=<factor>&limit=20
// Public. factor defaults to "overall", limit max 100.
cyberchessRouter.get("/cpi/leaderboard", async (req: Request, res: Response) => {
  await ensureCpiDb();
  const factor = parseFactor(req.query.factor);
  const limit = parseLimit(req.query.limit, 20, 100);

  if (!cpiDbReady) {
    return res.json({ data: { items: [], offline: true, factor, limit } });
  }

  try {
    const col = PG_COL[factor] ?? '"overall"';
    const { rows } = await cpiPool!.query(
      `SELECT "userId","displayName",${col} AS value,"gamesPlayed" FROM "CyberchessCpiState" ORDER BY ${col} DESC LIMIT $1`,
      [limit],
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = rows.map((r: any, idx: number) => ({
      userId: r.userId,
      displayName: r.displayName ?? null,
      value: r.value ?? 0,
      rank: idx + 1,
      gamesPlayed: r.gamesPlayed ?? 0,
    }));
    res.json({ data: { items, factor, limit } });
  } catch (err) {
    console.error("[CyberchessCPI] leaderboard:", err);
    res.status(500).json({ error: "cpi_leaderboard_failed" });
  }
});

// POST /api/cyberchess/cpi/upsert
// Body: { userId, factors: {...11 floats...}, gamesPlayed, displayName? }
// Trust-based MVP (no auth) — upserts the row idempotently.
cyberchessRouter.post("/cpi/upsert", async (req: Request, res: Response) => {
  await ensureCpiDb();
  if (!cpiDbReady) {
    return res.status(503).json({ error: "cpi_db_not_ready" });
  }

  const { userId, factors, gamesPlayed, displayName } = (req.body ?? {}) as {
    userId?: unknown;
    factors?: Record<string, unknown>;
    gamesPlayed?: unknown;
    displayName?: unknown;
  };

  if (typeof userId !== "string" || userId.length === 0) {
    return res.status(400).json({ error: "userId (string) required" });
  }
  if (!factors || typeof factors !== "object") {
    return res.status(400).json({ error: "factors (object) required" });
  }

  const games = Number(gamesPlayed);
  const gp = Number.isFinite(games) && games >= 0 ? Math.floor(games) : 0;

  const data: Record<string, number | string | null> = {
    overall: clampFactorValue(factors.overall),
    accuracy: clampFactorValue(factors.accuracy),
    tactics: clampFactorValue(factors.tactics),
    endgame: clampFactorValue(factors.endgame),
    timing: clampFactorValue(factors.timing),
    aggression: clampFactorValue(factors.aggression),
    timeControl: clampFactorValue(factors.timeControl),
    opening: clampFactorValue(factors.opening),
    defense: clampFactorValue(factors.defense),
    consistency: clampFactorValue(factors.consistency),
    endgameTechnique: clampFactorValue(factors.endgameTechnique),
    psychology: clampFactorValue(factors.psychology),
    gamesPlayed: gp,
  };
  if (typeof displayName === "string" && displayName.length > 0) {
    data.displayName = displayName.slice(0, 120);
  }

  try {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const setClauses = cols.map((c, i) => `"${c}" = $${i + 2}`).join(", ");
    const insertCols = ['"userId"', ...cols.map(c => `"${c}"`)].join(", ");
    const insertVals = ["$1", ...cols.map((_, i) => `$${i + 2}`)].join(", ");
    const { rows } = await cpiPool!.query(
      `INSERT INTO "CyberchessCpiState" (${insertCols}) VALUES (${insertVals})
       ON CONFLICT ("userId") DO UPDATE SET ${setClauses}, "updatedAt" = now()
       RETURNING *`,
      [userId, ...vals],
    );
    res.status(200).json({ data: rows[0] ?? null });
  } catch (err) {
    console.error("[CyberchessCPI] upsert:", err);
    res.status(500).json({ error: "cpi_upsert_failed" });
  }
});

// GET /api/cyberchess/cpi/me?userId=...
// Returns current state of a single user, or null if not present.
cyberchessRouter.get("/cpi/me", async (req: Request, res: Response) => {
  await ensureCpiDb();
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) {
    return res.status(400).json({ error: "userId query param required" });
  }
  if (!cpiDbReady) {
    return res.json({ data: null, offline: true });
  }
  try {
    const { rows } = await cpiPool!.query(
      `SELECT * FROM "CyberchessCpiState" WHERE "userId" = $1 LIMIT 1`,
      [userId],
    );
    res.json({ data: rows[0] ?? null });
  } catch (err) {
    console.error("[CyberchessCPI] me:", err);
    res.status(500).json({ error: "cpi_me_failed" });
  }
});
