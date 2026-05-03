import crypto from "crypto";
import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;

// Modules webhooks fire on platform-level events (admin override flips).
// Unlike QShield/QRight webhooks they are NOT scoped to a user — module
// state is platform metadata, so any admin-managed subscription receives
// every event of the chosen type. Verification is HMAC-SHA256 hex over
// the raw request body (`X-AEVION-Signature: sha256=<hex>`), matching
// the rest of the AEVION webhook contract.

export type ModuleWebhookEvent = "module.override.set" | "module.override.cleared";

export const MODULE_WEBHOOK_EVENTS: ModuleWebhookEvent[] = [
  "module.override.set",
  "module.override.cleared",
];

let ensured = false;

export async function ensureModuleWebhookTables(pool: PgPool): Promise<void> {
  if (ensured) return;
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
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "ModuleWebhookDelivery_webhook_idx" ON "ModuleWebhookDelivery" ("webhookId", "createdAt" DESC);`
  );
  ensured = true;
}

const PER_DELIVERY_TIMEOUT_MS = 5_000;

function signWebhookBody(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Fire-and-forget delivery to every active subscription matching the event.
 * Does NOT throw — failures land in ModuleWebhookDelivery and increment the
 * subscriber's failureCount. The caller's primary flow (override PATCH)
 * must not be blocked by a slow or 5xx receiver.
 */
export function fireModuleWebhook(
  pool: PgPool,
  event: ModuleWebhookEvent,
  data: Record<string, unknown>
): void {
  setImmediate(() => {
    deliverAll(pool, event, data).catch((err: unknown) => {
      console.warn(
        "[modules-webhook] enqueue failed:",
        err instanceof Error ? err.message : String(err)
      );
    });
  });
}

async function deliverAll(
  pool: PgPool,
  event: ModuleWebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  await ensureModuleWebhookTables(pool);
  const { rows } = await pool.query(
    `SELECT "id","url","secret","events" FROM "ModuleWebhook" WHERE "active" = TRUE`
  );
  if (rows.length === 0) return;
  const matches = rows.filter((r: { events: string }) => {
    const list = (r.events || "").split(",").map((s) => s.trim());
    return list.includes("*") || list.includes(event);
  });
  if (matches.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });
  const moduleId = typeof data.moduleId === "string" ? data.moduleId : null;

  await Promise.all(
    matches.map(async (row: { id: string; url: string; secret: string }) => {
      const deliveryId = crypto.randomUUID();
      const t0 = Date.now();
      const sig = signWebhookBody(row.secret, body);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_DELIVERY_TIMEOUT_MS);
      let succeeded = false;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;
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
        if (!res.ok) errorMessage = `HTTP ${res.status}`;
      } catch (e: unknown) {
        errorMessage = e instanceof Error ? e.message : String(e);
      } finally {
        clearTimeout(timer);
      }
      const durationMs = Date.now() - t0;
      try {
        await pool.query(
          `INSERT INTO "ModuleWebhookDelivery"
             ("id","webhookId","event","moduleId","succeeded","statusCode","errorMessage","durationMs")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [deliveryId, row.id, event, moduleId, succeeded, statusCode, errorMessage, durationMs]
        );
        if (succeeded) {
          await pool.query(
            `UPDATE "ModuleWebhook"
             SET "lastFiredAt" = NOW(), "lastError" = NULL, "failureCount" = 0
             WHERE "id" = $1`,
            [row.id]
          );
        } else {
          await pool.query(
            `UPDATE "ModuleWebhook"
             SET "lastError" = $2, "failureCount" = "failureCount" + 1
             WHERE "id" = $1`,
            [row.id, errorMessage || "delivery failed"]
          );
        }
      } catch (logErr: unknown) {
        console.warn(
          "[modules-webhook] delivery log failed:",
          logErr instanceof Error ? logErr.message : String(logErr)
        );
      }
    })
  );
}
