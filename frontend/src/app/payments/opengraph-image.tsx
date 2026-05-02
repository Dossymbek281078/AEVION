import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Payments Rail — links, methods, webhooks, settlements";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function PaymentsOg() {
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
            "radial-gradient(circle at 80% 0%, rgba(13,148,136,0.40), transparent 50%), linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: -1,
            }}
          >
            ₳
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Payments Rail
          </div>
        </div>

        {/* Main copy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Move money on the</span>
            <span
              style={{
                background: "linear-gradient(90deg, #5eead4, #a78bfa, #fbbf24)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              trust graph.
            </span>
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              "Links",
              "Methods",
              "Webhooks",
              "Settlements",
              "Subscriptions",
              "Fraud",
              "Compliance",
              "API",
            ].map((label) => (
              <div
                key={label}
                style={{
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(94,234,212,0.35)",
                  background: "rgba(13,148,136,0.15)",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#5eead4",
                  display: "flex",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 22,
              color: "#cbd5e1",
              maxWidth: 860,
              lineHeight: 1.45,
              display: "flex",
            }}
          >
            Links, method orchestration, signed webhooks, and bank settlement
            — natively connected to QRight, Planet, and AEVION Bank.
          </div>
        </div>

        {/* Footer row */}
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
          <div style={{ display: "flex" }}>aevion.app/payments</div>
          <div style={{ color: "#5eead4", display: "flex" }}>
            payments-rail · v1 · 9 surfaces
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
