// Lightweight client-side error reporter. Sends payload to /api/errors via
// sendBeacon (non-blocking) with fetch fallback. No third-party deps —
// Sentry mirroring lives in `@/lib/sentry` and is wired by the platform-wide
// SentryInit boundary, so callers don't need to double-report here.

export type ErrorReport = {
  message: string;
  digest?: string;
  stack?: string;
  scope?: string;
  ts: number;
  path?: string;
  ua?: string;
  buildId?: string;
};

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
  } catch {
    // never throw from reporter
  }
}
