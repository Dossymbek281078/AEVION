"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function BankError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[bank] route error boundary:", error);
  }, [error]);

  return (
    <main>
      <div style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid rgba(220,38,38,0.25)",
            borderRadius: 16,
            padding: 28,
            background: "linear-gradient(135deg, rgba(220,38,38,0.05), rgba(15,23,42,0.03))",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#991b1b",
              marginBottom: 8,
            }}
          >
            Bank — unexpected error
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 10px",
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            Something broke while rendering your wallet.
          </h1>
          <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: "0 0 16px" }}>
            The page failed to load, but your balance, operations and signed audit log are all safe
            on the server. Retry below — if the error keeps coming back, check the console for
            details and report it in <code>#bank-ui</code> with the digest.
          </p>
          {error?.digest ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                color: "#64748b",
                marginBottom: 16,
                wordBreak: "break-all",
              }}
            >
              digest: {error.digest}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <Link
              href="/"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#334155",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
