/**
 * Thin Sentry wrapper for QSign v2 — opt-in via SENTRY_DSN env var.
 *
 * - If SENTRY_DSN is unset/empty → all calls become no-ops. No init, no
 *   network IO, no perf cost. The skip-if-no-DSN pattern matches how Sentry
 *   is wired across the rest of AEVION (QTrade, Bank).
 * - If SENTRY_DSN is set → Sentry.init() runs once on first call to
 *   initSentry(); subsequent calls are idempotent.
 * - Tracing is OFF by default (tracesSampleRate=0). Errors only. Set
 *   SENTRY_TRACES_SAMPLE_RATE in env to enable distributed tracing later.
 *
 * Usage:
 *   - bootstrap once in src/index.ts via initSentry()
 *   - call captureException(err, ctx) from any 5xx path
 */

import * as Sentry from "@sentry/node";

let active = false;

/**
 * Idempotent boot hook. Reads SENTRY_DSN; if absent or empty, leaves the
 * module dormant and returns false. If present, runs Sentry.init() with
 * the QSign v2 service tag and returns true.
 */
export function initSentry(): boolean {
  if (active) return true;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;

  const env = process.env.NODE_ENV || "development";
  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");

  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    serverName: process.env.RAILWAY_SERVICE_NAME || "aevion-globus-backend",
    initialScope: {
      tags: { service: "qsign-v2" },
    },
  });

  active = true;
  console.log(`[qsign v2] Sentry initialized (env=${env}, tracing=${tracesSampleRate})`);
  return true;
}

export function isSentryActive(): boolean {
  return active;
}

/**
 * Forward an error to Sentry with structured request context. No-op when
 * Sentry is dormant. Never throws — secondary failure (Sentry SDK error)
 * is swallowed so primary error path is unaffected.
 */
export function captureException(
  err: unknown,
  context: Record<string, unknown> = {},
): void {
  if (!active) return;
  try {
    Sentry.withScope((scope: { setExtra: (k: string, v: unknown) => void; setTag: (k: string, v: string) => void }) => {
      for (const [k, v] of Object.entries(context)) {
        if (v === undefined || v === null) continue;
        scope.setExtra(k, v);
      }
      if (typeof context.requestId === "string") {
        scope.setTag("requestId", context.requestId);
      }
      if (typeof context.errorCode === "string") {
        scope.setTag("errorCode", context.errorCode);
      }
      Sentry.captureException(err);
    });
  } catch {
    /* secondary — ignore so caller's error path is unaffected */
  }
}

/**
 * Best-effort flush before process exit. Awaits up to `timeoutMs` for
 * pending events to leave. Safe to call when dormant (returns immediately).
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!active) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* secondary */
  }
}
