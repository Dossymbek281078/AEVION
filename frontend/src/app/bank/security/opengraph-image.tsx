import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Security — Defence in depth, not paperwork";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LAYERS = [
  { glyph: "⌂", label: "On-device", color: "#5eead4" },
  { glyph: "✓", label: "Ed25519", color: "#a78bfa" },
  { glyph: "ⓤ", label: "Biometric", color: "#f472b6" },
  { glyph: "⚠", label: "Anomaly", color: "#fbbf24" },
  { glyph: "↓", label: "Export", color: "#0ea5e9" },
];

export default function SecurityOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at 50% 100%, rgba(244,114,182,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#f472b6",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Security
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Defence in depth,</span>
            <span style={{ color: "#f472b6" }}>not paperwork.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Five independent layers protect every transfer. Cryptographic, behavioural,
            procedural — each fails alone, the rest hold.
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            {LAYERS.map((l) => (
              <div
                key={l.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 18px",
                  borderRadius: 12,
                  background: "rgba(15,23,42,0.55)",
                  border: `1px solid ${l.color}40`,
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${l.color}26`,
                    color: l.color,
                    fontSize: 18,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {l.glyph}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: 1,
                    display: "flex",
                  }}
                >
                  {l.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 16,
            fontWeight: 700,
            color: "#94a3b8",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>aevion.app/bank/security</div>
          <div style={{ color: "#f472b6", display: "flex" }}>5 layers · 0 third-party bureaus</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
