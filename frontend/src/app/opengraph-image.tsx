import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION — Trust infrastructure for digital assets & IP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NODES = [
  { label: "QRight",  desc: "Authorship", color: "#7dd3fc" },
  { label: "QSign",   desc: "Signatures", color: "#a78bfa" },
  { label: "Bureau",  desc: "Certificates", color: "#f472b6" },
  { label: "Planet",  desc: "Validators", color: "#86efac" },
  { label: "Bank",    desc: "AEC payouts", color: "#fbbf24" },
  { label: "Awards",  desc: "Recognition", color: "#c4b5fd" },
];

export default function RootOg() {
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
            "radial-gradient(circle at 15% 20%, rgba(125,211,252,0.25), transparent 50%), radial-gradient(circle at 85% 80%, rgba(167,139,250,0.30), transparent 50%), linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #7dd3fc, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 900,
              color: "#020617",
            }}
          >
            A
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 8, color: "#cbd5e1", textTransform: "uppercase", display: "flex" }}>
            AEVION
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: -3,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Trust infrastructure</span>
            <span
              style={{
                background: "linear-gradient(120deg, #7dd3fc 0%, #a78bfa 50%, #f472b6 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              for digital creation.
            </span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.45, display: "flex" }}>
            27 nodes on one Trust Graph. IP registry, cryptographic signatures, patent bureau,
            validator quorum, creator awards, digital bank — one identity, one pipeline.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            {NODES.map((n) => (
              <div
                key={n.label}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${n.color}55`,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 8,
                    background: n.color,
                    display: "flex",
                  }}
                />
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", display: "flex" }}>
                  {n.label}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", display: "flex" }}>· {n.desc}</div>
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
          <div style={{ display: "flex" }}>aevion.app</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>27 nodes · one Trust Graph</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
