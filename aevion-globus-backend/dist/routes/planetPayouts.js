"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetPayoutsRouter = void 0;
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
// Mounted at /api/planet alongside the existing /api/planet/{stats,artifacts}.
//   GET  /payouts                      — caller's planet certification rewards
//   POST /payouts/certify-webhook      — quorum-passed certification trigger
//
// This is the third and final ecosystem stream — closes the last "mock"
// surface in the bank UI. Webhook is intended to be called by the Planet
// quorum service when an artifact version reaches the certification threshold.
exports.planetPayoutsRouter = (0, express_1.Router)();
function ownerEmail(req) {
    return req.auth?.email ?? "";
}
exports.planetPayoutsRouter.get("/payouts", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const items = ecosystem_1.planetCerts
        .filter((x) => x.email === email)
        .sort((a, b) => (a.certifiedAt < b.certifiedAt ? 1 : -1));
    const { page, nextCursor } = (0, pagination_1.paginate)(items, (0, pagination_1.parsePageOpts)(req));
    res.json({ items: page, total: items.length, nextCursor });
});
exports.planetPayoutsRouter.get("/payouts.csv", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const items = ecosystem_1.planetCerts
        .filter((x) => x.email === email)
        .sort((a, b) => (a.certifiedAt < b.certifiedAt ? 1 : -1));
    const rows = [
        ["id", "artifact_version_id", "amount_aec", "certified_at"],
        ...items.map((x) => [x.id, x.artifactVersionId, x.amount, x.certifiedAt]),
    ];
    sendCsv(res, "planet-payouts", rows);
});
const WEBHOOK_SECRET = process.env.PLANET_WEBHOOK_SECRET || "dev-planet-webhook";
const seenWebhookIds = new Set();
exports.planetPayoutsRouter.post("/payouts/certify-webhook", async (req, res) => {
    const verdict = (0, webhookSig_1.verifyWebhookSig)({
        signature: req.headers["x-aevion-signature"],
        timestamp: req.headers["x-aevion-timestamp"],
        legacySecret: req.headers["x-planet-secret"],
        body: req.body,
        secret: WEBHOOK_SECRET,
    });
    if (!verdict.ok) {
        return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
    }
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const { eventId, email, artifactVersionId, amount } = req.body || {};
    if (typeof eventId !== "string" ||
        typeof email !== "string" ||
        typeof artifactVersionId !== "string") {
        return res.status(400).json({
            error: "eventId, email, artifactVersionId required as strings",
        });
    }
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) {
        return res.status(400).json({ error: "amount must be positive number" });
    }
    if (seenWebhookIds.has(eventId)) {
        const existing = ecosystem_1.planetCerts.find((x) => x.email === email.toLowerCase() &&
            x.artifactVersionId === artifactVersionId);
        return res.status(200).json({
            replayed: true,
            id: existing?.id ?? null,
            eventId,
        });
    }
    const cert = {
        id: `pcert_${(0, node_crypto_1.randomUUID)()}`,
        email: email.toLowerCase(),
        artifactVersionId,
        amount: a,
        certifiedAt: new Date().toISOString(),
        source: "planet",
    };
    ecosystem_1.planetCerts.push(cert);
    seenWebhookIds.add(eventId);
    (0, ecosystem_1.scheduleEcosystemPersist)();
    res.status(201).json({
        replayed: false,
        id: cert.id,
        eventId,
        certifiedAt: cert.certifiedAt,
    });
});
