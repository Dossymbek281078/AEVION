import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Trust Score — Reputation, computed";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TrustOg() {
  // Big radial ring as decorative element. Score is shown as a sample 80
  // (Elite gate) so the image suggests an ambitious target without leaking
  // any real user data.
  const sampleScore = 80;
  const r = 130;
  const circ = 2 * Math.PI * r;
  const dash = (sampleScore / 100) * circ;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 64,
          gap: 48,
          background:
            "radial-gradient(circle at 30% 50%, rgba(124,58,237,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 700 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#a78bfa",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Trust Score
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Reputation,</span>
            <span style={{ color: "#a78bfa" }}>computed.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", lineHeight: 1.45, display: "flex" }}>
            8 factors · 4 tiers · weighted-mean math · runs locally on your device.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            {[
              { label: "New", color: "#64748b" },
              { label: "Growing", color: "#0d9488" },
              { label: "Trusted", color: "#7c3aed" },
              { label: "Elite", color: "#d97706" },
            ].map((tier) => (
              <div
                key={tier.label}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: tier.color,
                  color: "#0f172a",
                  fontSize: 16,
                  fontWeight: 900,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                {tier.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", width: 320, height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={320} height={320} viewBox="0 0 320 320">
            <circle cx={160} cy={160} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={20} />
            <circle
              cx={160}
              cy={160}
              r={r}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={20}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
              transform="rotate(-90 160 160)"
            />
          </svg>
          <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, color: "#fff" }}>{sampleScore}</div>
            <div style={{ fontSize: 14, letterSpacing: 4, fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", marginTop: 8, display: "flex" }}>
              out of 100
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
