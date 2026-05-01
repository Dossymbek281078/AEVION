/**
 * QShield error reporter — graceful Sentry integration.
 *
 * If SENTRY_DSN is set AND @sentry/node is installed → captures exceptions
 * with QShield-specific tags. Otherwise → silent no-op (errors still get
 * console.error from the route, this layer only adds the upstream report).
 *
 * Lazy-loads @sentry/node so the module can be imported safely even if the
 * package is missing — useful in dev / CI where Sentry is not provisioned.
 */

type SentryClient = {
  init?: (opts: Record<string, unknown>) => void;
  captureException?: (e: unknown, ctx?: Record<string, unknown>) => unknown;
  setTag?: (k: string, v: string) => void;
} | null;

let resolved: SentryClient | undefined;

/**
 * Returns the Sentry client (singleton) or null. Lazy: dynamic require so
 * missing @sentry/node never breaks the app — the function just returns null.
 */
function getSentry(): SentryClient {
  if (resolved !== undefined) return resolved;
  if (!process.env.SENTRY_DSN) {
    resolved = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/node") as SentryClient;
    if (Sentry?.init) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        // qshield-specific release tag if downstream sets one
        release: process.env.QSHIELD_RELEASE || undefined,
      });
    }
    if (Sentry?.setTag) Sentry.setTag("service", "quantum-shield");
    resolved = Sentry;
    return resolved;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[qshield/sentry] @sentry/node not available — skipping error reports:",
        err instanceof Error ? err.message : String(err),
      );
    }
    resolved = null;
    return null;
  }
}

/**
 * Best-effort capture. Always safe to call — never throws, never blocks.
 * Adds QShield-specific tags so dashboards can filter to this service.
 */
export function captureShieldError(
  err: unknown,
  ctx?: { route?: string; shieldId?: string; actorUserId?: string | null },
): void {
  const sentry = getSentry();
  if (!sentry?.captureException) return;
  try {
    sentry.captureException(err, {
      tags: {
        service: "quantum-shield",
        route: ctx?.route ?? "unknown",
        shieldId: ctx?.shieldId ?? "n/a",
      },
      user: ctx?.actorUserId ? { id: ctx.actorUserId } : undefined,
    });
  } catch {
    /* never propagate sentry failures */
  }
}

/** Test helper — clears the cached resolution so unit tests can flip env. */
export function _resetSentryForTests(): void {
  resolved = undefined;
}
