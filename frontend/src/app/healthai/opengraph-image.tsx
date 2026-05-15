import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HealthAI — Personal AI Doctor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #052e1a 0%, #064e3b 50%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              padding: "8px 20px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "2px solid #10b981",
              borderRadius: 16,
              color: "#6ee7b7",
            }}
          >
            AEVION
          </div>
          <div style={{ fontSize: 28, color: "#64748b" }}>·</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#f8fafc" }}>HealthAI</div>
        </div>

        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#f8fafc" }}>Personal</span>
          <span style={{ color: "#34d399" }}>AI Doctor</span>
        </div>

        <div
          style={{
            fontSize: 30,
            color: "#cbd5e1",
            lineHeight: 1.4,
            maxWidth: 980,
            marginBottom: 40,
          }}
        >
          Symptom triage · Daily wellness log · BMI/trends · PHQ-9/GAD-7 ·
          Weekly plan · Cycle · Family profiles
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
          {[
            { t: "🩺 Triage", c: "#10b981" },
            { t: "📊 Trends", c: "#0891b2" },
            { t: "🧠 PHQ-9/GAD-7", c: "#7c3aed" },
            { t: "📋 Weekly plan", c: "#d97706" },
            { t: "👨‍👩‍👧 Family", c: "#dc2626" },
          ].map(p => (
            <div
              key={p.t}
              style={{
                fontSize: 22,
                fontWeight: 600,
                padding: "10px 22px",
                background: `${p.c}33`,
                border: `1px solid ${p.c}`,
                borderRadius: 999,
                color: "#f8fafc",
              }}
            >
              {p.t}
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: 18,
            color: "#94a3b8",
            marginTop: 24,
            fontStyle: "italic",
          }}
        >
          Not medical advice. Always consult a licensed clinician.
        </div>
      </div>
    ),
    { ...size },
  );
}
