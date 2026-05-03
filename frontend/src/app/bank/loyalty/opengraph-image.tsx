import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Loyalty Vault — Programs with expiry alerts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CARDS = [
  { name: "Air Astana", points: "12,400", expires: "31 Dec 2026", color: "#0ea5e9" },
  { name: "Magnum Club", points: "3,820", expires: "—", color: "#fbbf24" },
  { name: "Kaspi Bonus", points: "8,150", expires: "12 Jul 2026", color: "#dc2626" },
];

export default function LoyaltyOg() {
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
            "radial-gradient(circle at 75% 70%, rgba(14,165,233,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#0ea5e9", textTransform: "uppercase", display: "flex" }}>
          AEVION · Loyalty
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Loyalty,</span>
            <span style={{ color: "#0ea5e9" }}>organised.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Points, miles, vouchers — every external program in one place with expiry alerts.
            Never lose value to a forgotten card again.
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {CARDS.map((c) => (
              <div
                key={c.name}
                style={{
                  width: 270,
                  padding: 18,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${c.color}55`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: c.color, textTransform: "uppercase", display: "flex" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" as const, display: "flex" }}>
                  {c.points}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", display: "flex" }}>Expires: {c.expires}</div>
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
          <div style={{ display: "flex" }}>aevion.app/bank/loyalty</div>
          <div style={{ color: "#0ea5e9", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
