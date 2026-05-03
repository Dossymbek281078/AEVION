import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Planet — validator network for AI artifacts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VALIDATORS = [
  { x: 250, y: 360, label: "V1", verdict: "passed" },
  { x: 360, y: 280, label: "V2", verdict: "passed" },
  { x: 470, y: 360, label: "V3", verdict: "passed" },
  { x: 580, y: 280, label: "V4", verdict: "passed" },
  { x: 690, y: 360, label: "V5", verdict: "flagged" },
  { x: 800, y: 280, label: "V6", verdict: "passed" },
  { x: 910, y: 360, label: "V7", verdict: "passed" },
];

export default function PlanetOg() {
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
            "radial-gradient(circle at 50% 35%, rgba(34,197,94,0.25), transparent 55%), linear-gradient(135deg, #020617 0%, #0c1e1e 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#86efac", textTransform: "uppercase", display: "flex" }}>
          AEVION · Planet
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
            <span>Open jury.</span>
            <span style={{ color: "#86efac" }}>On-chain verdicts.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Independent validators co-sign verdicts on every AI artifact submission.
            No closed jury, no PR shortlists — quorum Y published on-chain. Music, film, code, web.
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, alignItems: "flex-end", height: 110 }}>
            {VALIDATORS.map((v, i) => {
              const isPassed = v.verdict === "passed";
              return (
                <div
                  key={i}
                  style={{
                    width: 96,
                    height: i % 2 === 0 ? 96 : 110,
                    borderRadius: 14,
                    background: isPassed
                      ? "linear-gradient(135deg, #22c55e, #16a34a)"
                      : "rgba(251,191,36,0.20)",
                    border: isPassed ? "2px solid #86efac" : "2px solid #fbbf24",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: 22,
                    fontWeight: 900,
                    color: isPassed ? "#022c12" : "#fbbf24",
                  }}
                >
                  <div style={{ display: "flex" }}>{v.label}</div>
                  <div style={{ display: "flex", fontSize: 10, opacity: 0.8, marginTop: 4 }}>
                    {isPassed ? "✓" : "?"}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 14, color: "#86efac", fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: 1, display: "flex" }}>
            quorum 6/7 → verdict: passed (1 flagged for human review)
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
          <div style={{ display: "flex" }}>aevion.app/planet</div>
          <div style={{ color: "#86efac", display: "flex" }}>QRight · Planet · Bank</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
