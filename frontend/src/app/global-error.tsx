"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reporter";

// Last-resort error boundary: ловит errors в самом root layout.tsx
// Должен включать собственные <html>/<body> (т.к. layout failed).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "global", { digest: error.digest });
  }, [error]);

  return (
    <html lang="ru">
      <body style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center" as const,
        background: "#0f172a",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        padding: 24,
      }}>
        <div style={{
          maxWidth: 480, width: "100%",
          padding: 24, borderRadius: 14,
          background: "#1e293b",
          border: "1px solid #334155",
          textAlign: "center" as const,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💥</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8 }}>
            Critical error
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 14 }}>
            Произошла критическая ошибка в layout. Перезагрузи страницу или попробуй снова.
          </p>
          {error.digest && (
            <div style={{
              padding: "6px 10px", borderRadius: 5, marginBottom: 14,
              background: "rgba(0,0,0,0.30)", border: "1px solid #475569",
              fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#94a3b8",
              textAlign: "left" as const,
            }}>
              digest: {error.digest}
            </div>
          )}
          <button onClick={() => reset()}
            style={{
              padding: "10px 20px", borderRadius: 6, border: "none",
              background: "#22d3ee", color: "#0f172a",
              fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 0.3,
            }}>
            ↻ Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
