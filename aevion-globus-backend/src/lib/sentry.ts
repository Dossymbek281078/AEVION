// Optional Sentry hook. No-op when SENTRY_DSN is unset OR @sentry/node is
// not installed. This lets us wire `captureException` everywhere we want
// observability without forcing the SDK into the dependency tree.
//
// To turn it on:
//   1) npm install @sentry/node
//   2) export SENTRY_DSN=...
//   3) (optional) export SENTRY_TRACES_SAMPLE_RATE=0.05  SENTRY_RELEASE=...
//
// Until both 1) and 2) are true, every call below returns immediately.
//
// Why optional-require and not a hard dep:
//   - @sentry/node pulls a couple of MB of transitive deps for a feature
//     most local + CI runs don't need. Keeping it optional keeps the
//     test container small and dev installs fast.

type SentryLike = {
  init(opts: Record<string, unknown>): void;
  captureException(err: unknown): void;
  captureMessage(msg: string, level?: string): void;
  withScope(cb: (scope: { setExtras(ex: Record<string, unknown>): void }) => void): void;
};

let sentry: SentryLike | null = null;
let inited = false;

function tryInit(): void {
  if (inited) return;
  inited = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/node") as SentryLike;
    sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0"),
      release: process.env.SENTRY_RELEASE,
      environment: process.env.NODE_ENV || "development",
    });
    console.log("[sentry] initialised");
  } catch (e) {
    console.warn(
      "[sentry] SENTRY_DSN set but @sentry/node not installed — install it to enable error capture",
    );
    sentry = null;
  }
}

export function initSentry(): void {
  tryInit();
}

export function isSentryEnabled(): boolean {
  tryInit();
  return sentry !== null;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  tryInit();
  if (!sentry) return;
  try {
    if (context) {
      sentry.withScope((scope) => {
        scope.setExtras(context);
        sentry!.captureException(err);
      });
    } else {
      sentry.captureException(err);
    }
  } catch {
    // never let observability throw into the request path
  }
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info"): void {
  tryInit();
  if (!sentry) return;
  try {
    sentry.captureMessage(msg, level);
  } catch {
    // swallow
  }
}
