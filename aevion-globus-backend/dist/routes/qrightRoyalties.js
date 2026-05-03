"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrightRoyaltiesRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const authJwt_1 = require("../lib/authJwt");
const csv_1 = require("../lib/csv");
const pagination_1 = require("../lib/pagination");
const webhookSig_1 = require("../lib/webhookSig");
const ecosystem_1 = require("./ecosystem");
function sendCsv(res, baseName, rows) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send((0, csv_1.csvFromRows)(rows));
}
// Sub-router intended to be mounted at /api/qright (so it lives under the
// existing namespace alongside the legacy QRight authorship endpoints).
//
//   GET  /royalties                    — list paid royalties for caller
//   POST /royalties/verify-webhook     — idempotent verifier intended to be
//                                        called by external rights bodies;
//                                        appends a new RoyaltyEvent and
//                                        returns the recorded id.
exports.qrightRoyaltiesRouter = (0, express_1.Router)();
function ownerEmail(req) {
    return req.auth?.email ?? "";
}
exports.qrightRoyaltiesRouter.get("/royalties", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const items = ecosystem_1.royaltyEvents
        .filter((x) => x.email === email)
        .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
    const { page, nextCursor } = (0, pagination_1.paginate)(items, (0, pagination_1.parsePageOpts)(req));
    res.json({ items: page, total: items.length, nextCursor });
});
exports.qrightRoyaltiesRouter.get("/royalties.csv", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const items = ecosystem_1.royaltyEvents
        .filter((x) => x.email === email)
        .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
    const rows = [
        ["id", "product_key", "period", "amount_aec", "paid_at", "transfer_id"],
        ...items.map((x) => [x.id, x.productKey, x.period, x.amount, x.paidAt, x.transferId]),
    ];
    sendCsv(res, "qright-royalties", rows);
});
// Webhook is *not* requireAuth-gated: called by trusted external rights
// services using the shared webhook secret. The secret is read from
// QRIGHT_WEBHOOK_SECRET; falls back to a dev value so tests work locally.
const WEBHOOK_SECRET = process.env.QRIGHT_WEBHOOK_SECRET || "dev-qright-webhook";
const seenWebhookIds = new Set();
exports.qrightRoyaltiesRouter.post("/royalties/verify-webhook", async (req, res) => {
    const verdict = (0, webhookSig_1.verifyWebhookSig)({
        signature: req.headers["x-aevion-signature"],
        timestamp: req.headers["x-aevion-timestamp"],
        legacySecret: req.headers["x-qright-secret"],
        body: req.body,
        secret: WEBHOOK_SECRET,
    });
    if (!verdict.ok) {
        return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
    }
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const { eventId, email, productKey, period, amount } = req.body || {};
    if (typeof eventId !== "string" ||
        typeof email !== "string" ||
        typeof productKey !== "string" ||
        typeof period !== "string") {
        return res.status(400).json({ error: "eventId, email, productKey, period required as strings" });
    }
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) {
        return res.status(400).json({ error: "amount must be positive number" });
    }
    // Idempotency: if we've seen this eventId already, return the previously
    // recorded entry so the partner can safely retry.
    if (seenWebhookIds.has(eventId)) {
        const existing = ecosystem_1.royaltyEvents.find((x) => x.email === email.toLowerCase() && x.productKey === productKey && x.period === period);
        return res.status(200).json({
            replayed: true,
            id: existing?.id ?? null,
            eventId,
        });
    }
    const ev = {
        id: `roy_${(0, node_crypto_1.randomUUID)()}`,
        email: email.toLowerCase(),
        productKey,
        period,
        amount: a,
        paidAt: new Date().toISOString(),
        transferId: null, // wiring to /api/qtrade/transfer is a follow-up; for
        // now the event is recorded so /earnings reflects it.
        source: "qright",
    };
    ecosystem_1.royaltyEvents.push(ev);
    seenWebhookIds.add(eventId);
    (0, ecosystem_1.scheduleEcosystemPersist)();
    res.status(201).json({
        replayed: false,
        id: ev.id,
        eventId,
        paidAt: ev.paidAt,
    });
});
