import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Challenges — No-spend streaks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FLAMES = [
  { day: 1, on: true },
  { day: 2, on: true },
  { day: 3, on: true },
  { day: 4, on: true },
  { day: 5, on: true },
  { day: 6, on: false },
  { day: 7, on: true },
];

export default function ChallengesOg() {
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
            "radial-gradient(circle at 25% 70%, rgba(220,38,38,0.25), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#f87171", textTransform: "uppercase", display: "flex" }}>
          AEVION · Challenges
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
            <span>No-spend</span>
            <span style={{ color: "#f87171" }}>streaks.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Pick a category, pick a streak target. The wallet auto-resets when you slip and
            celebrates with you when you don't.
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            {FLAMES.map((f) => (
              <div
                key={f.day}
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 14,
                  background: f.on ? "rgba(248,113,113,0.20)" : "rgba(255,255,255,0.04)",
                  border: f.on ? "2px solid #f87171" : "2px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  color: f.on ? "#f87171" : "rgba(255,255,255,0.20)",
                  fontWeight: 900,
                }}
              >
                {f.on ? "🔥" : "·"}
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
          <div style={{ display: "flex" }}>aevion.app/bank/challenges</div>
          <div style={{ color: "#f87171", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
