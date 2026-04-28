"use client";

import { useEffect } from "react";

export default function AevError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[AEV page error]", error);
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
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#fff",
        border: "1px solid #334155",
        boxShadow: "0 12px 40px rgba(15,23,42,0.35)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8 }}>
          Что-то пошло не так на /aev
        </h1>
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 14 }}>
          Произошла ошибка при рендеринге AEV-кошелька. Это могло случиться из-за поврежденного состояния
          в localStorage или временного сбоя UI. Попробуй reset secondary state — данные wallet сохранены.
        </p>
        {error.digest && (
          <div style={{
            padding: "6px 10px", borderRadius: 5, marginBottom: 14,
            background: "rgba(0,0,0,0.30)", border: "1px solid #475569",
            fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#94a3b8",
          }}>
            digest: {error.digest}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button onClick={() => reset()}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: "linear-gradient(135deg, #22d3ee, #06b6d4)", color: "#fff",
              fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              boxShadow: "0 2px 8px rgba(6,182,212,0.30)",
            }}>
            ↻ Попробовать снова
          </button>
          <a href="/aev"
            style={{
              padding: "8px 16px", borderRadius: 6,
              border: "1px solid #475569", background: "rgba(255,255,255,0.05)",
              color: "#cbd5e1", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              textDecoration: "none",
            }}>
            ↺ Reload page
          </a>
          <a href="/"
            style={{
              padding: "8px 16px", borderRadius: 6,
              border: "1px solid #475569", background: "rgba(255,255,255,0.05)",
              color: "#cbd5e1", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              textDecoration: "none",
            }}>
            ← На главную
          </a>
        </div>
      </section>
    </main>
  );
}
