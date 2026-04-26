import { createHmac } from "crypto";

/**
 * Fire-and-forget webhook posted when a QCoreAI multi-agent run finishes.
 *
 * Configured via env on the backend (single-tenant deploy):
 *   QCORE_WEBHOOK_URL     — required to enable. No URL = silently disabled.
 *   QCORE_WEBHOOK_SECRET  — optional HMAC-SHA256 secret. When set, every POST
 *                            carries `X-QCore-Signature: sha256=<hex>` so the
 *                            receiver can verify the body wasn't tampered.
 *
 * Receivers (Zapier/Make/internal tools) should respond 2xx within 5s. We
 * never retry and never block the client response — at most we log a line.
 */

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

/** True iff the env-level (single-tenant) webhook is configured. The UI
 * uses this to show a "🔗 Webhook wired" chip; per-user webhooks render
 * their own indicator since they need auth context. */
export function isWebhookConfigured(): boolean {
  return !!process.env.QCORE_WEBHOOK_URL?.trim();
}

type WebhookTarget = { url: string; secret: string | null; source: "user" | "env" };

/**
 * Resolve which webhook (if any) should receive a given run's event.
 *
 *   1. If `userOverride` is provided (the run's user has a stored row),
 *      use that — per-tenant routing.
 *   2. Otherwise fall back to env QCORE_WEBHOOK_URL / QCORE_WEBHOOK_SECRET.
 *   3. Returns null when neither is set — caller is a no-op.
 */
function resolveTarget(userOverride?: { url: string; secret: string | null } | null): WebhookTarget | null {
  if (userOverride && userOverride.url) {
    return { url: userOverride.url, secret: userOverride.secret, source: "user" };
  }
  const url = process.env.QCORE_WEBHOOK_URL?.trim();
  if (!url) return null;
  const secret = process.env.QCORE_WEBHOOK_SECRET?.trim() || null;
  return { url, secret, source: "env" };
}

export async function notifyRunCompleted(
  evt: RunCompletedEvent,
  userOverride?: { url: string; secret: string | null } | null
): Promise<void> {
  const target = resolveTarget(userOverride);
  if (!target) return;

  const body = JSON.stringify(evt);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AEVION-QCoreAI/1.0",
    "X-QCore-Event": "run.completed",
    "X-QCore-Webhook-Source": target.source,
  };

  if (target.secret) {
    const sig = createHmac("sha256", target.secret).update(body).digest("hex");
    headers["X-QCore-Signature"] = `sha256=${sig}`;
  }

  try {
    const r = await fetch(target.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) {
      console.warn(`[QCoreAI] webhook (${target.source}) ${target.url} responded ${r.status} for run ${evt.runId}`);
    }
  } catch (e: any) {
    console.warn(`[QCoreAI] webhook (${target.source}) ${target.url} failed for run ${evt.runId}: ${e?.message || e}`);
  }
}
