import { signHmac } from "./_lib";
import { kvList, kvSet } from "./_persist";

export type QueuedAttempt = {
  id: string;
  webhook_id: string;
  webhook_url: string;
  webhook_secret: string;
  event: string;
  payload: string;
  attempts: number;
  next_retry_at: number;
  first_attempt_at: number;
  last_attempt_at: number | null;
  last_error: string | null;
  last_http_code: number | null;
  status: "pending" | "delivered" | "failed";
};

const QUEUE_KEY = "webhook.queue.v1";
const QUEUE_CAP = 1000;
const MAX_ATTEMPTS = 6;
// 10s, 30s, 2m, 10m, 1h, 6h
const BACKOFF_MS = [10_000, 30_000, 120_000, 600_000, 3_600_000, 21_600_000];

export async function enqueueAttempt(opts: {
  webhook_id: string;
  webhook_url: string;
  webhook_secret: string;
  event: string;
  payload: string;
  immediate?: boolean;
}): Promise<QueuedAttempt> {
  const now = Date.now();
  const attempt: QueuedAttempt = {
    id: `att_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    webhook_id: opts.webhook_id,
    webhook_url: opts.webhook_url,
    webhook_secret: opts.webhook_secret,
    event: opts.event,
    payload: opts.payload,
    attempts: 0,
    next_retry_at: opts.immediate === false ? now + BACKOFF_MS[0] : now,
    first_attempt_at: now,
    last_attempt_at: null,
    last_error: null,
    last_http_code: null,
    status: "pending",
  };
  const all = await readQueue();
  all.unshift(attempt);
  await persistQueue(all);
  return attempt;
}

export async function readQueue(): Promise<QueuedAttempt[]> {
  return (await kvList<QueuedAttempt>(QUEUE_KEY)) ?? [];
}

async function persistQueue(items: QueuedAttempt[]): Promise<void> {
  await kvSet(QUEUE_KEY, items.slice(0, QUEUE_CAP));
}

async function fireOnce(att: QueuedAttempt): Promise<{
  httpCode: number | null;
  err: string | null;
}> {
  const ts = Math.floor(Date.now() / 1000);
  const sig = signHmac(att.webhook_secret, `${ts}.${att.payload}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  let httpCode: number | null = null;
  let err: string | null = null;
  try {
    const r = await fetch(att.webhook_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aevion-signature": sig,
        "x-aevion-timestamp": String(ts),
        "x-aevion-event": att.event,
        "x-aevion-webhook": att.webhook_id,
        "user-agent": `AEVION-Payments/1.4 attempt=${att.attempts + 1}`,
      },
      body: att.payload,
      signal: ctrl.signal,
    });
    httpCode = r.status;
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }
  return { httpCode, err };
}

export async function processOne(att: QueuedAttempt): Promise<QueuedAttempt> {
  const { httpCode, err } = await fireOnce(att);
  const updated: QueuedAttempt = {
    ...att,
    attempts: att.attempts + 1,
    last_attempt_at: Date.now(),
    last_error: err,
    last_http_code: httpCode,
  };
  if (httpCode !== null && httpCode >= 200 && httpCode < 300) {
    updated.status = "delivered";
    updated.next_retry_at = 0;
  } else if (updated.attempts >= MAX_ATTEMPTS) {
    updated.status = "failed";
    updated.next_retry_at = 0;
  } else {
    const idx = Math.min(updated.attempts - 1, BACKOFF_MS.length - 1);
    updated.next_retry_at = Date.now() + BACKOFF_MS[idx];
  }
  return updated;
}

export type ProcessResult = {
  scanned: number;
  processed: number;
  delivered: number;
  failed: number;
  retrying: number;
};

export async function processDue(maxBatch = 20): Promise<ProcessResult> {
  const all = await readQueue();
  const now = Date.now();
  const due = all
    .filter((a) => a.status === "pending" && a.next_retry_at <= now)
    .slice(0, maxBatch);

  let delivered = 0;
  let failed = 0;
  let retrying = 0;

  for (const a of due) {
    const updated = await processOne(a);
    if (updated.status === "delivered") delivered++;
    else if (updated.status === "failed") failed++;
    else retrying++;
    const idx = all.findIndex((x) => x.id === updated.id);
    if (idx >= 0) all[idx] = updated;
  }
  await persistQueue(all);
  return {
    scanned: all.length,
    processed: due.length,
    delivered,
    failed,
    retrying,
  };
}

export async function queueStats(): Promise<{
  total: number;
  pending: number;
  delivered: number;
  failed: number;
  next_due_in_sec: number | null;
}> {
  const all = await readQueue();
  const now = Date.now();
  const pending = all.filter((a) => a.status === "pending");
  const upcoming = pending
    .map((a) => a.next_retry_at - now)
    .filter((d) => d > 0)
    .sort((x, y) => x - y);
  return {
    total: all.length,
    pending: pending.length,
    delivered: all.filter((a) => a.status === "delivered").length,
    failed: all.filter((a) => a.status === "failed").length,
    next_due_in_sec: upcoming.length > 0 ? Math.ceil(upcoming[0] / 1000) : null,
  };
}
