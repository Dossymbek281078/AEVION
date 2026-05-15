import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Achievements — Badges and milestones";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MEDALS = [
  { ch: "★", color: "#fbbf24" },
  { ch: "✦", color: "#5eead4" },
  { ch: "◆", color: "#a78bfa" },
  { ch: "✧", color: "#0ea5e9" },
  { ch: "♦", color: "#f472b6" },
];

export default function AchievementsOg() {
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
            "radial-gradient(circle at 80% 30%, rgba(251,191,36,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#fbbf24", textTransform: "uppercase", display: "flex" }}>
          AEVION · Achievements
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Earn your</span>
            <span style={{ color: "#fbbf24" }}>milestones.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Unlocked-state badges across spend habits, streams, recurring rules and trust score —
            tracked progress for everything still locked.
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
            {MEDALS.map((m, i) => (
              <div
                key={i}
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 999,
                  background: `${m.color}22`,
                  border: `2px solid ${m.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  color: m.color,
                  fontWeight: 900,
                }}
              >
                {m.ch}
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
          <div style={{ display: "flex" }}>aevion.app/bank/achievements</div>
          <div style={{ color: "#fbbf24", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
