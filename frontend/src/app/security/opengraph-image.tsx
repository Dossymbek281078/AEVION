import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Security — six layers between user data and any attacker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LAYERS = [
  { n: "01", label: "Quantum Shield", color: "#5eead4" },
  { n: "02", label: "Identity",       color: "#7dd3fc" },
  { n: "03", label: "Authorship",     color: "#a78bfa" },
  { n: "04", label: "Validators",     color: "#86efac" },
  { n: "05", label: "Audit",          color: "#fbbf24" },
  { n: "06", label: "Disclosure",     color: "#f472b6" },
];

export default function SecurityOg() {
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
            "radial-gradient(circle at 30% 30%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #020617 0%, #052e2b 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Security
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
            <span>Trust</span>
            <span style={{ color: "#5eead4" }}>by construction.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Six independent layers between user data and any attacker.
            None is &quot;trust us&quot; — every one is verifiable from outside AEVION.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {LAYERS.map((l) => (
              <div
                key={l.n}
                style={{
                  flex: 1,
                  padding: "14px 12px",
                  borderRadius: 12,
                  border: `1px solid ${l.color}55`,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: l.color,
                    letterSpacing: 2,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    display: "flex",
                  }}
                >
                  {l.n}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", display: "flex" }}>
                  {l.label}
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
          <div style={{ display: "flex" }}>aevion.app/security</div>
          <div style={{ color: "#5eead4", display: "flex" }}>Ed25519 · Shamir · post-quantum-ready</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
