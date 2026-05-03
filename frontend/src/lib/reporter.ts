// Lightweight client-side error reporter. Sends payload to /api/errors via
// sendBeacon (non-blocking) with fetch fallback. Если NEXT_PUBLIC_SENTRY_DSN
// задан — дополнительно зеркалим в Sentry.captureException() (init из
// sentry.client.config.ts уже выполнен глобально).

import * as Sentry from "@sentry/nextjs";

export type ErrorReport = {
  message: string;
  digest?: string;
  stack?: string;
  scope?: string;          // "/aev", "/qtrade", "root", "global"
  ts: number;
  path?: string;
  ua?: string;
  buildId?: string;
};

const SENTRY_ENABLED = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export function reportError(
  err: unknown,
  scope: string,
  extra?: { digest?: string },
): void {
  if (typeof window === "undefined") return;
  try {
    const errObj = err instanceof Error ? err : null;
    const payload: ErrorReport = {
      message: errObj?.message ?? String(err ?? "unknown error"),
      stack: errObj?.stack,
      digest: extra?.digest,
      scope,
      ts: Date.now(),
      path: window.location?.pathname || "/",
      ua: navigator.userAgent,
    };
    const body = JSON.stringify(payload);
    const sent = typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon("/api/errors", body)
      : false;
    if (!sent) {
      fetch("/api/errors", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body,
      }).catch(() => {/* silent */});
    }

    if (SENTRY_ENABLED) {
      try {
        Sentry.withScope((s) => {
          s.setTag("scope", scope);
          if (payload.digest) s.setTag("digest", payload.digest);
          if (payload.path) s.setTag("path", payload.path);
          Sentry.captureException(errObj ?? new Error(payload.message));
        });
      } catch {/* never throw from reporter */}
    }
  } catch {
    // never throw from reporter
  }
}
