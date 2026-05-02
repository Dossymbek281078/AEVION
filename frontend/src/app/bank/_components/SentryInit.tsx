"use client";

// Mounted from /bank/layout.tsx — initialises Sentry from CDN if a DSN
// is configured, then wires window.onerror + unhandledrejection so any
// uncaught exception in a /bank/* surface is captured.
//
// Renders nothing. Has no effect if NEXT_PUBLIC_SENTRY_DSN is unset.

import { useEffect } from "react";
import { captureException, initFrontendSentry } from "@/lib/sentry";

export function SentryInit() {
  useEffect(() => {
    initFrontendSentry();

    const onError = (e: ErrorEvent) => {
      captureException(e.error ?? new Error(e.message || "window onerror"), {
        source: "window.onerror",
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      captureException(e.reason ?? new Error("unhandled rejection"), {
        source: "unhandledrejection",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
