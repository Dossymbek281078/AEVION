"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reporter";

export default function QTradeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[QTrade page error]", error);
    reportError(error, "/qtrade", { digest: error.digest });
  }, [error]);

  return (
    <main style={{
      minHeight: "60vh",
      display: "flex", alignItems: "center", justifyContent: "center" as const,
      padding: 24,
    }}>
      <section style={{
        maxWidth: 540, width: "100%",
        padding: 24, borderRadius: 14,
        background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)",
        color: "#fff",
        border: "1px solid #4c1d95",
        boxShadow: "0 12px 40px rgba(67,56,202,0.30)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8 }}>
          Что-то пошло не так на /qtrade
        </h1>
        <p style={{ fontSize: 13, color: "#e0e7ff", lineHeight: 1.5, marginBottom: 14 }}>
          Произошла ошибка при рендеринге trading terminal. Открытые позиции, лимит-ордера и история сохранены —
          попробуй reset, или перезагрузи страницу. Если проблема повторяется, открой /aev → Data management → Export
          для backup и Reset для очистки потенциально поврежденного state.
        </p>
        {error.digest && (
          <div style={{
            padding: "6px 10px", borderRadius: 5, marginBottom: 14,
            background: "rgba(0,0,0,0.30)", border: "1px solid #6366f1",
            fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#a5b4fc",
          }}>
            digest: {error.digest}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button onClick={() => reset()}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: "linear-gradient(135deg, #fff, #e0e7ff)", color: "#4338ca",
              fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              boxShadow: "0 2px 8px rgba(255,255,255,0.20)",
            }}>
            ↻ Попробовать снова
          </button>
          <a href="/qtrade"
            style={{
              padding: "8px 16px", borderRadius: 6,
              border: "1px solid #6366f1", background: "rgba(255,255,255,0.05)",
              color: "#e0e7ff", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              textDecoration: "none",
            }}>
            ↺ Reload page
          </a>
          <a href="/aev"
            style={{
              padding: "8px 16px", borderRadius: 6,
              border: "1px solid #6366f1", background: "rgba(255,255,255,0.05)",
              color: "#e0e7ff", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              textDecoration: "none",
            }}>
            → /aev (data manage)
          </a>
        </div>
      </section>
    </main>
  );
}
