import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank — Embeddable Trust Badge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function BadgeOg() {
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
          background: "linear-gradient(135deg, #0d9488 0%, #0ea5e9 50%, #6366f1 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#ecfeff",
              textTransform: "uppercase",
            }}
          >
            AEVION · Bank
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#fff",
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Embed your</span>
            <span style={{ color: "#fde68a" }}>Trust Badge anywhere</span>
          </div>

          {/* Mock badge preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: 22,
              borderRadius: 16,
              background: "#fff",
              color: "#0f172a",
              maxWidth: 540,
              boxShadow: "0 30px 60px rgba(0,0,0,0.30)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "6px solid rgba(13,148,136,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
                color: "#0d9488",
              }}
            >
              72
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, display: "flex" }}>
                AEVION · Trust Score
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex" }}>your-handle</div>
              <div
                style={{
                  display: "flex",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  color: "#0d9488",
                  background: "rgba(13,148,136,0.14)",
                  padding: "3px 10px",
                  borderRadius: 999,
                  alignSelf: "flex-start",
                  textTransform: "uppercase",
                }}
              >
                TRUSTED
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: 2,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          aevion.app/bank/badge · GitHub READMEs · profiles · resumes
        </div>
      </div>
    ),
    { ...size },
  );
}
