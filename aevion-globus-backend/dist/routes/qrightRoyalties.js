"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrightRoyaltiesRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const authJwt_1 = require("../lib/authJwt");
const csv_1 = require("../lib/csv");
const pagination_1 = require("../lib/pagination");
const webhookSig_1 = require("../lib/webhookSig");
const qsignSecret_1 = require("../lib/qsignSecret");
const dbPool_1 = require("../lib/dbPool");
const ecosystem_1 = require("./ecosystem");
const qtrade_1 = require("./qtrade");
// QRightObject.kind ("code" | "text" | "image" | "music" | "movie" | "design"
// | "other", see QRIGHT_KINDS in qright.ts) -> the frontend bank dashboard's
// IPKind ("music" | "photo" | "code" | "design" | "writing" | "video"). The
// two vocabularies grew independently; this is the one place that bridges
// them for the /royalties/summary aggregate below.
const KIND_TO_IP_KIND = {
    code: "code",
    text: "writing",
    image: "photo",
    music: "music",
    movie: "video",
    design: "design",
    other: "design",
};
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
// Aggregate view for the bank dashboard's Royalty Stream widget (see
// frontend/src/app/bank/_lib/royalties.ts — item 2 of its TODO). Shapes the
// flat royalty ledger into { works, recentEvents, avgPerDay7d/30d,
// estimated30d } so the widget can render real payouts once they exist,
// falling back to its own client-side demo generator when a caller has
// none yet (hasRealData: false).
exports.qrightRoyaltiesRouter.get("/royalties/summary", authJwt_1.requireAuth, async (req, res) => {
    await (0, ecosystem_1.ensureEcosystemLoaded)();
    const email = ownerEmail(req);
    const events = ecosystem_1.royaltyEvents.filter((x) => x.email === email);
    const productKeys = [...new Set(events.map((e) => e.productKey))];
    const objects = new Map();
    if (productKeys.length) {
        try {
            const pool = (0, dbPool_1.getPool)();
            const r = await pool.query(`SELECT id, title, kind, country, "createdAt" FROM "QRightObject" WHERE id = ANY($1::text[])`, [productKeys]);
            for (const row of r.rows) {
                objects.set(row.id, row);
            }
        }
        catch {
            // productKey values that aren't real QRightObject ids (or a fresh DB
            // without the table) just render with the raw key as the title below.
        }
    }
    const works = new Map();
    for (const e of events) {
        const obj = objects.get(e.productKey);
        const existing = works.get(e.productKey);
        if (existing) {
            existing.totalRoyalties += e.amount;
            existing.verifications += 1;
        }
        else {
            works.set(e.productKey, {
                id: e.productKey,
                title: obj?.title ?? e.productKey,
                kind: KIND_TO_IP_KIND[obj?.kind ?? ""] ?? "code",
                registeredAt: obj?.createdAt ?? e.paidAt,
                totalRoyalties: e.amount,
                verifications: 1,
            });
        }
    }
    const recentEvents = [...events]
        .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
        .slice(0, 50)
        .map((e) => {
        const obj = objects.get(e.productKey);
        return {
            id: e.id,
            workId: e.productKey,
            workTitle: obj?.title ?? e.productKey,
            workKind: KIND_TO_IP_KIND[obj?.kind ?? ""] ?? "code",
            amount: e.amount,
            verifier: obj?.country ?? "—",
            timestamp: e.paidAt,
        };
    });
    const now = Date.now();
    let sum7 = 0;
    let sum30 = 0;
    for (const e of events) {
        const diff = now - new Date(e.paidAt).getTime();
        if (diff < 7 * 86400000)
            sum7 += e.amount;
        if (diff < 30 * 86400000)
            sum30 += e.amount;
    }
    const avgPerDay7d = sum7 / 7;
    const avgPerDay30d = sum30 / 30;
    const growth = avgPerDay30d > 0 ? Math.max(-0.3, Math.min(0.5, (avgPerDay7d - avgPerDay30d) / avgPerDay30d)) : 0;
    res.json({
        hasRealData: events.length > 0,
        works: [...works.values()].map((w) => ({ ...w, totalRoyalties: +w.totalRoyalties.toFixed(2) })),
        recentEvents,
        avgPerDay7d,
        avgPerDay30d,
        estimated30d: Math.max(0, avgPerDay7d * 30 * (1 + growth)),
    });
});
// Webhook is *not* requireAuth-gated: called by trusted external rights
// services using the shared webhook secret. Resolved lazily through
// requireProdSecret() so prod-misconfig fails per-request, not at boot.
const getWebhookSecret = () => (0, qsignSecret_1.requireProdSecret)("QRIGHT_WEBHOOK_SECRET", "dev-qright-webhook");
const seenWebhookIds = new Set();
exports.qrightRoyaltiesRouter.post("/royalties/verify-webhook", async (req, res) => {
    const verdict = (0, webhookSig_1.verifyWebhookSig)({
        signature: req.headers["x-aevion-signature"],
        timestamp: req.headers["x-aevion-timestamp"],
        legacySecret: req.headers["x-qright-secret"],
        body: req.body,
        secret: getWebhookSecret(),
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
    // Credit the recipient's QTrade account so the royalty actually lands as
    // spendable balance, not just a ledger line. Auto-provisions an account if
    // the recipient doesn't have one yet — a rights body can pay out before
    // the creator has ever opened /qtrade. Failure here is effectively
    // unreachable (amount/email are already validated above) but is treated
    // as non-fatal: the RoyaltyEvent is still recorded with transferId null so
    // /earnings reflects the payout, and it can be reconciled manually.
    const credit = await (0, qtrade_1.internalCreditAccount)({
        owner: email,
        amount: a,
        memo: `Royalty · ${productKey} · ${period}`,
    });
    const ev = {
        id: `roy_${(0, node_crypto_1.randomUUID)()}`,
        email: email.toLowerCase(),
        productKey,
        period,
        amount: a,
        paidAt: new Date().toISOString(),
        transferId: credit.ok ? credit.operationId : null,
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
        transferId: ev.transferId,
        accountId: credit.ok ? credit.accountId : null,
        creditError: credit.ok ? undefined : credit.error,
    });
});
