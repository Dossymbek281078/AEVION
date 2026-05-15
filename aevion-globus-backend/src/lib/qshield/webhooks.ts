import crypto from "crypto";
import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;

export type ShieldWebhookEvent =
  | "shield.created"
  | "shield.reconstructed"
  | "shield.revoked"
  | "shield.deleted";

let ensured = false;

export async function ensureWebhookTables(pool: PgPool): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShieldWebhook" (
      "id" TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "secret" TEXT NOT NULL,
      "events" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastFiredAt" TIMESTAMPTZ,
      "failureCount" INT NOT NULL DEFAULT 0
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShieldWebhook_owner_idx" ON "QuantumShieldWebhook" ("ownerUserId");`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShieldWebhookDelivery" (
      "id" TEXT PRIMARY KEY,
      "webhookId" TEXT NOT NULL,
      "event" TEXT NOT NULL,
      "succeeded" BOOLEAN NOT NULL,
      "statusCode" INT,
      "errorMessage" TEXT,
      "durationMs" INT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShieldWebhookDelivery_webhook_idx" ON "QuantumShieldWebhookDelivery" ("webhookId", "createdAt" DESC);`,
  );
  ensured = true;
}

const PER_DELIVERY_TIMEOUT_MS = 5_000;

export function signWebhookBody(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Fire-and-forget: enqueues an immediate POST to every active subscription
 * matching (ownerUserId, event). Failures are logged in
 * QuantumShieldWebhookDelivery but do not retry — for retries, prefer the
 * QSign v2 webhook queue infrastructure.
 *
 * Headers stamped per delivery:
 *   X-QShield-Event, X-QShield-Signature, X-QShield-Webhook-Id, X-QShield-Delivery-Id
 */
export function fireShieldWebhook(
  pool: PgPool,
  ownerUserId: string | null | undefined,
  event: ShieldWebhookEvent,
  data: Record<string, unknown>,
): void {
  if (!ownerUserId) return;
  setImmediate(() => {
    deliverAll(pool, ownerUserId, event, data).catch((err: unknown) => {
      console.warn(
        "[qshield-webhook] enqueue failed:",
        err instanceof Error ? err.message : String(err),
      );
    });
  });
}

async function deliverAll(
  pool: PgPool,
  ownerUserId: string,
  event: ShieldWebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  await ensureWebhookTables(pool);
  const { rows } = await pool.query(
    `SELECT "id","url","secret","events" FROM "QuantumShieldWebhook"
     WHERE "ownerUserId" = $1 AND "active" = TRUE`,
    [ownerUserId],
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
            "X-QShield-Event": event,
            "X-QShield-Signature": sig,
            "X-QShield-Webhook-Id": row.id,
            "X-QShield-Delivery-Id": deliveryId,
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
          `INSERT INTO "QuantumShieldWebhookDelivery"
            ("id","webhookId","event","succeeded","statusCode","errorMessage","durationMs")
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [deliveryId, row.id, event, succeeded, statusCode, errorMessage, durationMs],
        );
        if (succeeded) {
          await pool.query(
            `UPDATE "QuantumShieldWebhook" SET "lastFiredAt" = NOW(), "failureCount" = 0 WHERE "id" = $1`,
            [row.id],
          );
        } else {
          await pool.query(
            `UPDATE "QuantumShieldWebhook" SET "failureCount" = "failureCount" + 1 WHERE "id" = $1`,
            [row.id],
          );
        }
      } catch (logErr: unknown) {
        console.warn(
          "[qshield-webhook] delivery log failed:",
          logErr instanceof Error ? logErr.message : String(logErr),
        );
      }
    }),
  );
}
