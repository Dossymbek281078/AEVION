import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Help — FAQ for users and investors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOPICS = [
  { kicker: "Q", label: "What is AEVION?", color: "#22d3ee" },
  { kicker: "Q", label: "How do I register IP?", color: "#a78bfa" },
  { kicker: "Q", label: "How does Bank pay out?", color: "#fbbf24" },
  { kicker: "Q", label: "Is my data safe?", color: "#86efac" },
];

export default function HelpOg() {
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
            "radial-gradient(circle at 35% 30%, rgba(34,211,238,0.25), transparent 55%), linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#22d3ee", textTransform: "uppercase", display: "flex" }}>
          AEVION · Help
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
            <span>Answers,</span>
            <span style={{ color: "#22d3ee" }}>not slide bullets.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            User FAQ for QRight, Planet, Bank, Awards, CyberChess. Plus the investor FAQ
            behind the $1B+ thesis: TAM, moat, revenue, exit, risks.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {TOPICS.map((t) => (
              <div
                key={t.label}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: `1px solid ${t.color}55`,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: t.color,
                    letterSpacing: 2,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    display: "flex",
                  }}
                >
                  {t.kicker}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.3, display: "flex" }}>
                  {t.label}
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
          <div style={{ display: "flex" }}>aevion.app/help</div>
          <div style={{ color: "#22d3ee", display: "flex" }}>users · investors · creators</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
