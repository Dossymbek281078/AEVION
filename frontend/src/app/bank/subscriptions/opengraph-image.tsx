import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Subscriptions — Catch the leaks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { name: "Vault Storage Pro", flag: "expensive", amount: "12.40", color: "#f87171" },
  { name: "Daily Espresso", flag: "duplicate", amount: "3.20", color: "#fbbf24" },
  { name: "Cloud Render Tier 2", flag: "stale", amount: "8.00", color: "#94a3b8" },
];

const FLAG_COPY: Record<string, string> = {
  expensive: "EXPENSIVE",
  duplicate: "DUPLICATE",
  stale: "STALE",
};

export default function SubscriptionsOg() {
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
            "radial-gradient(circle at 75% 30%, rgba(220,38,38,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#f87171",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          AEVION · Subscriptions
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
            <span>Catch</span>
            <span style={{ color: "#f87171" }}>the leaks.</span>
          </div>

          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Auto-flags stale, expensive, and duplicate recurring charges.
            One-tap pause from anywhere — no calls, no support tickets.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 920, marginTop: 8 }}>
            {ROWS.map((r) => (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${r.color}55`,
                  fontSize: 18,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 1.5,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: `${r.color}22`,
                    color: r.color,
                    display: "flex",
                  }}
                >
                  {FLAG_COPY[r.flag]}
                </span>
                <span style={{ fontWeight: 700, color: "#fff", display: "flex", flex: 1 }}>{r.name}</span>
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    color: r.color,
                    fontWeight: 800,
                    display: "flex",
                  }}
                >
                  {r.amount} AEC / mo
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
          <div style={{ display: "flex" }}>aevion.app/bank/subscriptions</div>
          <div style={{ color: "#f87171", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
