"use client";

/**
 * PreflightBanner — actionable top-of-page banner shown when the /bank UI
 * cannot possibly work because the backend is unreachable, or because the
 * user's stored JWT no longer resolves a session.
 *
 * Hidden when the pre-flight check passes (or has not finished yet — we
 * don't want to flash a red banner on cold start).
 *
 * Two-line layout:
 *   [⚠] One short reason headline
 *       What you can do · Retry · Smoke runner link
 */

import Link from "next/link";
import { usePreflight } from "../_hooks/usePreflight";

export function PreflightBanner() {
  const { ready, backendUp, authValid, ms, recheck } = usePreflight();

  if (!ready) return null;
  if (backendUp && authValid !== false) return null;

  const stale = !backendUp;
  const tokenInvalid = backendUp && authValid === false;

  const headline = stale
    ? "Backend unreachable — bank panels cannot load"
    : tokenInvalid
    ? "Your session has expired — please sign in again"
    : "Pre-flight check failed";

  const detail = stale
    ? "We could not reach /api/health from this device. Check your connection or backend status — every Bank operation is gated on this."
    : tokenInvalid
    ? "The JWT in this browser no longer resolves to a user on the backend. The most likely cause: backend was reset or the token expired."
    : "One or more required endpoints are not responding.";

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        border: "1px solid rgba(220,38,38,0.35)",
        background: "linear-gradient(135deg, rgba(254,226,226,0.85), rgba(254,242,242,0.85))",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 16,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-start",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "#dc2626",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        !
      </span>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#7f1d1d" }}>{headline}</div>
        <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4, lineHeight: 1.5 }}>{detail}</div>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={recheck}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(127,29,29,0.4)",
              background: "#fff",
              color: "#7f1d1d",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            ↻ Retry
          </button>
          {tokenInvalid ? (
            <Link
              href="/auth"
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#7f1d1d",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Sign in
            </Link>
          ) : null}
          <Link
            href="/bank/diagnostics"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(127,29,29,0.3)",
              background: "transparent",
              color: "#7f1d1d",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            View diagnostics →
          </Link>
          <Link
            href="/bank/smoke?auto=1"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(127,29,29,0.3)",
              background: "transparent",
              color: "#7f1d1d",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Open smoke runner →
          </Link>
          {ms != null ? (
            <span style={{ fontSize: 11, color: "#991b1b", fontFamily: "ui-monospace, monospace" }}>
              {ms} ms
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
