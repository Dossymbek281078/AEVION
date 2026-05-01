import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Integrations — Slack, Google, Salesforce, Zapier, GitHub, Stripe and more";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0ea5e9 130%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>AEVION</span>
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "6px 14px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              color: "#94a3b8",
            }}
          >
            INTEGRATIONS · 20+
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#7dd3fc",
              marginBottom: 12,
            }}
          >
            SLACK · GOOGLE · SALESFORCE · ZAPIER · GITHUB · STRIPE
          </div>
          <h1
            style={{
              fontSize: 80,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            AEVION в любом workflow
          </h1>
          <p
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              margin: 0,
              marginTop: 20,
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            6 категорий · 20+ инструментов · 11 live, 6 beta, 4 soon
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 28 }}>
            <Tile letter="Sl" color="#4a154b" />
            <Tile letter="GW" color="#4285f4" />
            <Tile letter="Sf" color="#00a1e0" />
            <Tile letter="Zp" color="#ff4a00" />
            <Tile letter="Gh" color="#181717" />
            <Tile letter="St" color="#635bff" />
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/integrations</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Tile({ letter, color }: { letter: string; color: string }) {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: "0.04em",
      }}
    >
      {letter}
    </div>
  );
}
