"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetPayoutsRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const authJwt_1 = require("../lib/authJwt");
const ecosystem_1 = require("./ecosystem");
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
    res.json({ items });
});
const WEBHOOK_SECRET = process.env.PLANET_WEBHOOK_SECRET || "dev-planet-webhook";
const seenWebhookIds = new Set();
exports.planetPayoutsRouter.post("/payouts/certify-webhook", async (req, res) => {
    const provided = req.headers["x-planet-secret"];
    const tokenStr = Array.isArray(provided) ? provided[0] : provided;
    if (!tokenStr || tokenStr !== WEBHOOK_SECRET) {
        return res.status(401).json({ error: "invalid webhook secret" });
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
