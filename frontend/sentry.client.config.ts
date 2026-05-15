// Client-side Sentry init. Skip-if-no-DSN guard: без env-var
// NEXT_PUBLIC_SENTRY_DSN SDK не инициализируется и /api/errors остаётся
// единственным sink'ом. С DSN → reportError() в lib/reporter.ts дополнительно
// зеркалит в Sentry.captureException().
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
    enabled: process.env.NODE_ENV !== "test",
  });
}
