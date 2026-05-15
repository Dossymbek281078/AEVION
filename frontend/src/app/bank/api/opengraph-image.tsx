import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank — API Reference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ApiOg() {
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
          background: "linear-gradient(135deg, #0a0a0f 0%, #0f172a 100%)",
          color: "#fff",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
            }}
          >
            AEVION · Bank API
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: "#fff",
              maxWidth: 1000,
              fontFamily: "sans-serif",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Wallet, transfers,</span>
            <span style={{ color: "#5eead4" }}>signing, ecosystem</span>
          </div>

          <div
            style={{
              padding: "20px 24px",
              borderRadius: 12,
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(94,234,212,0.25)",
              fontSize: 20,
              color: "#94a3b8",
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ color: "#5eead4", fontWeight: 800, display: "flex" }}>POST</span>
              <span style={{ color: "#fff", display: "flex" }}>/api/qtrade/transfer</span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ color: "#fbbf24", fontWeight: 800, display: "flex" }}>GET</span>
              <span style={{ color: "#fff", display: "flex" }}>/api/qtrade/operations</span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ color: "#5eead4", fontWeight: 800, display: "flex" }}>POST</span>
              <span style={{ color: "#fff", display: "flex" }}>/api/qsign/sign</span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: 2,
            textTransform: "uppercase",
            fontFamily: "sans-serif",
            display: "flex",
          }}
        >
          aevion.app/bank/api · curl examples · OpenAPI
        </div>
      </div>
    ),
    { ...size },
  );
}
