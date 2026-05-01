import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Partner Program — Reseller / System Integrator / Agency";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0d9488 130%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>AEVION</span>
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "6px 14px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              color: "#94a3b8",
            }}
          >
            PARTNER PROGRAM
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#5eead4",
              marginBottom: 12,
            }}
          >
            RESELLER · SYSTEM INTEGRATOR · AGENCY
          </div>
          <h1
            style={{
              fontSize: 80,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            Стройте бизнес поверх AEVION
          </h1>
          <p
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              margin: 0,
              marginTop: 20,
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            30% маржа · 20% revenue share · White-label · Sales-deck и tech-onboarding
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 28 }}>
            <Card icon="🤝" label="RESELLER" hint="30% маржа" color="#5eead4" />
            <Card icon="⚙" label="SI" hint="20% rev share" color="#7dd3fc" />
            <Card icon="🎨" label="AGENCY" hint="white-label" color="#c4b5fd" />
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/partners</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Card({ icon, label, hint, color }: { icon: string; label: string; hint: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 18px",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${color}`,
        borderRadius: 12,
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 6, letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: 700, marginTop: 2 }}>{hint}</span>
    </div>
  );
}
