import { createHmac, randomUUID } from "crypto";
import { getPool } from "../lib/dbPool";
import { ensureQCoreTables, isDbReady } from "../lib/ensureQCoreTables";

const pool = getPool();

/** In-memory fallback for webhook logs when DB is unavailable. */
const memWebhookLog: WebhookLogRow[] = [];

export type WebhookLogRow = {
  id: string;
  userId: string | null;
  event: string;
  url: string;
  statusCode: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
};

async function writeWebhookLog(row: Omit<WebhookLogRow, "id" | "createdAt">): Promise<void> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await ensureQCoreTables(pool);
    if (!isDbReady()) {
      memWebhookLog.unshift({ ...row, id, createdAt });
      if (memWebhookLog.length > 200) memWebhookLog.pop();
      return;
    }
    await pool.query(
      `INSERT INTO "QCoreWebhookLog" ("id","userId","event","url","statusCode","durationMs","error")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, row.userId, row.event, row.url, row.statusCode, row.durationMs, row.error]
    );
  } catch { /* non-critical — never let log failures affect delivery */ }
}

export async function listWebhookLogs(userId: string | null, limit = 50): Promise<WebhookLogRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    return userId
      ? memWebhookLog.filter((l) => l.userId === userId).slice(0, limit)
      : memWebhookLog.slice(0, limit);
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreWebhookLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, limit]
  );
  return r.rows as WebhookLogRow[];
}

/**
 * Fire-and-forget webhooks for QCoreAI multi-agent events.
 *
 * Three event types (v2):
 *   run.started   — fired right before the orchestrator pipeline begins
 *   agent.turn    — fired after each agent finishes (analyst / writer / critic)
 *   run.completed — fired when the full run finishes (original v1 event)
 *
 * Configured via env on the backend (single-tenant deploy):
 *   QCORE_WEBHOOK_URL     — required to enable. No URL = silently disabled.
 *   QCORE_WEBHOOK_SECRET  — optional HMAC-SHA256 secret. When set, every POST
 *                            carries `X-QCore-Signature: sha256=<hex>`.
 *
 * Receivers should respond 2xx within 5s. Never retried, never blocks SSE.
 */

export type RunStartedEvent = {
  event: "run.started";
  runId: string;
  sessionId: string;
  strategy: string;
  userInput: string;
  startedAt: string;
};

export type AgentTurnEvent = {
  event: "agent.turn";
  runId: string;
  sessionId: string;
  role: string;
  stage: string;
  instance: string | null;
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number;
  costUsd: number;
  contentPreview: string;
};

export type RunCompletedEvent = {
  event: "run.completed";
  runId: string;
  sessionId: string;
  status: "done" | "stopped" | "error";
  strategy: string;
  userInput: string;
  finalContent: string | null;
  totalDurationMs: number;
  totalCostUsd: number;
  error: string | null;
  finishedAt: string;
};

export type QCoreEvent = RunStartedEvent | AgentTurnEvent | RunCompletedEvent;

/** True iff the env-level (single-tenant) webhook is configured. The UI
 * uses this to show a "🔗 Webhook wired" chip; per-user webhooks render
 * their own indicator since they need auth context. */
export function isWebhookConfigured(): boolean {
  return !!process.env.QCORE_WEBHOOK_URL?.trim();
}

type WebhookTarget = { url: string; secret: string | null; source: "user" | "env" };

function resolveTarget(userOverride?: { url: string; secret: string | null } | null): WebhookTarget | null {
  if (userOverride && userOverride.url) {
    return { url: userOverride.url, secret: userOverride.secret, source: "user" };
  }
  const url = process.env.QCORE_WEBHOOK_URL?.trim();
  if (!url) return null;
  const secret = process.env.QCORE_WEBHOOK_SECRET?.trim() || null;
  return { url, secret, source: "env" };
}

/** Generic fire-and-forget dispatcher for any QCoreEvent. */
export async function notifyEvent(
  evt: QCoreEvent,
  userOverride?: { url: string; secret: string | null } | null,
  userId?: string | null
): Promise<void> {
  const target = resolveTarget(userOverride);
  if (!target) return;

  const body = JSON.stringify(evt);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AEVION-QCoreAI/1.0",
    "X-QCore-Event": evt.event,
    "X-QCore-Webhook-Source": target.source,
  };

  if (target.secret) {
    const sig = createHmac("sha256", target.secret).update(body).digest("hex");
    headers["X-QCore-Signature"] = `sha256=${sig}`;
  }

  const t0 = Date.now();
  try {
    const r = await fetch(target.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    });
    const durationMs = Date.now() - t0;
    if (!r.ok) {
      console.warn(`[QCoreAI] webhook (${target.source}) ${target.url} responded ${r.status} for ${evt.event}:${(evt as any).runId}`);
    }
    void writeWebhookLog({ userId: userId ?? null, event: evt.event, url: target.url, statusCode: r.status, durationMs, error: r.ok ? null : `HTTP ${r.status}` });
  } catch (e: any) {
    const durationMs = Date.now() - t0;
    console.warn(`[QCoreAI] webhook (${target.source}) ${target.url} failed for ${evt.event}: ${e?.message || e}`);
    void writeWebhookLog({ userId: userId ?? null, event: evt.event, url: target.url, statusCode: null, durationMs, error: e?.message || String(e) });
  }
}

/** Backwards-compatible alias — kept so existing callers don't need updating. */
export async function notifyRunCompleted(
  evt: RunCompletedEvent,
  userOverride?: { url: string; secret: string | null } | null
): Promise<void> {
  return notifyEvent(evt, userOverride);
}
