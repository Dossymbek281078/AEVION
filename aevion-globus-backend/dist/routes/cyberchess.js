"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cyberchessRouter = void 0;
const express_1 = require("express");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pg = require("pg");
const platform_1 = require("../lib/sentry/platform");
const captureCyberChessError = (0, platform_1.makeServiceCapture)("cyberchess");
const node_crypto_1 = require("node:crypto");
const authJwt_1 = require("../lib/authJwt");
const csv_1 = require("../lib/csv");
const ecosystemStore_1 = require("../lib/ecosystemStore");
const pagination_1 = require("../lib/pagination");
const webhookSig_1 = require("../lib/webhookSig");
const qsignSecret_1 = require("../lib/qsignSecret");
const ecosystem_1 = require("./ecosystem");
function sendCsv(res, baseName, rows) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send((0, csv_1.csvFromRows)(rows));
}
// /api/cyberchess/* — three test-mode endpoints the bank UI reads to render
// ChessWinnings live instead of mocked. In production these will be proxied
// to the chess service; for now they're an in-memory ledger fed by an
// auth'd webhook (`/tournament-finalized`).
exports.cyberchessRouter = (0, express_1.Router)();
function ownerEmail(req) {
    return req.auth?.email ?? "";
}
// Read-only endpoints — auth required, scoped to caller.
exports.cyberchessRouter.get("/results", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const items = ecosystem_1.chessPrizes
        .filter((x) => x.email === email)
        .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
    const { page, nextCursor } = (0, pagination_1.paginate)(items, (0, pagination_1.parsePageOpts)(req));
    res.json({ items: page, total: items.length, nextCursor });
});
exports.cyberchessRouter.get("/results.csv", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const items = ecosystem_1.chessPrizes
        .filter((x) => x.email === email)
        .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
    const rows = [
        ["id", "tournament_id", "place", "amount_aec", "finalized_at", "transfer_id"],
        ...items.map((x) => [x.id, x.tournamentId, x.place, x.amount, x.finalizedAt, x.transferId]),
    ];
    sendCsv(res, "cyberchess-results", rows);
});
// Demo tournaments seeded once at first read when the store is empty,
// so the UI always has something visible without forcing partners to
// pre-populate. Persistence lives in ecosystemStore (Postgres or JSON
// file) — survives restarts and webhook-driven status changes.
const DEMO_SEED = [
    {
        id: "tour_demo_swiss_001",
        startsAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        format: "Swiss · 3+2 · 7 rounds",
        prizePool: 250,
        entries: 32,
        capacity: 64,
        status: "upcoming",
    },
    {
        id: "tour_demo_arena_002",
        startsAt: new Date(Date.now() + 3 * 24 * 3600000).toISOString(),
        format: "Arena · 1+0 · 60 min",
        prizePool: 100,
        entries: 14,
        capacity: 100,
        status: "upcoming",
    },
];
let demoSeeded = false;
async function ensureDemoSeed() {
    if (demoSeeded)
        return;
    demoSeeded = true;
    const existing = await (0, ecosystemStore_1.loadTournaments)();
    if (existing.length === 0) {
        for (const t of DEMO_SEED)
            await (0, ecosystemStore_1.saveTournament)(t);
    }
}
exports.cyberchessRouter.get("/upcoming", async (_req, res) => {
    try {
        await ensureDemoSeed();
        const items = await (0, ecosystemStore_1.loadTournaments)();
        res.json({ items });
    }
    catch (err) {
        captureCyberChessError(err, { route: "upcoming" });
        res.status(500).json({ error: "tournaments load failed" });
    }
});
// Webhook called by the tournament service when a tournament finalizes.
// Validates a shared secret, then appends a ChessPrize per podium spot.
// Idempotent on (tournamentId, place, email).
// Lazy resolution: throwing at module load would crash the server on a
// misconfigured prod deploy.
const getWebhookSecret = () => (0, qsignSecret_1.requireProdSecret)("CYBERCHESS_WEBHOOK_SECRET", "dev-chess-webhook");
exports.cyberchessRouter.post("/tournament-finalized", async (req, res) => {
    const verdict = (0, webhookSig_1.verifyWebhookSig)({
        signature: req.headers["x-aevion-signature"],
        timestamp: req.headers["x-aevion-timestamp"],
        legacySecret: req.headers["x-cyberchess-secret"],
        body: req.body,
        secret: getWebhookSecret(),
    });
    if (!verdict.ok) {
        return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
    }
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const { tournamentId, podium } = req.body || {};
    if (typeof tournamentId !== "string" || !Array.isArray(podium)) {
        return res
            .status(400)
            .json({ error: "tournamentId (string) and podium (array) required" });
    }
    const entries = podium;
    const recorded = [];
    const replayed = [];
    for (const e of entries) {
        if (typeof e.email !== "string" || typeof e.place !== "number")
            continue;
        const amt = Number(e.amount);
        if (!Number.isFinite(amt) || amt <= 0)
            continue;
        const dup = ecosystem_1.chessPrizes.find((x) => x.tournamentId === tournamentId &&
            x.place === e.place &&
            x.email === e.email.toLowerCase());
        if (dup) {
            replayed.push({ id: dup.id, email: dup.email, place: dup.place });
            continue;
        }
        const prize = {
            id: `prize_${(0, node_crypto_1.randomUUID)()}`,
            email: e.email.toLowerCase(),
            tournamentId,
            place: e.place,
            amount: amt,
            finalizedAt: new Date().toISOString(),
            transferId: null,
            source: "cyberchess",
        };
        ecosystem_1.chessPrizes.push(prize);
        recorded.push({ id: prize.id, email: prize.email, place: prize.place, amount: prize.amount });
    }
    // Mark the tournament finalized in persistent storage so it stops
    // appearing in /upcoming. Idempotent — safe even if the same webhook
    // arrives multiple times (the chess prize dedup above already covers
    // double-recording on retry).
    await (0, ecosystemStore_1.markTournamentFinalized)(tournamentId).catch((err) => {
        console.error("[cyberchess] markTournamentFinalized failed", err);
    });
    if (recorded.length > 0)
        (0, ecosystem_1.scheduleEcosystemPersist)();
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
];
// CPI store — raw pg (Prisma 7 requires adapter; raw pool avoids that dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cpiPool = null;
let cpiDbReady = false;
let cpiDbInitTried = false;
async function ensureCpiDb() {
    if (cpiDbInitTried)
        return;
    cpiDbInitTried = true;
    if (!process.env.DATABASE_URL) {
        console.log("[CyberchessCPI] No DATABASE_URL — offline mode");
        return;
    }
    try {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        // Create table if not exists (idempotent — mirrors Prisma schema migration)
        // Ensure updatedAt has a default (table may have been created by prisma db push without one)
        await pool.query(`ALTER TABLE IF EXISTS "CyberchessCpiState" ALTER COLUMN "updatedAt" SET DEFAULT now()`).catch(() => { });
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
    }
    catch (e) {
        console.warn("[CyberchessCPI] pg init failed:", e instanceof Error ? e.message : e);
    }
}
// Map Prisma camelCase factor names to quoted PG column names
const PG_COL = {
    overall: '"overall"', accuracy: '"accuracy"', tactics: '"tactics"',
    endgame: '"endgame"', timing: '"timing"', aggression: '"aggression"',
    timeControl: '"timeControl"', opening: '"opening"', defense: '"defense"',
    consistency: '"consistency"', endgameTechnique: '"endgameTechnique"',
    psychology: '"psychology"',
};
function parseFactor(raw) {
    if (typeof raw === "string" && CPI_FACTORS.includes(raw)) {
        return raw;
    }
    return "overall";
}
function parseLimit(raw, def = 20, max = 100) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0)
        return def;
    return Math.min(max, Math.floor(n));
}
function clampFactorValue(raw) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}
// GET /api/cyberchess/cpi/leaderboard?factor=<factor>&limit=20
// Public. factor defaults to "overall", limit max 100.
exports.cyberchessRouter.get("/cpi/leaderboard", async (req, res) => {
    await ensureCpiDb();
    const factor = parseFactor(req.query.factor);
    const limit = parseLimit(req.query.limit, 20, 100);
    if (!cpiDbReady) {
        return res.json({ data: { items: [], offline: true, factor, limit } });
    }
    try {
        const col = PG_COL[factor] ?? '"overall"';
        const { rows } = await cpiPool.query(`SELECT "userId","displayName",${col} AS value,"gamesPlayed" FROM "CyberchessCpiState" ORDER BY ${col} DESC LIMIT $1`, [limit]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = rows.map((r, idx) => ({
            userId: r.userId,
            displayName: r.displayName ?? null,
            value: r.value ?? 0,
            rank: idx + 1,
            gamesPlayed: r.gamesPlayed ?? 0,
        }));
        res.json({ data: { items, factor, limit } });
    }
    catch (err) {
        captureCyberChessError(err, { route: "cpi/leaderboard" });
        console.error("[CyberchessCPI] leaderboard:", err);
        res.status(500).json({ error: "cpi_leaderboard_failed" });
    }
});
// POST /api/cyberchess/cpi/upsert
// Body: { userId, factors: {...11 floats...}, gamesPlayed, displayName? }
// Trust-based MVP (no auth) — upserts the row idempotently.
exports.cyberchessRouter.post("/cpi/upsert", async (req, res) => {
    await ensureCpiDb();
    if (!cpiDbReady) {
        return res.status(503).json({ error: "cpi_db_not_ready" });
    }
    const { userId, factors, gamesPlayed, displayName } = (req.body ?? {});
    if (typeof userId !== "string" || userId.length === 0) {
        return res.status(400).json({ error: "userId (string) required" });
    }
    if (!factors || typeof factors !== "object") {
        return res.status(400).json({ error: "factors (object) required" });
    }
    const games = Number(gamesPlayed);
    const gp = Number.isFinite(games) && games >= 0 ? Math.floor(games) : 0;
    const data = {
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
        const { rows } = await cpiPool.query(`INSERT INTO "CyberchessCpiState" (${insertCols}) VALUES (${insertVals})
       ON CONFLICT ("userId") DO UPDATE SET ${setClauses}, "updatedAt" = now()
       RETURNING *`, [userId, ...vals]);
        res.status(200).json({ data: rows[0] ?? null });
    }
    catch (err) {
        captureCyberChessError(err, { route: "cpi/upsert" });
        console.error("[CyberchessCPI] upsert:", err);
        res.status(500).json({ error: "cpi_upsert_failed" });
    }
});
// GET /api/cyberchess/cpi/me?userId=...
// Returns current state of a single user, or null if not present.
exports.cyberchessRouter.get("/cpi/me", async (req, res) => {
    await ensureCpiDb();
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    if (!userId) {
        return res.status(400).json({ error: "userId query param required" });
    }
    if (!cpiDbReady) {
        return res.json({ data: null, offline: true });
    }
    try {
        const { rows } = await cpiPool.query(`SELECT * FROM "CyberchessCpiState" WHERE "userId" = $1 LIMIT 1`, [userId]);
        res.json({ data: rows[0] ?? null });
    }
    catch (err) {
        captureCyberChessError(err, { route: "cpi/me" });
        console.error("[CyberchessCPI] me:", err);
        res.status(500).json({ error: "cpi_me_failed" });
    }
});
