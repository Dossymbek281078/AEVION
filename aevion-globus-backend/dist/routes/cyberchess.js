"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cyberchessRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const authJwt_1 = require("../lib/authJwt");
const ecosystem_1 = require("./ecosystem");
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
    res.json({ items });
});
// Public list of upcoming tournaments anyone can register for.
// In-memory seed so the UI has something to display before the chess service
// pushes real entries via the webhook below.
const upcomingTournaments = [
    {
        id: "tour_demo_swiss_001",
        startsAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        format: "Swiss · 3+2 · 7 rounds",
        prizePool: 250,
        entries: 32,
        capacity: 64,
    },
    {
        id: "tour_demo_arena_002",
        startsAt: new Date(Date.now() + 3 * 24 * 3600000).toISOString(),
        format: "Arena · 1+0 · 60 min",
        prizePool: 100,
        entries: 14,
        capacity: 100,
    },
];
exports.cyberchessRouter.get("/upcoming", (_req, res) => {
    res.json({ items: upcomingTournaments });
});
// Webhook called by the tournament service when a tournament finalizes.
// Validates a shared secret, then appends a ChessPrize per podium spot.
// Idempotent on (tournamentId, place, email).
const WEBHOOK_SECRET = process.env.CYBERCHESS_WEBHOOK_SECRET || "dev-chess-webhook";
exports.cyberchessRouter.post("/tournament-finalized", async (req, res) => {
    const provided = req.headers["x-cyberchess-secret"];
    const tokenStr = Array.isArray(provided) ? provided[0] : provided;
    if (!tokenStr || tokenStr !== WEBHOOK_SECRET) {
        return res.status(401).json({ error: "invalid webhook secret" });
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
    // Drop the tournament from upcoming once finalized.
    const idx = upcomingTournaments.findIndex((x) => x.id === tournamentId);
    if (idx >= 0)
        upcomingTournaments.splice(idx, 1);
    if (recorded.length > 0)
        (0, ecosystem_1.scheduleEcosystemPersist)();
    res.status(201).json({
        tournamentId,
        recorded,
        replayed,
        finalizedAt: new Date().toISOString(),
    });
});
