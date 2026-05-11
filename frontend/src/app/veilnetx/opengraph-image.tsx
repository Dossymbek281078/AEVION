import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VeilNetX — Privacy Proxy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #020617 0%, #0c0a09 50%, #1c1917 100%)",
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
              background: "rgba(6, 182, 212, 0.2)",
              border: "2px solid #06b6d4",
              borderRadius: 16,
              color: "#67e8f9",
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#64748b" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>VeilNetX</div>
        </div>

        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#f8fafc" }}>Privacy.</span>
          <span style={{ color: "#22d3ee" }}>No logs. No KYC.</span>
        </div>

        <div
          style={{ fontSize: 30, color: "#cbd5e1", lineHeight: 1.4, maxWidth: 980, marginBottom: 40 }}
        >
          Tor-routed proxy · end-to-end encryption · anti-fingerprinting ·
          open-source clients (CLI/desktop/mobile)
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
          {[
            { t: "🧅 Tor-routed", c: "#06b6d4" },
            { t: "🔇 No logs", c: "#16a34a" },
            { t: "🪪 No KYC", c: "#a855f7" },
            { t: "🛡 Anti-fingerprint", c: "#f59e0b" },
            { t: "📂 Open-source", c: "#ec4899" },
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
