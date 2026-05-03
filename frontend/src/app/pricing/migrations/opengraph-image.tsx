import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Migration — DocuSign, OpenAI, Stripe, Patently → AEVION";
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
            MIGRATION GUIDES
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
            STEP-BY-STEP · ZERO DOWNTIME · CUSTOMER SUCCESS HELPS FREE
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
            Перейдите на AEVION без боли
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
            Гайды для DocuSign · OpenAI · Stripe · Patently. От 5 до 30 дней.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 20 }}>
            <Pair from="DocuSign" to="QSign" delta="−73%" />
            <Pair from="OpenAI" to="QCoreAI" delta="−45%" />
            <Pair from="Stripe" to="QPayNet" delta="−42% latency" />
            <Pair from="Patently" to="IP Bureau" delta="−74%" />
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/migrations</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Pair({ from, to, delta }: { from: string; to: string; delta: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "8px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 10, border: "1px solid rgba(94,234,212,0.3)" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", letterSpacing: "0.02em" }}>
        {from} → {to}
      </span>
      <span style={{ fontSize: 16, fontWeight: 900, color: "#5eead4", letterSpacing: "-0.02em", marginTop: 2 }}>{delta}</span>
    </div>
  );
}
