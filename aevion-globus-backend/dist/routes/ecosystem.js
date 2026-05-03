"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetCerts = exports.chessPrizes = exports.royaltyEvents = exports.ecosystemRouter = void 0;
exports.ensureEcosystemLoaded = ensureEcosystemLoaded;
exports.scheduleEcosystemPersist = scheduleEcosystemPersist;
const express_1 = require("express");
const authJwt_1 = require("../lib/authJwt");
const jsonFileStore_1 = require("../lib/jsonFileStore");
exports.ecosystemRouter = (0, express_1.Router)();
exports.ecosystemRouter.use(authJwt_1.requireAuth);
exports.royaltyEvents = [];
exports.chessPrizes = [];
exports.planetCerts = [];
const STORE_REL = "ecosystem.json";
let loaded = false;
let loading = null;
async function ensureEcosystemLoaded() {
    if (loaded)
        return;
    if (!loading) {
        loading = (async () => {
            const data = await (0, jsonFileStore_1.readJsonFile)(STORE_REL, { royaltyEvents: [], chessPrizes: [], planetCerts: [] });
            const r = Array.isArray(data.royaltyEvents) ? data.royaltyEvents : [];
            const c = Array.isArray(data.chessPrizes) ? data.chessPrizes : [];
            const p = Array.isArray(data.planetCerts) ? data.planetCerts : [];
            exports.royaltyEvents.splice(0, exports.royaltyEvents.length, ...r);
            exports.chessPrizes.splice(0, exports.chessPrizes.length, ...c);
            exports.planetCerts.splice(0, exports.planetCerts.length, ...p);
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
        .then(() => (0, jsonFileStore_1.writeJsonFile)(STORE_REL, snapshot))
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
