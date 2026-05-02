// Optional client-side Sentry hook. No-op when NEXT_PUBLIC_SENTRY_DSN is
// unset. Loads the SDK from the official Sentry CDN at runtime — keeps
// the bundle slim and means turning Sentry on is purely an env-var
// change (no `npm install`, no rebuild).
//
// The CDN URL is pinned to a known-good Sentry version. To upgrade,
// bump SENTRY_VERSION below.
//
// Companion to backend's lib/sentry.ts — same on/off contract:
//   1) export NEXT_PUBLIC_SENTRY_DSN=...
//   2) (optional) NEXT_PUBLIC_SENTRY_RELEASE, NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE

declare global {
  interface Window {
    Sentry?: {
      init: (opts: Record<string, unknown>) => void;
      captureException: (err: unknown) => void;
      captureMessage: (msg: string, level?: string) => void;
      withScope?: (cb: (scope: { setExtras(extras: Record<string, unknown>): void }) => void) => void;
    };
  }
}

const SENTRY_VERSION = "8.40.0";
const CDN_URL = `https://browser.sentry-cdn.com/${SENTRY_VERSION}/bundle.min.js`;

let inited = false;
let loadingPromise: Promise<void> | null = null;

export function isFrontendSentryEnabled(): boolean {
  return typeof window !== "undefined" && inited && !!window.Sentry;
}

async function ensureLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;
  if (window.Sentry && inited) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sentry="cdn"]');
    if (existing) {
      // Another tree already requested the script; wait for it to settle.
      if (window.Sentry) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = CDN_URL;
    s.crossOrigin = "anonymous";
    s.dataset.sentry = "cdn";
    s.onload = () => resolve();
    s.onerror = () => {
      // Network blocked / offline — stay no-op, never throw.
      resolve();
    };
    document.head.appendChild(s);
  });

  await loadingPromise;
  if (window.Sentry && !inited) {
    try {
      window.Sentry.init({
        dsn,
        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
        environment: process.env.NEXT_PUBLIC_BANK_MODE || "test",
        tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0"),
      });
      inited = true;
    } catch {
      // never let observability throw into the user's flow
    }
  }
}

export function initFrontendSentry(): void {
  void ensureLoaded();
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  void ensureLoaded().then(() => {
    if (!window.Sentry) return;
    try {
      if (context && window.Sentry.withScope) {
        window.Sentry.withScope((scope) => {
          scope.setExtras(context);
          window.Sentry!.captureException(err);
        });
      } else {
        window.Sentry.captureException(err);
      }
    } catch {
      // swallow
    }
  });
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info"): void {
  if (typeof window === "undefined") return;
  void ensureLoaded().then(() => {
    if (!window.Sentry) return;
    try {
      window.Sentry.captureMessage(msg, level);
    } catch {
      // swallow
    }
  });
}
