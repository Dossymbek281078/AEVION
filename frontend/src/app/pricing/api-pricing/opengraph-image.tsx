import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION API Pricing — per-call billing for developers";
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
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #f59e0b 130%)",
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
            API PRICING · DEVELOPERS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#fbbf24",
              marginBottom: 12,
            }}
          >
            QSIGN · QRIGHT · BUREAU · QCOREAI
          </div>
          <h1
            style={{
              fontSize: 84,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            Per-call API pricing
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
            Free quota на каждом endpoint · 4 volume-tier · SDK quickstart за 5 минут.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 28 }}>
            <Item label="$0.30" hint="/1k verify" />
            <Item label="$3.00" hint="/1k sign" />
            <Item label="$15.00" hint="/1k IP register" />
            <Item label="$0.50" hint="/1k LLM tokens" />
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/api-pricing</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Item({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", color: "#fbbf24" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>{hint}</span>
    </div>
  );
}
