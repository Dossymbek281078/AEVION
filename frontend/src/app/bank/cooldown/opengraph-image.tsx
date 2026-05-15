import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Cool-down Queue — Anti-impulse hold";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HOLDS = [
  { item: "Mechanical keyboard", amount: "180 AEC", remaining: "12h", color: "#fbbf24" },
  { item: "Premium headset", amount: "320 AEC", remaining: "48h", color: "#a78bfa" },
  { item: "New monitor", amount: "640 AEC", remaining: "72h", color: "#0ea5e9" },
];

export default function CooldownOg() {
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
            "radial-gradient(circle at 25% 30%, rgba(124,58,237,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#a78bfa", textTransform: "uppercase", display: "flex" }}>
          AEVION · Cool-down
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
            <span>Wait before</span>
            <span style={{ color: "#a78bfa" }}>you spend.</span>
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Schedule non-essential payments with a 12-72h cool-down. The wallet waits —
            you only confirm when it really matters.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 920 }}>
            {HOLDS.map((h) => (
              <div
                key={h.item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${h.color}55`,
                  fontSize: 18,
                }}
              >
                <span style={{ fontWeight: 700, color: "#fff", display: "flex", flex: 1 }}>{h.item}</span>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: "#cbd5e1", display: "flex" }}>{h.amount}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 1.5,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: `${h.color}22`,
                    color: h.color,
                    display: "flex",
                    minWidth: 70,
                    justifyContent: "center",
                  }}
                >
                  {h.remaining}
                </span>
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
          <div style={{ display: "flex" }}>aevion.app/bank/cooldown</div>
          <div style={{ color: "#a78bfa", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
