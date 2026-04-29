"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetCerts = exports.chessPrizes = exports.royaltyEvents = exports.ecosystemRouter = void 0;
const express_1 = require("express");
const authJwt_1 = require("../lib/authJwt");
exports.ecosystemRouter = (0, express_1.Router)();
exports.ecosystemRouter.use(authJwt_1.requireAuth);
exports.royaltyEvents = [];
exports.chessPrizes = [];
exports.planetCerts = [];
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
