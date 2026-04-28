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

export async function notifyRunCompleted(evt: RunCompletedEvent): Promise<void> {
  const url = process.env.QCORE_WEBHOOK_URL?.trim();
  if (!url) return;

  const body = JSON.stringify(evt);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AEVION-QCoreAI/1.0",
    "X-QCore-Event": "run.completed",
  };

  const secret = process.env.QCORE_WEBHOOK_SECRET?.trim();
  if (secret) {
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    headers["X-QCore-Signature"] = `sha256=${sig}`;
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) {
      console.warn(`[QCoreAI] webhook ${url} responded ${r.status} for run ${evt.runId}`);
    }
  } catch (e: any) {
    console.warn(`[QCoreAI] webhook ${url} failed for run ${evt.runId}: ${e?.message || e}`);
  }
}
