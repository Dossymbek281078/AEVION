import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QTradeOffline — Offline-first AEV transfers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #0a0e27 100%)",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              padding: "8px 20px",
              background: "rgba(245, 158, 11, 0.2)",
              border: "2px solid #f59e0b",
              borderRadius: 16,
              color: "#fcd34d",
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#64748b" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>QTradeOffline</div>
        </div>

        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#f8fafc" }}>Offline-first</span>
          <span style={{ color: "#fbbf24" }}>AEV transfers</span>
        </div>

        <div
          style={{
            fontSize: 30,
            color: "#cbd5e1",
            lineHeight: 1.4,
            maxWidth: 980,
            marginBottom: 40,
          }}
        >
          Sign with ECDSA P-256 offline · Claim when online · Batch-sync ·
          For low-bandwidth, embargoed, and conflict zones
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
          {[
            { t: "📡 No internet needed", c: "#f59e0b" },
            { t: "🔐 ECDSA P-256", c: "#7c3aed" },
            { t: "🔄 Batch sync", c: "#0891b2" },
            { t: "⚡ AEV native", c: "#dc2626" },
          ].map(p => (
            <div
              key={p.t}
              style={{
                fontSize: 22,
                fontWeight: 600,
                padding: "10px 22px",
                background: `${p.c}33`,
                border: `1px solid ${p.c}`,
                borderRadius: 999,
                color: "#f8fafc",
              }}
            >
              {p.t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
