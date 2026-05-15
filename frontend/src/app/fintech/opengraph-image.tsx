import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Fintech Ecosystem";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const modules = [
    { name: "VeilNetX",  color: "#8b5cf6", icon: "🌀" },
    { name: "QMaskCard", color: "#c4b5fd", icon: "🪪" },
    { name: "QPayNet",   color: "#06b6d4", icon: "💳" },
    { name: "QGood",     color: "#34d399", icon: "💚" },
    { name: "Z-Tide",    color: "#fbbf24", icon: "⚡" },
    { name: "QChainGov", color: "#f472b6", icon: "🗳" },
  ];

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        background: "linear-gradient(135deg, #050810 0%, #0d1320 60%, #050810 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "60px 80px",
      }}
    >
      {/* Logo bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>A</div>
        <span style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9" }}>AEVION Fintech</span>
      </div>

      {/* Headline */}
      <div style={{ fontSize: 52, fontWeight: 900, color: "#f1f5f9", textAlign: "center", lineHeight: 1.15, marginBottom: 16 }}>
        One Financial Fabric
      </div>
      <div style={{ fontSize: 22, color: "#64748b", textAlign: "center", marginBottom: 52 }}>
        Settlement · Masking · Wallets · Charity · Reputation · Governance
      </div>

      {/* Module chips */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {modules.map(m => (
          <div
            key={m.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${m.color}50`,
              background: `${m.color}15`,
            }}
          >
            <span style={{ fontSize: 18 }}>{m.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.name}</span>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 40, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: "#34d399" }} />
        <span style={{ fontSize: 14, color: "#475569" }}>aevion.app/fintech</span>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
