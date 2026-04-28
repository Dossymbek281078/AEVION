import crypto from "crypto";
import { getPool } from "../dbPool";

const pool = getPool();

export type WebhookEvent = "sign" | "revoke";

export type FireRow = {
  id: string;
  url: string;
  secret: string;
  events: string;
};

/* Retry plan — exponential-ish backoff with jitter cap. Triggered on 5xx,
 * AbortError, and network errors. 4xx is a permanent failure (consumer's
 * problem), no retry. */
const RETRY_DELAYS_MS = [0, 5_000, 30_000];

/**
 * Fire all active webhooks for the given user that subscribe to `event`.
 * Best-effort, fully async — never throws back to the caller. Each delivery
 * gets a 5-second timeout per attempt; up to 3 attempts on retryable
 * failures. Per-attempt rows are persisted to QSignWebhookDelivery so
 * operators can audit dead targets via GET /webhooks/:id/deliveries.
 *
 * Body shape:
 *   {
 *     event: "sign" | "revoke",
 *     timestamp: ISO string,
 *     data: { ...event-specific fields }
 *   }
 *
 * Headers added per attempt:
 *   X-QSign-Event: sign | revoke
 *   X-QSign-Signature: HMAC-SHA256(secret, raw-json-body) hex
 *   X-QSign-Webhook-Id: <id>
 *   X-QSign-Attempt: 1 | 2 | 3
 */
export function fireWebhooksFor(
  ownerUserId: string | null | undefined,
  event: WebhookEvent,
  data: Record<string, unknown>,
): void {
  if (!ownerUserId) return;
  // Run in next tick so caller can return its HTTP response immediately.
  setImmediate(() => {
    deliver(ownerUserId, event, data).catch(() => {
      /* swallow — already logged inside deliver */
    });
  });
}

async function deliver(
  ownerUserId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  let rows: FireRow[];
  try {
    const r = (await pool.query(
      `SELECT "id","url","secret","events" FROM "QSignWebhook"
       WHERE "ownerUserId" = $1 AND "active" = TRUE`,
      [ownerUserId],
    )) as any;
    rows = r.rows as FireRow[];
  } catch (e) {
    console.error("[qsign v2] webhook fetch failed", (e as any)?.message);
    return;
  }

  if (!rows.length) return;
  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });

  for (const row of rows) {
    const subscribed = row.events.split(",").map((s) => s.trim());
    if (!subscribed.includes(event)) continue;

    const sig = crypto
      .createHmac("sha256", row.secret)
      .update(payload, "utf8")
      .digest("hex");

    let finalStatus = 0;
    let finalErr: string | null = null;
    let succeeded = false;

    for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 5_000);
      const start = Date.now();
      let status = 0;
      let errMsg: string | null = null;
      let retryable = false;

      try {
        const res = await fetch(row.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "AEVION-QSign-v2-webhook",
            "X-QSign-Event": event,
            "X-QSign-Signature": sig,
            "X-QSign-Webhook-Id": row.id,
            "X-QSign-Attempt": String(attempt),
          },
          body: payload,
          signal: ac.signal,
        });
        status = res.status;
        if (res.ok) {
          // Success — read & discard body so the connection can release.
          await res.text().catch(() => "");
        } else {
          const txt = await res.text().catch(() => "");
          errMsg = `HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`;
          retryable = res.status >= 500 && res.status < 600;
        }
      } catch (e: any) {
        errMsg =
          e?.name === "AbortError"
            ? "timeout (5s)"
            : (e?.message || String(e)).slice(0, 200);
        retryable = true; // network / timeout — always retry
      } finally {
        clearTimeout(timer);
      }

      const durationMs = Date.now() - start;
      const ok = status >= 200 && status < 300;

      try {
        await pool.query(
          `INSERT INTO "QSignWebhookDelivery"
             ("id","webhookId","event","attempt","httpStatus","error","durationMs","succeeded")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            crypto.randomUUID(),
            row.id,
            event,
            attempt,
            status || null,
            errMsg,
            durationMs,
            ok,
          ],
        );
      } catch {
        /* secondary failure — don't bail, primary delivery is what matters */
      }

      finalStatus = status;
      finalErr = errMsg;
      if (ok) {
        succeeded = true;
        break;
      }
      if (!retryable) break;
    }

    try {
      await pool.query(
        `UPDATE "QSignWebhook"
         SET "lastFiredAt" = NOW(), "lastStatus" = $1, "lastError" = $2
         WHERE "id" = $3`,
        [finalStatus || null, succeeded ? null : finalErr, row.id],
      );
    } catch {
      /* secondary failure — already captured per-attempt above */
    }
  }
}
