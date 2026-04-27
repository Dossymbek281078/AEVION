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

/**
 * Fire all active webhooks for the given user that subscribe to `event`.
 * Best-effort, fully async — never throws back to the caller. Each delivery
 * gets a 5-second timeout and persists last-attempt metadata to the row so
 * operators can spot dead targets via /webhooks list.
 *
 * Body shape:
 *   {
 *     event: "sign" | "revoke",
 *     timestamp: ISO string,
 *     data: { ...event-specific fields }
 *   }
 *
 * Headers added:
 *   X-QSign-Event: sign | revoke
 *   X-QSign-Signature: HMAC-SHA256(secret, raw-json-body) hex
 *   X-QSign-Webhook-Id: <id>
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

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5_000);
    let status = 0;
    let errMsg: string | null = null;
    try {
      const res = await fetch(row.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AEVION-QSign-v2-webhook",
          "X-QSign-Event": event,
          "X-QSign-Signature": sig,
          "X-QSign-Webhook-Id": row.id,
        },
        body: payload,
        signal: ac.signal,
      });
      status = res.status;
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        errMsg = `HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`;
      }
    } catch (e: any) {
      errMsg =
        e?.name === "AbortError"
          ? "timeout (5s)"
          : (e?.message || String(e)).slice(0, 200);
    } finally {
      clearTimeout(timer);
    }

    try {
      await pool.query(
        `UPDATE "QSignWebhook"
         SET "lastFiredAt" = NOW(), "lastStatus" = $1, "lastError" = $2
         WHERE "id" = $3`,
        [status || null, errMsg, row.id],
      );
    } catch {
      /* secondary failure — already logged via fetch path */
    }
  }
}
