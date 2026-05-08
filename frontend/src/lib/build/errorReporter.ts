// Optional client-side error reporter.
//
// If NEXT_PUBLIC_SENTRY_DSN is set, we lazy-load the Sentry browser SDK
// the first time captureError() is called and forward the error there.
// If not set, we just console.error and return — no extra bundle weight,
// no exceptions thrown.
//
// Why dynamic import: it keeps Sentry out of the main client bundle for
// users who never trigger an error, and also means the absence of the
// @sentry/browser dependency in package.json doesn't break the build.

type SentryShape = {
  init: (cfg: { dsn: string; environment?: string; tracesSampleRate?: number }) => void;
  captureException: (err: unknown) => void;
  captureMessage: (msg: string) => void;
};

let sentry: SentryShape | null = null;
let initStarted = false;

async function ensureSentry(): Promise<SentryShape | null> {
  const dsn =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined;
  if (!dsn) return null;
  if (sentry) return sentry;
  if (initStarted) return null;
  initStarted = true;
  try {
    // The dependency is optional — if it isn't installed, dynamic import
    // throws and we fall back to console-only.
    // @ts-expect-error optional dep
    const mod = await import("@sentry/browser");
    const s = (mod as { default?: SentryShape } & SentryShape).default ?? mod;
    s.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? "production",
      tracesSampleRate: 0,
    });
    sentry = s;
    return sentry;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[errorReporter] Sentry SDK not installed; falling back to console.", e);
    return null;
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.error("[qbuild]", err, context ?? "");
  void ensureSentry().then((s) => {
    if (!s) return;
    try {
      s.captureException(err);
    } catch {
      // Don't let reporting break the page.
    }
  });
}

export function captureMessage(msg: string, context?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.log("[qbuild]", msg, context ?? "");
  void ensureSentry().then((s) => {
    if (!s) return;
    try {
      s.captureMessage(msg);
    } catch {
      // ignore
    }
  });
}
