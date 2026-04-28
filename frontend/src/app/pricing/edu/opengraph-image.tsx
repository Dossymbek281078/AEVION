import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION for Education — free Pro for students, university sponsorship";
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
            "linear-gradient(135deg, #0f172a 0%, #065f46 50%, #10b981 130%)",
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
            FOR EDUCATION
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#6ee7b7",
              marginBottom: 12,
            }}
          >
            БЕСПЛАТНО ДЛЯ СТУДЕНТОВ И УНИВЕРСИТЕТОВ
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
            AEVION для образования
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
            Free Pro для .edu · Sponsorship университетам · Хакатоны
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 28 }}>
            <Card icon="🎓" label="Студент" hint="Free Pro" />
            <Card icon="📚" label="Профессор" hint="Course license" />
            <Card icon="🏛" label="Университет" hint="Sponsorship" />
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/edu</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Card({ icon, label, hint }: { icon: string; label: string; hint: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 18px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(110,231,183,0.3)",
        borderRadius: 12,
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 6, letterSpacing: "-0.01em" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 700, marginTop: 2 }}>{hint}</span>
    </div>
  );
}
