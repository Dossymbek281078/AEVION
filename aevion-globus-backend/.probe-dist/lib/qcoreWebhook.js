"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWebhookLogs = listWebhookLogs;
exports.isWebhookConfigured = isWebhookConfigured;
exports.notifyEvent = notifyEvent;
exports.notifyRunCompleted = notifyRunCompleted;
const publicUrlOnly_1 = require("./publicUrlOnly");
const crypto_1 = require("crypto");
const dbPool_1 = require("../lib/dbPool");
const ensureQCoreTables_1 = require("../lib/ensureQCoreTables");
const pool = (0, dbPool_1.getPool)();
/** In-memory fallback for webhook logs when DB is unavailable. */
const memWebhookLog = [];
async function writeWebhookLog(row) {
    const id = (0, crypto_1.randomUUID)();
    const createdAt = new Date().toISOString();
    try {
        await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
        if (!(0, ensureQCoreTables_1.isDbReady)()) {
            memWebhookLog.unshift({ ...row, id, createdAt });
            if (memWebhookLog.length > 200)
                memWebhookLog.pop();
            return;
        }
        await pool.query(`INSERT INTO "QCoreWebhookLog" ("id","userId","event","url","statusCode","durationMs","error")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, row.userId, row.event, row.url, row.statusCode, row.durationMs, row.error]);
    }
    catch { /* non-critical — never let log failures affect delivery */ }
}
async function listWebhookLogs(userId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return userId
            ? memWebhookLog.filter((l) => l.userId === userId).slice(0, limit)
            : memWebhookLog.slice(0, limit);
    }
    const r = await pool.query(`SELECT * FROM "QCoreWebhookLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [userId, limit]);
    return r.rows;
}
/** True iff the env-level (single-tenant) webhook is configured. The UI
 * uses this to show a "🔗 Webhook wired" chip; per-user webhooks render
 * their own indicator since they need auth context. */
function isWebhookConfigured() {
    return !!process.env.QCORE_WEBHOOK_URL?.trim();
}
function resolveTarget(userOverride) {
    if (userOverride && userOverride.url) {
        return { url: userOverride.url, secret: userOverride.secret, source: "user" };
    }
    const url = process.env.QCORE_WEBHOOK_URL?.trim();
    if (!url)
        return null;
    const secret = process.env.QCORE_WEBHOOK_SECRET?.trim() || null;
    return { url, secret, source: "env" };
}
/** Generic fire-and-forget dispatcher for any QCoreEvent. */
async function notifyEvent(evt, userOverride, userId) {
    const target = resolveTarget(userOverride);
    if (!target)
        return;
    const body = JSON.stringify(evt);
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "AEVION-QCoreAI/1.0",
        "X-QCore-Event": evt.event,
        "X-QCore-Webhook-Source": target.source,
    };
    if (target.secret) {
        const sig = (0, crypto_1.createHmac)("sha256", target.secret).update(body).digest("hex");
        headers["X-QCore-Signature"] = `sha256=${sig}`;
    }
    // Проверка стоит ЗДЕСЬ, у самого обращения, а не только при регистрации
    // адреса. Гейт на входе не защищает то, что уже сохранено: адрес мог быть
    // записан до появления проверки, при включённой отдушине для разработки или
    // изменён в обход ручки. Ровно эту щель я 28.08 закрывал в трёх других
    // модулях, а здесь она оставалась.
    //
    // checkPublicUrl разрешает имя и смотрит АДРЕСА, в которые оно ведёт:
    // проверка по строке пропустила бы `evil.example.com`, указывающий на петлю.
    const allowInternal = process.env.QCORE_ALLOW_INTERNAL_WEBHOOKS === "1" || process.env.NODE_ENV === "test";
    if (!allowInternal) {
        const verdict = await (0, publicUrlOnly_1.checkPublicUrl)(target.url);
        if (!verdict.ok) {
            console.warn(`[QCoreAI] webhook (${target.source}) НЕ отправлен: адрес ведёт внутрь (${verdict.reason})`);
            return;
        }
    }
    const t0 = Date.now();
    try {
        const r = await fetch(target.url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(5000),
        });
        const durationMs = Date.now() - t0;
        if (!r.ok) {
            console.warn(`[QCoreAI] webhook (${target.source}) ${target.url} responded ${r.status} for ${evt.event}:${evt.runId}`);
        }
        void writeWebhookLog({ userId: userId ?? null, event: evt.event, url: target.url, statusCode: r.status, durationMs, error: r.ok ? null : `HTTP ${r.status}` });
    }
    catch (e) {
        const durationMs = Date.now() - t0;
        console.warn(`[QCoreAI] webhook (${target.source}) ${target.url} failed for ${evt.event}: ${e?.message || e}`);
        void writeWebhookLog({ userId: userId ?? null, event: evt.event, url: target.url, statusCode: null, durationMs, error: e?.message || String(e) });
    }
}
/** Backwards-compatible alias — kept so existing callers don't need updating. */
async function notifyRunCompleted(evt, userOverride) {
    return notifyEvent(evt, userOverride);
}
