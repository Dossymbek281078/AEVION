import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Security & Compliance — SOC 2, GDPR, 152-ФЗ, PCI DSS";
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
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #065f46 130%)",
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
            SECURITY &amp; COMPLIANCE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#34d399",
              marginBottom: 12,
            }}
          >
            SOC 2 TYPE II · GDPR · 152-ФЗ · PCI DSS
          </div>
          <h1
            style={{
              fontSize: 80,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              maxWidth: 980,
            }}
          >
            Безопасность корпоративного уровня
          </h1>
          <p
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              margin: 0,
              marginTop: 20,
              maxWidth: 880,
              lineHeight: 1.3,
            }}
          >
            Шифрование · Аудит · Резидентность данных EU/RU/KZ · Bug Bounty
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 32 }}>
            <Stat value="AES-256" label="шифрование" />
            <Stat value="99.9%" label="SLA uptime" />
            <Stat value="EU/RU/KZ" label="резидентность" />
            <Stat value="24/7" label="мониторинг" />
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/security</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", color: "#34d399" }}>{value}</span>
      <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>{label}</span>
    </div>
  );
}
