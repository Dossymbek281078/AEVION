import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Quantum Shield — Shamir's Secret Sharing + Ed25519 protection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SHARDS = [
  { x: 200, y: 380, label: "S1", primary: true },
  { x: 360, y: 320, label: "S2", primary: true },
  { x: 520, y: 380, label: "S3", primary: false },
  { x: 680, y: 320, label: "S4", primary: false },
  { x: 840, y: 380, label: "S5", primary: false },
];

export default function QuantumShieldOg() {
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
            "radial-gradient(circle at 30% 30%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #020617 0%, #052e2b 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Quantum Shield
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
            <span>Threshold crypto.</span>
            <span style={{ color: "#5eead4" }}>Recoverable, not stealable.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Shamir secret sharing splits your master key across N shards. K of N reconstructs.
            Lose 1, no impact. Lose K-1, still safe. Steal 1 shard, learn nothing.
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 8, height: 110 }}>
            {SHARDS.map((s, i) => (
              <div
                key={i}
                style={{
                  width: 110,
                  height: s.primary ? 110 : 88,
                  borderRadius: 14,
                  background: s.primary
                    ? "linear-gradient(135deg, #14b8a6, #0d9488)"
                    : "rgba(20,184,166,0.10)",
                  border: s.primary ? "2px solid #5eead4" : "1px solid rgba(94,234,212,0.30)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  fontWeight: 900,
                  color: s.primary ? "#022c22" : "#5eead4",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {s.label}
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 24, fontSize: 14, color: "#94a3b8" }}>
              <span style={{ display: "flex", color: "#5eead4", fontWeight: 800 }}>k = 2</span>
              <span style={{ display: "flex" }}>of n = 5</span>
            </div>
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
          <div style={{ display: "flex" }}>aevion.app/quantum-shield</div>
          <div style={{ color: "#5eead4", display: "flex" }}>Shamir · Ed25519 · PQ-ready KDF</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
