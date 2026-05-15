import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION CyberChess — Your CPI Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const chips = [
    { name: "SVG графики", color: "#a78bfa", icon: "📊" },
    { name: "Sparklines", color: "#a78bfa", icon: "📈" },
    { name: "Tips", color: "#a78bfa", icon: "🎓" },
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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 800 }}>A</div>
        <span style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9" }}>AEVION CyberChess</span>
      </div>

      <div style={{ fontSize: 52, fontWeight: 900, color: "#f1f5f9", textAlign: "center", lineHeight: 1.15, marginBottom: 16 }}>
        Your CPI Dashboard
      </div>
      <div style={{ fontSize: 22, color: "#64748b", textAlign: "center", marginBottom: 52, maxWidth: 980 }}>
        История · breakdown · weak factor → drill recommendation
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {chips.map(c => (
          <div
            key={c.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${c.color}50`,
              background: `${c.color}15`,
            }}
          >
            <span style={{ fontSize: 18 }}>{c.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.name}</span>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 40, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: "#34d399" }} />
        <span style={{ fontSize: 14, color: "#475569" }}>aevion.app/cyberchess/cpi/dashboard</span>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
