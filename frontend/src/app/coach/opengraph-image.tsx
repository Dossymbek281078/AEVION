import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Coach — live sessions, goals, AI mentoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PILLARS = [
  { label: "Live sessions", color: "#34d399" },
  { label: "Goal tracker", color: "#a78bfa" },
  { label: "AI mentor", color: "#fbbf24" },
  { label: "Notes & history", color: "#7dd3fc" },
];

export default function CoachOg() {
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
            "radial-gradient(circle at 80% 20%, rgba(52,211,153,0.25), transparent 50%), radial-gradient(circle at 20% 80%, rgba(167,139,250,0.22), transparent 55%), linear-gradient(135deg, #020617 0%, #0f172a 60%, #020617 100%)",
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
              background: "linear-gradient(135deg, #34d399, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 900,
              color: "#020617",
            }}
          >
            C
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#cbd5e1",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Coach
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>One coach.</span>
            <span
              style={{
                background: "linear-gradient(120deg, #34d399 0%, #a78bfa 60%, #fbbf24 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Every session counted.
            </span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#cbd5e1",
              maxWidth: 1000,
              lineHeight: 1.45,
              display: "flex",
            }}
          >
            Live coaching sessions with elapsed timer, goal tracker linked to sessions, notes &
            history — anonymous via clientId, persistent across reloads.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            {PILLARS.map((p) => (
              <div
                key={p.label}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${p.color}55`,
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
                    background: p.color,
                    display: "flex",
                  }}
                />
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", display: "flex" }}>
                  {p.label}
                </div>
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
          <div style={{ display: "flex" }}>aevion.app/coach</div>
          <div style={{ color: "#34d399", display: "flex" }}>Coach · Goals · Mentor</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
