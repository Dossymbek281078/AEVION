"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cyberchessRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const authJwt_1 = require("../lib/authJwt");
const csv_1 = require("../lib/csv");
const ecosystemStore_1 = require("../lib/ecosystemStore");
const pagination_1 = require("../lib/pagination");
const webhookSig_1 = require("../lib/webhookSig");
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
        res.status(500).json({ error: "tournaments load failed", details: err?.message });
    }
});
// Webhook called by the tournament service when a tournament finalizes.
// Validates a shared secret, then appends a ChessPrize per podium spot.
// Idempotent on (tournamentId, place, email).
const WEBHOOK_SECRET = process.env.CYBERCHESS_WEBHOOK_SECRET || "dev-chess-webhook";
exports.cyberchessRouter.post("/tournament-finalized", async (req, res) => {
    const verdict = (0, webhookSig_1.verifyWebhookSig)({
        signature: req.headers["x-aevion-signature"],
        timestamp: req.headers["x-aevion-timestamp"],
        legacySecret: req.headers["x-cyberchess-secret"],
        body: req.body,
        secret: WEBHOOK_SECRET,
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
