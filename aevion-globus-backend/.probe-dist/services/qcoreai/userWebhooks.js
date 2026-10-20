"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserWebhook = getUserWebhook;
exports.setUserWebhook = setUserWebhook;
exports.deleteUserWebhook = deleteUserWebhook;
exports.validateWebhookUrl = validateWebhookUrl;
const internalHost_1 = require("../../lib/internalHost");
const dbPool_1 = require("../../lib/dbPool");
const ensureQCoreTables_1 = require("../../lib/ensureQCoreTables");
async function getUserWebhook(userId) {
    if (!userId || !(0, ensureQCoreTables_1.isDbReady)())
        return null;
    const pool = (0, dbPool_1.getPool)();
    const result = await pool.query(`SELECT "userId", "url", "secret", "createdAt", "updatedAt"
     FROM "QCoreUserWebhook"
     WHERE "userId" = $1`, [userId]);
    const row = result.rows[0];
    if (!row)
        return null;
    return {
        userId: String(row.userId),
        url: String(row.url),
        secret: typeof row.secret === "string" ? row.secret : null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : "",
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : "",
    };
}
/** Upsert. Returns the new row. */
async function setUserWebhook(userId, url, secret) {
    if (!userId || !(0, ensureQCoreTables_1.isDbReady)())
        return null;
    const pool = (0, dbPool_1.getPool)();
    const result = await pool.query(`INSERT INTO "QCoreUserWebhook" ("userId", "url", "secret")
     VALUES ($1, $2, $3)
     ON CONFLICT ("userId") DO UPDATE
       SET "url" = EXCLUDED."url",
           "secret" = EXCLUDED."secret",
           "updatedAt" = NOW()
     RETURNING "userId", "url", "secret", "createdAt", "updatedAt"`, [userId, url, secret]);
    const row = result.rows[0];
    if (!row)
        return null;
    return {
        userId: String(row.userId),
        url: String(row.url),
        secret: typeof row.secret === "string" ? row.secret : null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : "",
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : "",
    };
}
async function deleteUserWebhook(userId) {
    if (!userId || !(0, ensureQCoreTables_1.isDbReady)())
        return false;
    const pool = (0, dbPool_1.getPool)();
    const result = await pool.query(`DELETE FROM "QCoreUserWebhook" WHERE "userId" = $1`, [userId]);
    return (result.rowCount ?? 0) > 0;
}
/** Lightweight URL validator — must be HTTP(S), not loopback in non-dev envs. */
function validateWebhookUrl(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return null;
    // Block obvious internal targets in production. Override with
    // QCORE_ALLOW_INTERNAL_WEBHOOKS=1 for local dev convenience.
    const allowInternal = process.env.QCORE_ALLOW_INTERNAL_WEBHOOKS === "1";
    if (!allowInternal) {
        if ((0, internalHost_1.isInternalHost)(parsed.hostname))
            return null;
    }
    return parsed.toString();
}
