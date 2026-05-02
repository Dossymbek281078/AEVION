import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Music Awards — premium for AI and digital music";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Sound-wave bars — pure decorative, ratios pre-computed.
const BARS = [0.3, 0.55, 0.7, 0.42, 0.85, 1.0, 0.92, 0.62, 0.48, 0.78, 0.66, 0.34, 0.51, 0.7, 0.45, 0.8, 0.95, 0.6, 0.3, 0.42, 0.5];

export default function MusicAwardsOg() {
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
            "radial-gradient(circle at 25% 70%, rgba(125,211,252,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#7dd3fc", textTransform: "uppercase", display: "flex" }}>
          AEVION · Music Awards
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
            <span>Pre-Grammy era</span>
            <span style={{ color: "#7dd3fc" }}>for AI music.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Submit through Planet (artifact type music). Validator quorum publishes verdicts on-chain.
            Top-3 settle straight to your AEVION Bank wallet in AEC.
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100, maxWidth: 920, marginTop: 8 }}>
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: h * 100,
                  background: "linear-gradient(180deg, #7dd3fc, #6366f1)",
                  borderRadius: 4,
                  display: "flex",
                }}
              />
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
          <div style={{ display: "flex" }}>aevion.app/awards/music</div>
          <div style={{ color: "#7dd3fc", display: "flex" }}>QRight · Planet · Bank</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
