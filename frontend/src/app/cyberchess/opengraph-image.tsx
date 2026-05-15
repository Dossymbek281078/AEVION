import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION CyberChess — AI-коуч, CPI рейтинг, 12 вариантов";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const chips = [
    { name: "AI Coach", color: "#34d399", icon: "🧠" },
    { name: "CPI рейтинг", color: "#a78bfa", icon: "📊" },
    { name: "12 вариантов", color: "#f59e0b", icon: "♟️" },
    { name: "Stockfish NNUE", color: "#60a5fa", icon: "⚙️" },
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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 800 }}>♞</div>
        <span style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9" }}>AEVION CyberChess</span>
      </div>

      <div style={{ fontSize: 60, fontWeight: 900, color: "#f1f5f9", textAlign: "center", lineHeight: 1.1, marginBottom: 14 }}>
        Шахматы, в которых
      </div>
      <div style={{ fontSize: 60, fontWeight: 900, color: "#34d399", textAlign: "center", lineHeight: 1.1, marginBottom: 28 }}>
        каждый ход считается
      </div>
      <div style={{ fontSize: 22, color: "#94a3b8", textAlign: "center", marginBottom: 48, maxWidth: 980, lineHeight: 1.4 }}>
        AI-коуч Алексей · Composite Performance Index по 11 факторам · Game DNA · 5800+ пазлов · live-комментарии
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
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
        <span style={{ fontSize: 14, color: "#475569" }}>aevion.app/cyberchess</span>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
