import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION live ecosystem demo — 27 nodes, one trust pipeline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PIPELINE = [
  { step: "01", label: "QRight",  sub: "Hash + timestamp", color: "#7dd3fc" },
  { step: "02", label: "QSign",   sub: "Ed25519 signature", color: "#a78bfa" },
  { step: "03", label: "Bureau",  sub: "Certificate",       color: "#f472b6" },
  { step: "04", label: "Planet",  sub: "Validator quorum",  color: "#86efac" },
  { step: "05", label: "Bank",    sub: "AEC payout",        color: "#fbbf24" },
];

export default function DemoOg() {
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
            "radial-gradient(circle at 50% 30%, rgba(167,139,250,0.25), transparent 55%), linear-gradient(135deg, #020617 0%, #1e1b4b 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#a78bfa", textTransform: "uppercase", display: "flex" }}>
          AEVION · Live Demo
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
            <span>Idea → court-grade</span>
            <span style={{ color: "#a78bfa" }}>certificate in 90s.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Walk every module of the trust pipeline live. Real backend, real metrics, no slides —
            registry, signature, bureau, validators, wallet.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "stretch" }}>
            {PIPELINE.map((p, i) => (
              <div
                key={p.step}
                style={{
                  flex: 1,
                  padding: "14px 12px",
                  borderRadius: 12,
                  border: `1px solid ${p.color}55`,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: p.color,
                    letterSpacing: 2,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    display: "flex",
                  }}
                >
                  {p.step}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", display: "flex" }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", lineHeight: 1.3 }}>
                  {p.sub}
                </div>
                {i < PIPELINE.length - 1 ? (
                  <div
                    style={{
                      position: "absolute",
                      right: -8,
                      top: "50%",
                      fontSize: 18,
                      color: "rgba(148,163,184,0.4)",
                      display: "flex",
                    }}
                  >
                    →
                  </div>
                ) : null}
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
          <div style={{ display: "flex" }}>aevion.app/demo</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>12 live MVPs · 1 pipeline</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
