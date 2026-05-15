import crypto from "crypto";
import pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

// Shared HMAC-SHA256 webhook delivery primitive used by every AEVION module
// that pushes events to third-party endpoints (QRight, Planet, future: Awards,
// Bureau). The original per-module copies were 99% identical — extracting them
// here keeps the wire contract uniform: same header (X-AEVION-Signature),
// same algorithm (HMAC-SHA256 hex over the raw request body), same 5-second
// timeout, same fire-and-forget logging.
//
// Receivers verify by recomputing HMAC-SHA256(secret, requestBody) and
// comparing against the X-AEVION-Signature header (`sha256=<hex>`).

export type WebhookDeliveryConfig = {
  // Per-module table names (e.g. QRightWebhook + QRightWebhookDelivery).
  webhookTable: string;
  deliveryTable: string;
  // Column on the delivery table that stores the entity FK (e.g. objectId on
  // QRight, certificateId on Planet). Pass null to omit.
  entityColumn: string | null;
  // User-Agent string the receiver sees. Lets ops trace by module.
  userAgent: string;
};

export type DeliveryAttempt = {
  webhookId: string;
  url: string;
  secret: string;
  body: string;          // raw JSON; HMAC is computed over this exact byte stream
  eventType: string;
  entityId: string | null;
  isRetry: boolean;
};

export type DeliveryResult = {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
};

// Best-effort. NEVER throws — even an outright DB failure while writing the
// delivery log is swallowed (warn-logged). The caller's primary flow (revoke,
// finalize, etc.) must not be blocked by a slow or 5xx receiver.
export async function deliverWebhook(
  pool: PgPoolInstance,
  cfg: WebhookDeliveryConfig,
  opts: DeliveryAttempt
): Promise<DeliveryResult> {
  const sig = crypto.createHmac("sha256", opts.secret).update(opts.body).digest("hex");
  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": cfg.userAgent,
        "X-AEVION-Event": opts.eventType,
        "X-AEVION-Signature": `sha256=${sig}`,
      },
      body: opts.body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    statusCode = r.status;
    ok = r.ok;
    if (!r.ok) error = `HTTP ${r.status}`;
  } catch (err) {
    error = (err as Error).message.slice(0, 500);
  }

  // Persist delivery log. If entityColumn is set we include the FK; otherwise
  // we drop the column from the INSERT entirely.
  const entityFragment = cfg.entityColumn ? `, "${cfg.entityColumn}"` : "";
  const entityValue = cfg.entityColumn ? `, $9` : "";
  const params: unknown[] = [
    crypto.randomUUID(),
    opts.webhookId,
    opts.eventType,
    opts.body,
    statusCode,
    ok,
    error,
    opts.isRetry,
  ];
  if (cfg.entityColumn) params.push(opts.entityId);

  pool
    .query(
      `INSERT INTO "${cfg.deliveryTable}"
         ("id", "webhookId", "eventType", "requestBody", "statusCode", "ok", "error", "isRetry"${entityFragment})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8${entityValue})`,
      params
    )
    .catch((e: Error) => {
      console.warn(`[webhook] ${cfg.deliveryTable} insert failed:`, e.message);
    });

  if (ok) {
    pool
      .query(
        `UPDATE "${cfg.webhookTable}" SET "lastDeliveredAt" = NOW(), "lastError" = NULL WHERE "id" = $1`,
        [opts.webhookId]
      )
      .catch(() => {});
  } else {
    pool
      .query(
        `UPDATE "${cfg.webhookTable}" SET "lastFailedAt" = NOW(), "lastError" = $2 WHERE "id" = $1`,
        [opts.webhookId, error || "delivery failed"]
      )
      .catch(() => {});
  }
  return { ok, statusCode, error };
}
