"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetCerts = exports.chessPrizes = exports.royaltyEvents = exports.ecosystemRouter = void 0;
exports.getEcosystemMetrics = getEcosystemMetrics;
exports.ensureEcosystemLoaded = ensureEcosystemLoaded;
exports.scheduleEcosystemPersist = scheduleEcosystemPersist;
const express_1 = require("express");
const authJwt_1 = require("../lib/authJwt");
const csv_1 = require("../lib/csv");
const ecosystemStore_1 = require("../lib/ecosystemStore");
function sendCsv(res, baseName, rows) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send((0, csv_1.csvFromRows)(rows));
}
exports.ecosystemRouter = (0, express_1.Router)();
exports.ecosystemRouter.use(authJwt_1.requireAuth);
// ----------------------------------------------------------------------------
// Persisted ecosystem ledger.
//
// Three separate ledgers, all keyed by user email. The storage backend is
// chosen at runtime by src/lib/ecosystemStore.ts:
//   - Postgres (when DATABASE_URL is set) — append-only tables in
//     ecosystem_royalty_events / ecosystem_chess_prizes / ecosystem_planet_certs.
//   - JSON file (.aevion-data/ecosystem.json) — dev/test fallback.
//
// In-memory arrays keep being a write-through cache for read latency; routes
// mutate them and call scheduleEcosystemPersist() to flush asynchronously.
// ----------------------------------------------------------------------------
exports.royaltyEvents = [];
exports.chessPrizes = [];
exports.planetCerts = [];
function getEcosystemMetrics() {
    return {
        royaltyEvents: exports.royaltyEvents.length,
        chessPrizes: exports.chessPrizes.length,
        planetCerts: exports.planetCerts.length,
        backend: (0, ecosystemStore_1.describeBackend)().kind,
    };
}
let loaded = false;
let loading = null;
async function ensureEcosystemLoaded() {
    if (loaded)
        return;
    if (!loading) {
        loading = (async () => {
            const snap = await (0, ecosystemStore_1.loadSnapshot)();
            exports.royaltyEvents.splice(0, exports.royaltyEvents.length, ...snap.royaltyEvents);
            exports.chessPrizes.splice(0, exports.chessPrizes.length, ...snap.chessPrizes);
            exports.planetCerts.splice(0, exports.planetCerts.length, ...snap.planetCerts);
            loaded = true;
        })();
    }
    await loading;
}
let persistChain = Promise.resolve();
function scheduleEcosystemPersist() {
    const snapshot = {
        royaltyEvents: [...exports.royaltyEvents],
        chessPrizes: [...exports.chessPrizes],
        planetCerts: [...exports.planetCerts],
    };
    persistChain = persistChain
        .then(() => (0, ecosystemStore_1.persistSnapshot)(snapshot))
        .catch((err) => {
        console.error("[ecosystem] persist failed", err);
    });
}
exports.ecosystemRouter.use((_req, _res, next) => {
    ensureEcosystemLoaded()
        .then(() => next())
        .catch(next);
});
function ownerEmail(req) {
    return req.auth?.email ?? "";
}
exports.ecosystemRouter.get("/earnings", (req, res) => {
    const email = ownerEmail(req);
    const r = exports.royaltyEvents.filter((x) => x.email === email);
    const c = exports.chessPrizes.filter((x) => x.email === email);
    const p = exports.planetCerts.filter((x) => x.email === email);
    const sumR = r.reduce((s, x) => s + x.amount, 0);
    const sumC = c.reduce((s, x) => s + x.amount, 0);
    const sumP = p.reduce((s, x) => s + x.amount, 0);
    res.json({
        totals: {
            qright: Math.round(sumR * 100) / 100,
            cyberchess: Math.round(sumC * 100) / 100,
            planet: Math.round(sumP * 100) / 100,
            all: Math.round((sumR + sumC + sumP) * 100) / 100,
        },
        perSource: [
            { source: "qright", amount: sumR, count: r.length, last: r[r.length - 1]?.paidAt ?? null },
            { source: "cyberchess", amount: sumC, count: c.length, last: c[c.length - 1]?.finalizedAt ?? null },
            { source: "planet", amount: sumP, count: p.length, last: p[p.length - 1]?.certifiedAt ?? null },
        ],
    });
});
exports.ecosystemRouter.get("/earnings.csv", (req, res) => {
    const email = ownerEmail(req);
    const r = exports.royaltyEvents.filter((x) => x.email === email);
    const c = exports.chessPrizes.filter((x) => x.email === email);
    const p = exports.planetCerts.filter((x) => x.email === email);
    const round = (n) => Math.round(n * 100) / 100;
    const rows = [
        ["source", "amount_aec", "event_count", "last_at"],
        ["qright", round(r.reduce((s, x) => s + x.amount, 0)), r.length, r[r.length - 1]?.paidAt ?? null],
        ["cyberchess", round(c.reduce((s, x) => s + x.amount, 0)), c.length, c[c.length - 1]?.finalizedAt ?? null],
        ["planet", round(p.reduce((s, x) => s + x.amount, 0)), p.length, p[p.length - 1]?.certifiedAt ?? null],
    ];
    sendCsv(res, "ecosystem-earnings", rows);
});
