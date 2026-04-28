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
  status: "done" | "stopped" | "error" | "capped";
  strategy: string;
  userInput: string;
  finalContent: string | null;
  totalDurationMs: number;
  totalCostUsd: number;
  error: string | null;
  finishedAt: string;
};

export function isWebhookConfigured(): boolean {
  return !!process.env.QCORE_WEBHOOK_URL?.trim();
}

export type WebhookTarget = {
  url: string;
  secret?: string | null;
  /** Origin tag for log lines: "env" (global) or "user" (per-user override). */
  origin: "env" | "user";
};

async function postOne(evt: RunCompletedEvent, target: WebhookTarget): Promise<void> {
  const body = JSON.stringify(evt);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AEVION-QCoreAI/1.0",
    "X-QCore-Event": "run.completed",
    "X-QCore-Origin": target.origin,
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
      console.warn(
        `[QCoreAI] webhook(${target.origin}) ${target.url} responded ${r.status} for run ${evt.runId}`
      );
    }
  } catch (e: any) {
    console.warn(
      `[QCoreAI] webhook(${target.origin}) ${target.url} failed for run ${evt.runId}: ${e?.message || e}`
    );
  }
}

/**
 * Fan-out an event to all targets. The env-based target (if configured) and
 * any extra per-user webhook targets are posted in parallel. Failures do not
 * propagate.
 */
export async function notifyRunCompleted(
  evt: RunCompletedEvent,
  extraTargets: WebhookTarget[] = []
): Promise<void> {
  const url = process.env.QCORE_WEBHOOK_URL?.trim();
  const targets: WebhookTarget[] = [];
  if (url) {
    targets.push({
      url,
      secret: process.env.QCORE_WEBHOOK_SECRET?.trim() || null,
      origin: "env",
    });
  }
  for (const t of extraTargets) {
    if (!t.url || typeof t.url !== "string") continue;
    targets.push({ url: t.url, secret: t.secret ?? null, origin: t.origin });
  }
  if (targets.length === 0) return;
  await Promise.allSettled(targets.map((t) => postOne(evt, t)));
}
