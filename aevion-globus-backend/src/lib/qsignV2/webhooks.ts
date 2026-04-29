import crypto from "crypto";
import { getPool } from "../dbPool";
import { ensureQSignV2Tables } from "./ensureTables";

const pool = getPool();

export type WebhookEvent = "sign" | "revoke";

export type FireRow = {
  id: string;
  url: string;
  secret: string;
  events: string;
};

/* Backoff plan — index = attempts already completed.
 * After attempt 1 fails (retryable) → wait 5s before attempt 2.
 * After attempt 2 fails (retryable) → wait 30s before attempt 3.
 * Total ceiling ~35s of retry budget per delivery before "failed". */
export const RETRY_DELAYS_MS = [0, 5_000, 30_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const PER_ATTEMPT_TIMEOUT_MS = 5_000;
const WORKER_TICK_MS = 5_000;
const WORKER_BATCH_SIZE = 50;

export type AttemptOutcome =
  | { kind: "success"; status: number; durationMs: number }
  | { kind: "client_error"; status: number; durationMs: number; error: string }
  | { kind: "server_error"; status: number; durationMs: number; error: string }
  | { kind: "network_error"; durationMs: number; error: string };

export type NextStep =
  | { kind: "done" }
  | { kind: "failed"; reason: "client_error" | "exhausted" }
  | { kind: "retry"; nextAttemptAt: Date };

/**
 * Pure state-machine helper: given the attempt number that just completed
 * (1-indexed) and its outcome, decide what to write back to the queue row.
 * Has no side effects — unit-tested in isolation in tests/qsignV2.webhookRetry.test.ts.
 */
export function planNextStep(
  attemptCompleted: number,
  outcome: AttemptOutcome,
  now: Date = new Date(),
): NextStep {
  if (outcome.kind === "success") return { kind: "done" };
  if (outcome.kind === "client_error") return { kind: "failed", reason: "client_error" };

  // server_error or network_error → retryable
  if (attemptCompleted >= MAX_ATTEMPTS) {
    return { kind: "failed", reason: "exhausted" };
  }
  // RETRY_DELAYS_MS[attemptCompleted] is the delay before the *next* attempt
  // (e.g. after attempt 1 → index 1 → 5s; after attempt 2 → index 2 → 30s).
  const delay = RETRY_DELAYS_MS[attemptCompleted] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  return { kind: "retry", nextAttemptAt: new Date(now.getTime() + delay) };
}

/**
 * Enqueue a webhook event for every active subscription matching the user
 * + event. Body shape:
 *   { event, timestamp: ISO, data }
 *
 * Headers added per delivery attempt (worker stamps these):
 *   X-QSign-Event, X-QSign-Signature, X-QSign-Webhook-Id, X-QSign-Attempt
 *
 * Best-effort, fully async — caller's HTTP response returns immediately.
 * Each matching webhook gets exactly one queue row; the background worker
 * is responsible for delivery + retries + audit logging. Retries survive
 * a process restart because state lives in QSignWebhookQueue.
 */
export function fireWebhooksFor(
  ownerUserId: string | null | undefined,
  event: WebhookEvent,
  data: Record<string, unknown>,
): void {
  if (!ownerUserId) return;
  setImmediate(() => {
    enqueueDeliveries(ownerUserId, event, data).catch((e) => {
      console.error("[qsign v2] webhook enqueue failed", (e as any)?.message);
    });
  });
}

async function enqueueDeliveries(
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

    try {
      await pool.query(
        `INSERT INTO "QSignWebhookQueue"
           ("id","webhookId","event","payload","signature","attempts","nextAttemptAt","status")
         VALUES ($1,$2,$3,$4,$5,0,NOW(),'pending')`,
        [crypto.randomUUID(), row.id, event, payload, sig],
      );
    } catch (e) {
      console.error("[qsign v2] webhook enqueue insert failed", (e as any)?.message);
    }
  }

  // Kick the worker so the happy path doesn't wait for the next tick (≤5s).
  setImmediate(() => {
    processQueue().catch(() => {
      /* worker logs internally */
    });
  });
}

type QueueRow = {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  signature: string;
  attempts: number;
  url: string;
};

/**
 * Drain due rows once. Picks up to WORKER_BATCH_SIZE rows where
 * status='pending' AND nextAttemptAt<=NOW(), runs each HTTP attempt,
 * writes one audit row per attempt to QSignWebhookDelivery, and updates
 * the queue row to 'done' / 'failed' or schedules the next retry.
 *
 * Idempotent and re-entrant — used both by the periodic worker tick
 * and as an immediate kick after enqueue.
 */
export async function processQueue(): Promise<void> {
  let due: QueueRow[];
  try {
    const r = (await pool.query(
      `SELECT q."id", q."webhookId", q."event", q."payload", q."signature", q."attempts", w."url"
       FROM "QSignWebhookQueue" q
       JOIN "QSignWebhook" w ON w."id" = q."webhookId"
       WHERE q."status" = 'pending'
         AND q."nextAttemptAt" <= NOW()
         AND w."active" = TRUE
       ORDER BY q."nextAttemptAt"
       LIMIT $1`,
      [WORKER_BATCH_SIZE],
    )) as any;
    due = r.rows as QueueRow[];
  } catch (e) {
    console.error("[qsign v2] webhook queue scan failed", (e as any)?.message);
    return;
  }
  if (!due.length) return;

  for (const row of due) {
    await deliverOne(row);
  }
}

async function deliverOne(row: QueueRow): Promise<void> {
  const attemptNo = row.attempts + 1;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PER_ATTEMPT_TIMEOUT_MS);
  const start = Date.now();

  let outcome: AttemptOutcome;
  try {
    const res = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AEVION-QSign-v2-webhook",
        "X-QSign-Event": row.event,
        "X-QSign-Signature": row.signature,
        "X-QSign-Webhook-Id": row.webhookId,
        "X-QSign-Attempt": String(attemptNo),
      },
      body: row.payload,
      signal: ac.signal,
    });
    const durationMs = Date.now() - start;
    if (res.ok) {
      await res.text().catch(() => "");
      outcome = { kind: "success", status: res.status, durationMs };
    } else {
      const txt = await res.text().catch(() => "");
      const error = `HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`;
      if (res.status >= 500 && res.status < 600) {
        outcome = { kind: "server_error", status: res.status, durationMs, error };
      } else {
        outcome = { kind: "client_error", status: res.status, durationMs, error };
      }
    }
  } catch (e: any) {
    const durationMs = Date.now() - start;
    const error =
      e?.name === "AbortError"
        ? "timeout (5s)"
        : (e?.message || String(e)).slice(0, 200);
    outcome = { kind: "network_error", durationMs, error };
  } finally {
    clearTimeout(timer);
  }

  // 1. Audit row — one per attempt, contract identical to legacy impl.
  const auditStatus =
    outcome.kind === "success" || outcome.kind === "client_error" || outcome.kind === "server_error"
      ? outcome.status
      : null;
  const auditError = outcome.kind === "success" ? null : outcome.error;
  const succeeded = outcome.kind === "success";
  try {
    await pool.query(
      `INSERT INTO "QSignWebhookDelivery"
         ("id","webhookId","event","attempt","httpStatus","error","durationMs","succeeded")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        crypto.randomUUID(),
        row.webhookId,
        row.event,
        attemptNo,
        auditStatus,
        auditError,
        outcome.durationMs,
        succeeded,
      ],
    );
  } catch {
    /* secondary failure — primary delivery is what matters */
  }

  // 2. Queue update — done / failed / retry.
  const next = planNextStep(attemptNo, outcome);
  try {
    if (next.kind === "done") {
      await pool.query(
        `UPDATE "QSignWebhookQueue"
         SET "status"='done', "attempts"=$1, "lastError"=NULL, "updatedAt"=NOW()
         WHERE "id"=$2`,
        [attemptNo, row.id],
      );
    } else if (next.kind === "failed") {
      await pool.query(
        `UPDATE "QSignWebhookQueue"
         SET "status"='failed', "attempts"=$1, "lastError"=$2, "updatedAt"=NOW()
         WHERE "id"=$3`,
        [attemptNo, auditError, row.id],
      );
    } else {
      await pool.query(
        `UPDATE "QSignWebhookQueue"
         SET "attempts"=$1, "nextAttemptAt"=$2, "lastError"=$3, "updatedAt"=NOW()
         WHERE "id"=$4`,
        [attemptNo, next.nextAttemptAt, auditError, row.id],
      );
    }
  } catch {
    /* secondary — next tick will pick up the row again */
  }

  // 3. Webhook summary row — same shape as legacy fireWebhooksFor wrote.
  try {
    await pool.query(
      `UPDATE "QSignWebhook"
       SET "lastFiredAt"=NOW(), "lastStatus"=$1, "lastError"=$2
       WHERE "id"=$3`,
      [auditStatus, succeeded ? null : auditError, row.webhookId],
    );
  } catch {
    /* secondary */
  }
}

let workerTimer: NodeJS.Timeout | null = null;

/**
 * Boot the periodic queue drain. Idempotent — calling twice is a no-op.
 * Wakes every WORKER_TICK_MS to scan for due deliveries; fast path is also
 * triggered immediately from fireWebhooksFor() so the happy case has no
 * extra latency. Survives partial failures because the row stays
 * 'pending' until explicitly transitioned to 'done' / 'failed'.
 */
export function startWebhookWorker(): void {
  if (workerTimer) return;
  // Make sure tables exist before the first tick (cheap if already ensured).
  ensureQSignV2Tables(pool).catch(() => {
    /* ensureTables logs internally; worker will still try */
  });
  workerTimer = setInterval(() => {
    processQueue().catch(() => {
      /* logged internally */
    });
  }, WORKER_TICK_MS);
  workerTimer.unref?.();
}

export function stopWebhookWorker(): void {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}
