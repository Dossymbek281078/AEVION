"use client";

// Last-resort error boundary: replaces the entire layout if even root layout
// throws. Must render its own <html>/<body> per Next.js docs.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06070b",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            AEVION ran into a fatal error.
          </h1>
          <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 14 }}>
            The whole layout couldn&apos;t render. Reload to try again — if it keeps happening, mail
            yahiin1978@gmail.com.
          </p>
          {error?.digest && (
            <p style={{ marginTop: 8, color: "#64748b", fontSize: 11, fontFamily: "monospace" }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              background: "#10b981",
              color: "#022c22",
              fontWeight: 700,
              fontSize: 14,
              border: 0,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
