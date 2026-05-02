import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Awards — Music & Film recognition with AEC payouts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PIPELINE = [
  { step: "01", label: "QRight", color: "#7dd3fc" },
  { step: "02", label: "Submit", color: "#a78bfa" },
  { step: "03", label: "Planet validate", color: "#5eead4" },
  { step: "04", label: "AEC → Bank", color: "#fbbf24" },
];

export default function AwardsOg() {
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
            "radial-gradient(circle at 50% 30%, rgba(167,139,250,0.30), transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#a78bfa", textTransform: "uppercase", display: "flex" }}>
          AEVION · Awards
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
            <span>Recognition,</span>
            <span style={{ color: "#a78bfa" }}>tied to revenue.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            QRight registers authorship → Planet validators certify → top-3 receive AEC prizes
            settled directly into AEVION Bank wallets. Music wave 1, film wave 2.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {PIPELINE.map((p) => (
              <div
                key={p.step}
                style={{
                  flex: 1,
                  padding: "16px 14px",
                  borderRadius: 12,
                  border: `1px solid ${p.color}55`,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, color: p.color, letterSpacing: 2, fontFamily: "ui-monospace, SFMono-Regular, monospace", display: "flex" }}>
                  {p.step}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex" }}>
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
          <div style={{ display: "flex" }}>aevion.app/awards</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>music · film · creator economy</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
