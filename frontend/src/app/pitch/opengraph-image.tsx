import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION · Investor Pitch — why this is a $1B+ opportunity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function PitchOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #134e4a 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            AEVION · Investor Pitch
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#fff",
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Trust operating system</span>
            <span style={{ color: "#5eead4" }}>for digital creation</span>
          </div>
          <div style={{ fontSize: 26, color: "#cbd5e1", maxWidth: 900, lineHeight: 1.4, display: "flex" }}>
            27 product nodes · 12 live MVPs · one Trust Graph
          </div>
        </div>

        <div style={{ display: "flex", gap: 28 }}>
          <OgStat value="$340B" label="addressable market" />
          <OgStat value="$2B+" label="modelled ARR · year 5" />
          <OgStat value="$1B+" label="defensible valuation" />
          <OgStat value="12" label="live MVPs today" />
        </div>
      </div>
    ),
    { ...size },
  );
}

function OgStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px 22px",
        borderRadius: 14,
        background: "rgba(15,23,42,0.7)",
        border: "1px solid rgba(94,234,212,0.4)",
      }}
    >
      <div style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#5eead4",
          textTransform: "uppercase",
          letterSpacing: 2,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}
