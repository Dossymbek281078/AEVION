import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank — Network Leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function LeaderboardOg() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            AEVION · Bank
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#fff",
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Network Leaderboard</span>
            <span style={{ color: "#fbbf24" }}>creators · chess · referrers</span>
          </div>
          <div style={{ fontSize: 24, color: "#cbd5e1", maxWidth: 900, lineHeight: 1.4, display: "flex" }}>
            Top 12 in each lane · refreshed daily · trust-graph-anchored
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
          <Pill rank={1} value="24K AEC" tone="#fbbf24" />
          <Pill rank={2} value="14K AEC" tone="#cbd5e1" />
          <Pill rank={3} value="9K AEC" tone="#d97706" />
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: 2,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            aevion.app/bank/leaderboard
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Pill({ rank, value, tone }: { rank: number; value: string; tone: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px 22px",
        borderRadius: 14,
        background: "rgba(15,23,42,0.7)",
        border: `1px solid ${tone}66`,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: tone, letterSpacing: 2, textTransform: "uppercase", display: "flex" }}>
        #{rank}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginTop: 4, display: "flex" }}>{value}</div>
    </div>
  );
}
