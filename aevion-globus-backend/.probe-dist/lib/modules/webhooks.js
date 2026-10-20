"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_WEBHOOK_EVENTS = void 0;
exports.ensureModuleWebhookTables = ensureModuleWebhookTables;
exports.fireModuleWebhook = fireModuleWebhook;
const publicUrlOnly_1 = require("../publicUrlOnly");
const crypto_1 = __importDefault(require("crypto"));
exports.MODULE_WEBHOOK_EVENTS = [
    "module.override.set",
    "module.override.cleared",
];
let ensured = false;
async function ensureModuleWebhookTables(pool) {
    if (ensured)
        return;
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "ModuleWebhook" (
      "id" TEXT PRIMARY KEY,
      "url" TEXT NOT NULL,
      "secret" TEXT NOT NULL,
      "events" TEXT NOT NULL,
      "label" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdBy" TEXT,
      "lastFiredAt" TIMESTAMPTZ,
      "lastError" TEXT,
      "failureCount" INT NOT NULL DEFAULT 0
    );
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "ModuleWebhookDelivery" (
      "id" TEXT PRIMARY KEY,
      "webhookId" TEXT NOT NULL,
      "event" TEXT NOT NULL,
      "moduleId" TEXT,
      "succeeded" BOOLEAN NOT NULL,
      "statusCode" INT,
      "errorMessage" TEXT,
      "durationMs" INT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "ModuleWebhookDelivery_webhook_idx" ON "ModuleWebhookDelivery" ("webhookId", "createdAt" DESC);`);
    ensured = true;
}
const PER_DELIVERY_TIMEOUT_MS = 5000;
function signWebhookBody(secret, body) {
    return crypto_1.default.createHmac("sha256", secret).update(body).digest("hex");
}
/**
 * Fire-and-forget delivery to every active subscription matching the event.
 * Does NOT throw — failures land in ModuleWebhookDelivery and increment the
 * subscriber's failureCount. The caller's primary flow (override PATCH)
 * must not be blocked by a slow or 5xx receiver.
 */
function fireModuleWebhook(pool, event, data) {
    setImmediate(() => {
        deliverAll(pool, event, data).catch((err) => {
            console.warn("[modules-webhook] enqueue failed:", err instanceof Error ? err.message : String(err));
        });
    });
}
async function deliverAll(pool, event, data) {
    await ensureModuleWebhookTables(pool);
    const { rows } = await pool.query(`SELECT "id","url","secret","events" FROM "ModuleWebhook" WHERE "active" = TRUE`);
    if (rows.length === 0)
        return;
    const matches = rows.filter((r) => {
        const list = (r.events || "").split(",").map((s) => s.trim());
        return list.includes("*") || list.includes(event);
    });
    if (matches.length === 0)
        return;
    const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data,
    });
    const moduleId = typeof data.moduleId === "string" ? data.moduleId : null;
    await Promise.all(matches.map(async (row) => {
        const deliveryId = crypto_1.default.randomUUID();
        const t0 = Date.now();
        const sig = signWebhookBody(row.secret, body);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_DELIVERY_TIMEOUT_MS);
        let succeeded = false;
        let statusCode = null;
        let errorMessage = null;
        // Адрес вебхука приходит от пользователя и хранится в базе. Без проверки
        // у самой отправки наш сервер сходит по любому адресу, который ему
        // назвали, — включая петлю, внутреннюю сеть и службу метаданных облака.
        // Проверка стоит ЗДЕСЬ, а не только при регистрации: гейт на входе не
        // защищает то, что уже сохранено.
        //
        // checkPublicUrl разрешает имя и смотрит АДРЕСА, в которые оно ведёт:
        // сверка по строке пропустила бы имя, указывающее на 127.0.0.1.
        const allowInternal = process.env.ALLOW_INTERNAL_WEBHOOKS === "1" || process.env.NODE_ENV === "test";
        if (!allowInternal && !(await (0, publicUrlOnly_1.checkPublicUrl)(row.url)).ok) {
            console.warn(`[webhook] НЕ отправлен: адрес ведёт внутрь — ${row.url}`);
            return;
        }
        try {
            const res = await fetch(row.url, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "AEVION-Modules-Webhook/1.0",
                    "X-AEVION-Event": event,
                    "X-AEVION-Signature": `sha256=${sig}`,
                    "X-AEVION-Webhook-Id": row.id,
                    "X-AEVION-Delivery-Id": deliveryId,
                },
                body,
            });
            statusCode = res.status;
            succeeded = res.ok;
            if (!res.ok)
                errorMessage = `HTTP ${res.status}`;
        }
        catch (e) {
            errorMessage = e instanceof Error ? e.message : String(e);
        }
        finally {
            clearTimeout(timer);
        }
        const durationMs = Date.now() - t0;
        try {
            await pool.query(`INSERT INTO "ModuleWebhookDelivery"
             ("id","webhookId","event","moduleId","succeeded","statusCode","errorMessage","durationMs")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [deliveryId, row.id, event, moduleId, succeeded, statusCode, errorMessage, durationMs]);
            if (succeeded) {
                await pool.query(`UPDATE "ModuleWebhook"
             SET "lastFiredAt" = NOW(), "lastError" = NULL, "failureCount" = 0
             WHERE "id" = $1`, [row.id]);
            }
            else {
                await pool.query(`UPDATE "ModuleWebhook"
             SET "lastError" = $2, "failureCount" = "failureCount" + 1
             WHERE "id" = $1`, [row.id, errorMessage || "delivery failed"]);
            }
        }
        catch (logErr) {
            console.warn("[modules-webhook] delivery log failed:", logErr instanceof Error ? logErr.message : String(logErr));
        }
    }));
}
