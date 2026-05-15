// Edge-runtime Sentry init (used by middleware/edge route handlers).
// Skip-if-no-DSN guard.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    enabled: process.env.NODE_ENV !== "test",
  });
}
