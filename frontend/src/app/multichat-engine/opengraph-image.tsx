import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Multichat — parallel AI agents in one window";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROLES: Array<{ name: string; bg: string; fg: string; border: string }> = [
  { name: "General", bg: "rgba(94,234,212,0.18)", border: "rgba(94,234,212,0.55)", fg: "#5eead4" },
  { name: "Code", bg: "rgba(125,211,252,0.18)", border: "rgba(125,211,252,0.55)", fg: "#7dd3fc" },
  { name: "Finance", bg: "rgba(250,204,21,0.18)", border: "rgba(250,204,21,0.55)", fg: "#facc15" },
  { name: "IP/Legal", bg: "rgba(196,181,253,0.18)", border: "rgba(196,181,253,0.55)", fg: "#c4b5fd" },
  { name: "Compliance", bg: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.55)", fg: "#fca5a5" },
  { name: "Translator", bg: "rgba(134,239,172,0.18)", border: "rgba(134,239,172,0.55)", fg: "#86efac" },
];

export default function MultichatOgImage() {
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
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 45%, #134e4a 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            AEVION · Multichat Engine
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Parallel agents,</span>
            <span style={{ color: "#5eead4" }}>one identity, one window.</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#cbd5e1",
              lineHeight: 1.4,
              maxWidth: 1000,
              display: "flex",
            }}
          >
            6 specialised AI agents · 5 LLM providers · QCoreAI router · Live in production.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ROLES.map((r) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 999,
                border: `1px solid ${r.border}`,
                background: r.bg,
                color: r.fg,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              {r.name}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
